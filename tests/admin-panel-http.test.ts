import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STORAGE_BUCKET } from '../src/lib/constants.ts';
import { assertSupabaseIsUp, createFixture, serviceClient, type Fixture } from './support/supabase.ts';
import { createAccount, signInWithJar, type TestAccount } from './support/session.ts';
import { startSite } from './support/site.ts';

const SITE_START_TIMEOUT_MS = 120_000;
const UUID_IN_PATH = /\/admin\/productos\/([0-9a-f-]{36})\//;

let site: Awaited<ReturnType<typeof startSite>>;
let fixture: Fixture;
let cookie: string;
const accounts: TestAccount[] = [];

beforeAll(async () => {
  await assertSupabaseIsUp();
  fixture = await createFixture();
  const account = await createAccount({ role: 'admin' });
  accounts.push(account);
  cookie = (await signInWithJar(account)).header();
  site = await startSite();
}, SITE_START_TIMEOUT_MS);

afterAll(async () => {
  await site?.stop();
  const service = serviceClient();
  const { data } = await service.from('products').select('id').ilike('name', `%${fixture?.tag ?? 'sin-tag'}%`);
  for (const { id } of data ?? []) {
    const { data: objects } = await service.storage.from(STORAGE_BUCKET).list(id);
    if (objects?.length) await service.storage.from(STORAGE_BUCKET).remove(objects.map((object) => `${id}/${object.name}`));
  }
  await service.from('products').delete().ilike('name', `%${fixture?.tag ?? 'sin-tag'}%`);
  await service.from('brands').delete().eq('slug', `marca-web-${fixture?.tag}`);
  await fixture?.cleanup();
  await Promise.all(accounts.map((account) => account.remove()));
});

const headers = (extra: Record<string, string> = {}, withCookie = cookie) => ({ cookie: withCookie, origin: site.origin, ...extra });
const get = (path: string, withCookie = cookie) => fetch(`${site.origin}${path}`, { redirect: 'manual', headers: { cookie: withCookie } });
const post = (path: string, fields: Record<string, string>, opts: { cookie?: string; origin?: string } = {}) =>
  fetch(`${site.origin}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: opts.cookie ?? cookie, origin: opts.origin ?? site.origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
const postFile = async (path: string, intent: string, file: File) => {
  const form = new FormData();
  form.append('intent', intent);
  form.append('photo', file);
  return fetch(`${site.origin}${path}`, { method: 'POST', redirect: 'manual', headers: headers(), body: form });
};

const jpeg = async (width = 900, height = 700) =>
  new File([new Uint8Array(await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 130 } } }).jpeg().toBuffer())], 'foto.jpg', {
    type: 'image/jpeg',
  });
const location = (response: Response) => response.headers.get('location') ?? '';

async function createProduct(name: string): Promise<string> {
  const response = await post('/admin/productos/nuevo', { name, brand: fixture.brandId, category: fixture.categoryId });
  expect(response.status).toBe(303);
  const id = location(response).match(UUID_IN_PATH)?.[1];
  expect(id, location(response)).toBeDefined();
  return id as string;
}

async function readyProduct(name: string): Promise<string> {
  const id = await createProduct(name);
  expect((await postFile(`/admin/productos/${id}/foto`, 'main', await jpeg())).status).toBe(303);
  expect((await post(`/admin/productos/${id}/precio`, { price: '12.500', stock: '4' })).status).toBe(303);
  return id;
}

describe('inicio del panel', () => {
  it('muestra las tres acciones', async () => {
    const html = await (await get('/admin')).text();
    expect(html).toContain('Agregar un producto');
    expect(html).toContain('Cambiar precio o stock');
    expect(html).toContain('Ocultar o mostrar un producto');
    expect(html).toContain('href="/admin/productos/nuevo"');
  });

  it('un aviso desconocido en la dirección no se escribe en la página', async () => {
    const html = await (await get('/admin?aviso=%3Cscript%3Ealert(1)%3C%2Fscript%3E')).text();
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('role="status"');
  });

  it('un aviso conocido sí se muestra', async () => {
    expect(await (await get('/admin?aviso=publicado')).text()).toContain('El producto ya se ve en la tienda.');
  });
});

describe('asistente: paso a paso', () => {
  it('recorre los cinco pasos y publica un producto que se ve en la tienda', async () => {
    const name = `Crema de prueba ${fixture.tag}`;
    const created = await post('/admin/productos/nuevo', { name, brand: fixture.brandId, category: fixture.categoryId });
    expect(created.status).toBe(303);
    expect(location(created)).toMatch(/\/foto$/);
    const id = location(created).match(UUID_IN_PATH)![1];

    const photoPage = await (await get(`/admin/productos/${id}/foto`)).text();
    expect(photoPage).toContain('Paso 2 de 5');
    expect(photoPage).toContain('Subí una foto del producto');

    const uploaded = await postFile(`/admin/productos/${id}/foto`, 'main', await jpeg(2000, 1500));
    expect(uploaded.status).toBe(303);
    expect(location(uploaded)).toBe(`/admin/productos/${id}/precio`);

    const priced = await post(`/admin/productos/${id}/precio`, { price: '$ 12.500', stock: '4' });
    expect(location(priced)).toBe(`/admin/productos/${id}/detalles`);

    const detailed = await post(`/admin/productos/${id}/detalles`, { summary: 'Hidrata y calma', usageSteps: '1. Limpiá\n2. Aplicá', benefits: '- Hidrata' });
    expect(location(detailed)).toBe(`/admin/productos/${id}/revisar`);

    const review = await (await get(`/admin/productos/${id}/revisar`)).text();
    expect(review).toContain('Publicar en la tienda');
    expect(review).toContain('$12.500');
    expect(review).toContain('Para qué sirve');
    expect(review).not.toContain('Para publicarlo todavía falta');

    const published = await post(`/admin/productos/${id}/revisar`, { intent: 'publish' });
    expect(location(published)).toBe(`/admin/productos/${id}/revisar?aviso=publicado`);
    expect(await (await get(`/admin/productos/${id}/revisar`)).text()).toContain('Ver en la tienda');

    const { data } = await serviceClient().from('products').select('slug, status').eq('id', id).single();
    expect(data?.status).toBe('published');
    const storefront = await get(`/productos/${data?.slug}`, '');
    expect(storefront.status).toBe(200);
    expect(await storefront.text()).toContain(name);
  });

  it('el primer paso muestra qué falta, sin perder lo escrito', async () => {
    const response = await post('/admin/productos/nuevo', { name: '   ', brand: '', category: fixture.categoryId });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Escribí el nombre del producto.');
    expect(html).toContain('Elegí la marca.');
    expect(html).toContain('aria-invalid="true"');
  });

  it('lo que se escribe no puede salirse del campo ni ejecutar código', async () => {
    const payload = `"><script>alert(1)</script> ${fixture.tag}`;
    const html = await (await post('/admin/productos/nuevo', { name: payload, brand: '', category: '' })).text();
    // dentro de un valor entre comillas, <> son inofensivos; lo que importa es que la comilla no cierre el atributo
    expect(html).not.toContain('"><script>alert(1)');
    expect(html).toContain('value="&quot;');
  });

  it('el texto de un área tampoco se sale de su caja', async () => {
    const id = await createProduct(`Área segura ${fixture.tag}`);
    const html = await (await post(`/admin/productos/${id}/detalles`, { summary: `</textarea><script>alert(1)</script>${'a'.repeat(400)}` })).text();
    expect(html).not.toContain('</textarea><script>');
    expect(html).toContain('&lt;/textarea&gt;');
  });

  it('una marca nueva escrita en el formulario se crea y se usa', async () => {
    const response = await post('/admin/productos/nuevo', {
      name: `Con marca nueva ${fixture.tag}`,
      brand: '__new__',
      brandNew: `Marca Web ${fixture.tag}`,
      category: fixture.categoryId,
    });
    expect(response.status).toBe(303);
    const { data } = await serviceClient().from('brands').select('name').eq('slug', `marca-web-${fixture.tag}`).single();
    expect(data?.name).toBe(`Marca Web ${fixture.tag}`);
  });

  it('el precio inválido vuelve al formulario con un mensaje claro y no guarda nada', async () => {
    const id = await createProduct(`Precio malo ${fixture.tag}`);
    for (const [price, expected] of [
      ['0', 'mayor a cero'],
      ['12,50', 'sin centavos'],
      ['abc', 'solo puede llevar números'],
      ['-5', 'solo puede llevar números'],
      ['', 'Escribí el precio'],
    ] as const) {
      const response = await post(`/admin/productos/${id}/precio`, { price, stock: '3' });
      expect(response.status, price).toBe(200);
      expect(await response.text(), price).toContain(expected);
    }
    const { data } = await serviceClient().from('products').select('price_ars').eq('id', id).single();
    expect(data?.price_ars).toBe(0);
  });

  it('los detalles son opcionales: enviar todo vacío está bien', async () => {
    const id = await createProduct(`Detalles vacíos ${fixture.tag}`);
    expect((await post(`/admin/productos/${id}/detalles`, {})).status).toBe(303);
  });

  it('un texto demasiado largo en los detalles se rechaza', async () => {
    const id = await createProduct(`Detalle largo ${fixture.tag}`);
    const response = await post(`/admin/productos/${id}/detalles`, { summary: 'a'.repeat(401) });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('máximo 400');
  });

  it('desde «revisar», cada paso vuelve a la revisión al guardar', async () => {
    const id = await readyProduct(`Vuelve a revisar ${fixture.tag}`);
    const response = await post(`/admin/productos/${id}/precio?de=revisar`, { price: '9000', stock: '1' });
    expect(location(response)).toBe(`/admin/productos/${id}/revisar`);
    const details = await post(`/admin/productos/${id}/detalles?de=revisar`, { summary: 'Nuevo' });
    expect(location(details)).toBe(`/admin/productos/${id}/revisar`);
    const other = await post(`/admin/productos/${id}/precio?de=https://evil.example`, { price: '9000', stock: '1' });
    expect(location(other)).toBe(`/admin/productos/${id}/detalles`);
  });
});

describe('fotos', () => {
  it('un archivo que no es foto se rechaza con un mensaje y no se guarda', async () => {
    const id = await createProduct(`Foto mala ${fixture.tag}`);
    const response = await postFile(`/admin/productos/${id}/foto`, 'main', new File(['no soy una foto'], 'x.jpg', { type: 'image/jpeg' }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('No pudimos leer ese archivo');
    const { count } = await serviceClient().from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', id);
    expect(count).toBe(0);
  });

  it('sin elegir archivo avisa', async () => {
    const id = await createProduct(`Sin archivo ${fixture.tag}`);
    const form = new FormData();
    form.append('intent', 'main');
    form.append('photo', new File([], ''));
    const response = await fetch(`${site.origin}/admin/productos/${id}/foto`, { method: 'POST', redirect: 'manual', headers: headers(), body: form });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Elegí una foto para subir.');
  });

  it('un pedido que declara un tamaño exagerado se corta antes de leer el cuerpo', async () => {
    const id = await createProduct(`Pedido enorme ${fixture.tag}`);
    const { request } = await import('node:http');
    const url = new URL(`${site.origin}/admin/productos/${id}/foto`);
    const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        url,
        { method: 'POST', headers: { ...headers(), 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(200 * 1024 * 1024) } },
        (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString()));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        },
      );
      req.on('error', reject);
      // se manda solo el comienzo: si el servidor esperara el cuerpo completo, la respuesta no llegaría
      req.write('--x\r\n');
    });
    expect(result.status).toBe(200);
    expect(result.body).toContain('La foto pesa demasiado');
  });

  it('agrega y quita fotos extra', async () => {
    const id = await readyProduct(`Fotos extra ${fixture.tag}`);
    const added = await postFile(`/admin/productos/${id}/foto`, 'extra', await jpeg());
    expect(location(added)).toBe(`/admin/productos/${id}/foto?aviso=foto-guardada`);
    const service = serviceClient();
    const { data } = await service.from('product_images').select('id, kind').eq('product_id', id);
    expect(data).toHaveLength(2);
    const extra = data!.find((image) => image.kind === 'detail')!;
    const removed = await post(`/admin/productos/${id}/foto`, { intent: 'remove', imageId: extra.id });
    expect(location(removed)).toBe(`/admin/productos/${id}/foto?aviso=foto-quitada`);
    const { count } = await service.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', id);
    expect(count).toBe(1);
  });
});

describe('publicar, ocultar y eliminar', () => {
  it('no deja publicar sin foto ni precio y dice qué falta', async () => {
    const id = await createProduct(`Incompleto ${fixture.tag}`);
    const review = await (await get(`/admin/productos/${id}/revisar`)).text();
    expect(review).toContain('Para publicarlo todavía falta');
    expect(review).toContain('Falta la foto principal.');
    expect(review).toContain('Falta el precio.');
    expect(review).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]+>[^<]*)*Publicar en la tienda/);

    // el panel de la página ya lista lo que falta: lo que cuenta es el aviso del intento forzado
    const forced = await post(`/admin/productos/${id}/revisar`, { intent: 'publish' });
    expect(forced.status).toBe(200);
    expect(await forced.text()).toContain('role="alert"');
    const { data } = await serviceClient().from('products').select('status').eq('id', id).single();
    expect(data?.status).toBe('draft');
  });

  it('con precio pero sin foto tampoco se publica (la base sola no lo impediría)', async () => {
    const id = await createProduct(`Precio sin foto ${fixture.tag}`);
    await post(`/admin/productos/${id}/precio`, { price: '5000', stock: '2' });
    const forced = await post(`/admin/productos/${id}/revisar`, { intent: 'publish' });
    expect(forced.status).toBe(200);
    const html = await forced.text();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Falta la foto principal.');
    const { data } = await serviceClient().from('products').select('status').eq('id', id).single();
    expect(data?.status).toBe('draft');
  });

  it('ocultar saca el producto de la tienda y mostrar lo vuelve a poner', async () => {
    const id = await readyProduct(`Visibilidad ${fixture.tag}`);
    await post(`/admin/productos/${id}/revisar`, { intent: 'publish' });
    const { data } = await serviceClient().from('products').select('slug').eq('id', id).single();
    expect((await get(`/productos/${data?.slug}`, '')).status).toBe(200);

    const hidden = await post('/admin/visibilidad', { productId: id, intent: 'hide' });
    expect(location(hidden)).toBe(`/admin/visibilidad?aviso=oculto#p-${id}`);
    expect((await get(`/productos/${data?.slug}`, '')).status).toBe(404);

    const shown = await post('/admin/visibilidad', { productId: id, intent: 'show' });
    expect(location(shown)).toBe(`/admin/visibilidad?aviso=publicado#p-${id}`);
    expect((await get(`/productos/${data?.slug}`, '')).status).toBe(200);
  });

  it('«mostrar» un producto incompleto no lo publica y explica por qué', async () => {
    const id = await createProduct(`Mostrar incompleto ${fixture.tag}`);
    const response = await post('/admin/visibilidad', { productId: id, intent: 'show' });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Falta la foto principal.');
  });

  it('eliminar archiva (no borra), y se puede recuperar', async () => {
    const id = await readyProduct(`Eliminable ${fixture.tag}`);
    const archived = await post(`/admin/productos/${id}/revisar`, { intent: 'archive' });
    expect(location(archived)).toBe('/admin?aviso=eliminado');
    const service = serviceClient();
    expect((await service.from('products').select('status').eq('id', id).single()).data?.status).toBe('archived');
    const list = await (await get('/admin/visibilidad')).text();
    expect(list).toContain('Productos eliminados');
    expect(list).toContain(`Eliminable ${fixture.tag}`);

    const restored = await post('/admin/visibilidad', { productId: id, intent: 'restore' });
    expect(restored.status).toBe(303);
    expect((await service.from('products').select('status').eq('id', id).single()).data?.status).toBe('draft');
  });

  it('un producto eliminado no aparece en la lista de precio y stock', async () => {
    const id = await readyProduct(`Eliminado en stock ${fixture.tag}`);
    await post(`/admin/productos/${id}/revisar`, { intent: 'archive' });
    expect(await (await get(`/admin/stock?q=${encodeURIComponent(`Eliminado en stock ${fixture.tag}`)}`)).text()).toContain('No encontramos ningún producto');
  });
});

describe('precio y unidades', () => {
  const stockValue = async (id: string) => (await serviceClient().from('products').select('stock').eq('id', id).single()).data?.stock;
  const priceValue = async (id: string) => (await serviceClient().from('products').select('price_ars').eq('id', id).single()).data?.price_ars;

  it('el − y el + no mandan nada al servidor: son botones comunes, sin formularios propios', async () => {
    const id = await readyProduct(`Botones ${fixture.tag}`);
    const html = await (await get(`/admin/stock?q=${encodeURIComponent(`Botones ${fixture.tag}`)}`)).text();
    // un solo formulario por producto (el que guarda precio y unidades)
    expect(html.match(/<form[^>]*data-stock-row/g)).toHaveLength(1);
    expect(html).not.toMatch(/id="(less|more)-/);
    for (const step of ['-1', '1']) {
      const button = html.match(new RegExp(`<button[^>]*data-stock-step="${step}"[^>]*>`));
      expect(button?.[0], step).toContain('type="button"');
      expect(button?.[0], step).toContain('hidden');
    }
    // lo guardado viaja en la página para saber si hay cambios sin guardar
    expect(html).toContain('data-saved-stock="4"');
    expect(html).toContain('data-saved-price="12500"');
    expect(await stockValue(id)).toBe(4);
  });

  it('los pedidos viejos de «una unidad más/menos» ya no hacen nada', async () => {
    const id = await readyProduct(`Viejo botón ${fixture.tag}`);
    for (const intent of ['more', 'less']) {
      const response = await post('/admin/stock', { productId: id, intent });
      expect(response.status, intent).toBe(200);
    }
    expect(await stockValue(id)).toBe(4);
  });

  it('pasar las unidades a 0 guarda el producto como agotado', async () => {
    const id = await readyProduct(`Cero ${fixture.tag}`);
    await post('/admin/stock', { productId: id, intent: 'save', price: '12500', stock: '0' });
    expect(await stockValue(id)).toBe(0);
  });

  it('guarda el precio y las unidades a la vez', async () => {
    const id = await readyProduct(`Guardar ambos ${fixture.tag}`);
    const response = await post('/admin/stock', { productId: id, intent: 'save', price: '$ 15.900', stock: '12' });
    expect(location(response)).toBe(`/admin/stock?fila=${id}&aviso=cambios-guardados#p-${id}`);
    expect(await priceValue(id)).toBe(15900);
    expect(await stockValue(id)).toBe(12);
  });

  it('después de guardar, esa fila muestra «Guardado» (no hay que subir a buscar el aviso)', async () => {
    const id = await readyProduct(`Confirmación ${fixture.tag}`);
    const redirect = await post('/admin/stock', { productId: id, intent: 'save', price: '13000', stock: '6' });
    const html = await (await get(location(redirect).replace(/#.*/, ''))).text();
    expect(html).toContain('Guardado');
    // y solo en esa fila: otra dirección con una fila distinta no lo muestra
    const other = await (await get(`/admin/stock?fila=00000000-0000-4000-8000-000000000000&aviso=cambios-guardados`)).text();
    expect(other).not.toContain('Guardado');
  });

  it('con una búsqueda activa, guardar vuelve a la misma búsqueda y a la misma fila', async () => {
    const id = await readyProduct(`Con búsqueda ${fixture.tag}`);
    const response = await fetch(`${site.origin}/admin/stock?q=${encodeURIComponent('con búsqueda')}`, {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie, origin: site.origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ productId: id, intent: 'save', price: '8000', stock: '2' }),
    });
    expect(location(response)).toBe(`/admin/stock?q=con%20b%C3%BAsqueda&fila=${id}&aviso=cambios-guardados#p-${id}`);
  });

  it('un valor inválido no guarda y muestra el error en esa fila', async () => {
    const id = await readyProduct(`Inválido ${fixture.tag}`);
    const response = await post('/admin/stock', { productId: id, intent: 'save', price: '-3', stock: '1.5' });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('solo puede llevar números');
    expect(html).toContain('número entero');
    expect(await priceValue(id)).toBe(12500);
    expect(await stockValue(id)).toBe(4);
  });

  it('la búsqueda filtra la lista y no refleja código', async () => {
    await readyProduct(`Buscable ${fixture.tag}`);
    const found = await (await get(`/admin/stock?q=${encodeURIComponent(`buscable ${fixture.tag}`)}`)).text();
    expect(found).toContain(`Buscable ${fixture.tag}`);
    const none = await (await get(`/admin/stock?q=${encodeURIComponent('"><script>alert(1)</script>')}`)).text();
    expect(none).not.toContain('"><script>alert(1)');
    expect(none).toContain('No encontramos ningún producto');
  });
});

describe('protección', () => {
  it('sin sesión, ninguna página del asistente ni ninguna acción responde', async () => {
    const id = await createProduct(`Protegido ${fixture.tag}`);
    for (const path of ['/admin/productos/nuevo', `/admin/productos/${id}/foto`, `/admin/productos/${id}/revisar`, '/admin/stock', '/admin/visibilidad']) {
      const page = await get(path, '');
      expect(page.status, path).toBe(303);
      expect(location(page), path).toContain('/admin/login');
      const action = await post(path, { intent: 'archive', productId: id, price: '1', stock: '1' }, { cookie: '' });
      expect(action.status, path).toBe(303);
      expect(location(action), path).toContain('/admin/login');
    }
    const { data } = await serviceClient().from('products').select('status').eq('id', id).single();
    expect(data?.status).toBe('draft');
  });

  it('una cuenta común no ve ni cambia nada', async () => {
    const regular = await createAccount({});
    accounts.push(regular);
    const regularCookie = (await signInWithJar(regular)).header();
    const id = await createProduct(`Solo admin ${fixture.tag}`);
    const page = await get(`/admin/productos/${id}/precio`, regularCookie);
    expect(location(page)).toBe('/admin/sin-acceso');
    const action = await post('/admin/stock', { productId: id, intent: 'save', price: '1', stock: '1' }, { cookie: regularCookie });
    expect(location(action)).toBe('/admin/sin-acceso');
    expect((await serviceClient().from('products').select('price_ars').eq('id', id).single()).data?.price_ars).toBe(0);
  });

  it('un formulario enviado desde otro sitio se rechaza', async () => {
    const id = await createProduct(`Otro origen ${fixture.tag}`);
    const response = await post('/admin/stock', { productId: id, intent: 'save', price: '777', stock: '7' }, { origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect((await serviceClient().from('products').select('price_ars').eq('id', id).single()).data?.price_ars).toBe(0);
  });

  it.each(['no-es-un-id', '00000000-0000-4000-8000-000000000000', "1'%20or%20'1'='1"])('un producto inexistente ("%s") da 404', async (id) => {
    for (const step of ['datos', 'foto', 'precio', 'detalles', 'revisar']) {
      expect((await get(`/admin/productos/${id}/${step}`)).status, `${id}/${step}`).toBe(404);
    }
  });

  it('las acciones con ids inválidos no rompen la página', async () => {
    for (const intent of ['more', 'less', 'save']) {
      const response = await post('/admin/stock', { productId: 'no-es-un-id', intent, price: '1', stock: '1' });
      expect(response.status, intent).toBeLessThan(500);
    }
    expect((await post('/admin/visibilidad', { productId: 'no-es-un-id', intent: 'show' })).status).toBeLessThan(500);
  });
});
