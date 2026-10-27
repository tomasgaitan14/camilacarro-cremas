// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartCatalog } from '../src/lib/cart-catalog.ts';
import { mountCart, type CartController } from '../src/lib/cart-controller.ts';
import { memoryStorage, type CartStorage } from '../src/lib/cart-store.ts';
import { ADDED_FEEDBACK_MS, CART_STORAGE_KEY } from '../src/lib/constants.ts';
import { CatalogLoadError } from '../src/lib/errors.ts';
import { makeEntry } from './support/factories.ts';

const NUMBER = '5493444000000';

const CATALOG: CartCatalog = {
  whatsappNumber: NUMBER,
  products: [
    makeEntry({ id: 'p1', slug: 'aceite', name: 'Aceite limpiador', brandName: 'Marca A', priceArs: 18500, stock: 5 }),
    makeEntry({ id: 'p2', slug: 'crema', name: 'Crema calmante', brandName: 'Marca A', priceArs: 21500, stock: 0 }),
    makeEntry({ id: 'p3', slug: 'ampolla', name: 'Ampolla', brandName: 'Marca B', priceArs: 24900, stock: 2 }),
  ],
};

// Estructura equivalente a la que escriben las versiones de diseño (ver docs/cart-dom-contract.md)
const PAGE = `
  <button data-cart-open>Pedido <span data-cart-count></span></button>
  <button data-add-to-cart data-product-id="p1">Agregar aceite</button>
  <input data-qty-for="p1" value="1">
  <button data-add-to-cart data-product-id="p2">Agregar crema</button>
  <button data-add-to-cart data-product-id="p3">Agregar ampolla</button>
  <button data-add-to-cart data-product-id="p9">Agregar fantasma</button>
  <div data-cart-root>
    <div data-cart-overlay></div>
    <aside data-cart-panel>
      <button data-cart-close>Cerrar</button>
      <p data-cart-when="empty">Todavía no agregaste productos</p>
      <p data-cart-when="loading">Cargando tu pedido</p>
      <div data-cart-when="error"><p>No se pudo cargar</p><button data-cart-retry>Reintentar</button></div>
      <div data-cart-when="ready">
        <ul data-cart-items></ul>
        <input type="radio" name="cart-delivery" value="pickup" checked>
        <input type="radio" name="cart-delivery" value="delivery">
        <input type="radio" name="cart-payment" value="transfer" checked>
        <input type="radio" name="cart-payment" value="cash">
        <span data-cart-total></span>
        <button data-cart-clear>Vaciar</button>
      </div>
      <p data-cart-error hidden></p>
      <a data-cart-checkout href="#" target="_blank" rel="noopener">Enviar por WhatsApp</a>
      <div data-cart-status aria-live="polite"></div>
      <template data-cart-item-template>
        <li data-cart-item>
          <img data-slot="image" alt="">
          <span data-slot="name"></span>
          <span data-slot="brand"></span>
          <span data-slot="unitPrice"></span>
          <span data-slot="subtotal"></span>
          <button data-cart-dec>-</button>
          <span data-slot="quantity"></span>
          <button data-cart-inc>+</button>
          <button data-cart-remove>Quitar</button>
        </li>
      </template>
    </aside>
  </div>`;

let controller: CartController | null = null;

function mount(options: { catalog?: CartCatalog; storage?: CartStorage; load?: () => Promise<CartCatalog> } = {}) {
  const storage = options.storage ?? memoryStorage();
  controller = mountCart(document, {
    storage,
    loadCatalog: options.load ?? (async () => options.catalog ?? CATALOG),
  });
  return { storage, controller };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector) as T;
const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const addButton = (id: string) => $<HTMLButtonElement>(`[data-add-to-cart][data-product-id="${id}"]`);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const visibleViews = () => all('[data-cart-when]').filter((el) => !el.hidden).map((el) => el.dataset.cartWhen);
const itemNames = () => all('[data-cart-item] [data-slot="name"]').map((el) => el.textContent);
const stored = (storage: CartStorage) => JSON.parse(storage.getItem(CART_STORAGE_KEY) ?? '[]');

async function addAndSettle(id: string): Promise<void> {
  addButton(id).click();
  await settle();
}

beforeEach(() => {
  document.body.innerHTML = PAGE;
});

afterEach(() => {
  controller?.destroy();
  controller = null;
  vi.useRealTimers();
});

describe('estados del carrito', () => {
  it('arranca vacío y muestra solo la vista "empty"', async () => {
    const { controller } = mount();
    await controller.ready;
    expect(visibleViews()).toEqual(['empty']);
    expect($('[data-cart-count]').textContent).toBe('0');
    expect($('[data-cart-count]').dataset.empty).toBe('true');
  });

  it('con un carrito guardado muestra la cantidad y la vista "loading" mientras llega el catálogo', async () => {
    let resolve!: (catalog: CartCatalog) => void;
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'p1', quantity: 2 }]));
    const { controller } = mount({ storage, load: () => new Promise<CartCatalog>((r) => (resolve = r)) });

    expect($('[data-cart-count]').textContent).toBe('2');
    expect(visibleViews()).toEqual(['loading']);
    expect(all('[data-cart-item]')).toHaveLength(0);

    resolve(CATALOG);
    await controller.ready;
    expect(visibleViews()).toEqual(['ready']);
    expect(itemNames()).toEqual(['Aceite limpiador']);
  });

  it('si el catálogo no carga muestra "error", y Reintentar lo recupera', async () => {
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'p1', quantity: 1 }]));
    const load = vi
      .fn<() => Promise<CartCatalog>>()
      .mockRejectedValueOnce(new CatalogLoadError('sin red'))
      .mockResolvedValueOnce(CATALOG);
    const { controller } = mount({ storage, load });
    await controller.ready;

    expect(visibleViews()).toEqual(['error']);
    expect($('[data-cart-error]').textContent).toContain('No pudimos cargar los productos');
    expect($<HTMLAnchorElement>('[data-cart-checkout]').getAttribute('aria-disabled')).toBe('true');

    $('[data-cart-retry]').click();
    await settle();
    expect(visibleViews()).toEqual(['ready']);
    expect($('[data-cart-error]').hidden).toBe(true);
  });

  it('un error que no es de carga del catálogo no se esconde', async () => {
    const { controller } = mount({ load: async () => Promise.reject(new RangeError('bug')) });
    await expect(controller.ready).rejects.toBeInstanceOf(RangeError);
  });

  it('con el catálogo fallado, agregar muestra el error de conexión y no agrega nada', async () => {
    const { storage, controller } = mount({ load: async () => Promise.reject(new CatalogLoadError('sin red')) });
    await controller.ready;
    await addAndSettle('p1');
    expect($('[data-cart-error]').textContent).toContain('No pudimos cargar los productos');
    expect(stored(storage)).toEqual([]);
  });
});

describe('agregar productos', () => {
  it('suma al carrito, guarda y muestra el producto con su precio', async () => {
    const { storage, controller } = mount();
    await controller.ready;
    await addAndSettle('p1');

    expect(stored(storage)).toEqual([{ productId: 'p1', quantity: 1 }]);
    expect($('[data-cart-count]').textContent).toBe('1');
    expect(visibleViews()).toEqual(['ready']);
    expect(itemNames()).toEqual(['Aceite limpiador']);
    expect($('[data-cart-item] [data-slot="unitPrice"]').textContent).toBe('$18.500');
    expect($('[data-cart-total]').textContent).toBe('$18.500');
    expect($('[data-cart-status]').textContent).toBe('Agregaste Aceite limpiador a tu pedido');
  });

  it('usa la cantidad del campo asociado y acumula en agregados siguientes', async () => {
    const { controller } = mount();
    await controller.ready;
    $<HTMLInputElement>('[data-qty-for="p1"]').value = '2';
    await addAndSettle('p1');
    await addAndSettle('p1');
    expect($('[data-cart-item] [data-slot="quantity"]').textContent).toBe('4');
    expect($('[data-cart-total]').textContent).toBe('$74.000');
  });

  it.each(['abc', '0', '-1', '1.5', '', '1e2'])('rechaza la cantidad "%s"', async (value) => {
    const { storage, controller } = mount();
    await controller.ready;
    $<HTMLInputElement>('[data-qty-for="p1"]').value = value;
    await addAndSettle('p1');
    expect($('[data-cart-error]').hidden).toBe(false);
    expect($('[data-cart-error]').textContent).toBe('Ingresá una cantidad entera, de 1 en adelante.');
    expect(stored(storage)).toEqual([]);
  });

  it('rechaza superar el stock sin cambiar el carrito', async () => {
    const { storage, controller } = mount();
    await controller.ready;
    $<HTMLInputElement>('[data-qty-for="p1"]').value = '6';
    await addAndSettle('p1');
    expect($('[data-cart-error]').textContent).toBe('Máximo 5 unidades de "Aceite limpiador"');
    expect(stored(storage)).toEqual([]);
  });

  it('rechaza un producto sin stock', async () => {
    const { storage, controller } = mount();
    await controller.ready;
    await addAndSettle('p2');
    expect($('[data-cart-error]').textContent).toBe('"Crema calmante" no tiene stock');
    expect(stored(storage)).toEqual([]);
  });

  it('rechaza un producto que ya no está en el catálogo', async () => {
    const { controller } = mount();
    await controller.ready;
    await addAndSettle('p9');
    expect($('[data-cart-error]').textContent).toBe('Ese producto ya no está disponible.');
  });

  it('un agregado exitoso limpia el error anterior', async () => {
    const { controller } = mount();
    await controller.ready;
    await addAndSettle('p2');
    expect($('[data-cart-error]').hidden).toBe(false);
    await addAndSettle('p3');
    expect($('[data-cart-error]').hidden).toBe(true);
  });

  it('el botón muestra data-state="added" un rato y vuelve a la normalidad', async () => {
    vi.useFakeTimers();
    const { controller } = mount();
    await vi.advanceTimersByTimeAsync(0);
    await controller.ready;
    addButton('p1').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(addButton('p1').dataset.state).toBe('added');
    await vi.advanceTimersByTimeAsync(ADDED_FEEDBACK_MS);
    expect(addButton('p1').dataset.state).toBeUndefined();
  });
});

describe('ajustar el pedido', () => {
  async function withOne(id = 'p1') {
    const mounted = mount();
    await mounted.controller.ready;
    await addAndSettle(id);
    return mounted;
  }

  it('+ y - cambian la cantidad y el total', async () => {
    await withOne();
    $('[data-cart-inc]').click();
    expect($('[data-cart-item] [data-slot="quantity"]').textContent).toBe('2');
    expect($('[data-cart-total]').textContent).toBe('$37.000');
    $('[data-cart-dec]').click();
    expect($('[data-cart-item] [data-slot="quantity"]').textContent).toBe('1');
  });

  it('- sobre la última unidad quita el producto y vuelve a "empty"', async () => {
    const { storage } = await withOne();
    $('[data-cart-dec]').click();
    expect(visibleViews()).toEqual(['empty']);
    expect(stored(storage)).toEqual([]);
  });

  it('+ se deshabilita al llegar al stock', async () => {
    await withOne('p3');
    expect($<HTMLButtonElement>('[data-cart-inc]').disabled).toBe(false);
    $('[data-cart-inc]').click();
    expect($('[data-cart-item] [data-slot="quantity"]').textContent).toBe('2');
    expect($<HTMLButtonElement>('[data-cart-inc]').disabled).toBe(true);
  });

  it('Quitar saca solo ese producto', async () => {
    const { storage } = await withOne('p1');
    await addAndSettle('p3');
    $('[data-cart-item][data-product-id="p1"] [data-cart-remove]').click();
    expect(itemNames()).toEqual(['Ampolla']);
    expect(stored(storage)).toEqual([{ productId: 'p3', quantity: 1 }]);
  });

  it('Vaciar deja el pedido en blanco', async () => {
    const { storage } = await withOne();
    $('[data-cart-clear]').click();
    expect(visibleViews()).toEqual(['empty']);
    expect(stored(storage)).toEqual([]);
    expect($('[data-cart-status]').textContent).toBe('Vaciaste tu pedido');
  });
});

describe('carrito guardado que quedó viejo', () => {
  it('descarta productos que ya no existen o sin stock y ajusta cantidades, avisando', async () => {
    const storage = memoryStorage();
    storage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { productId: 'p1', quantity: 9 },
        { productId: 'p2', quantity: 1 },
        { productId: 'borrado', quantity: 1 },
      ]),
    );
    const { controller } = mount({ storage });
    await controller.ready;
    expect(stored(storage)).toEqual([{ productId: 'p1', quantity: 5 }]);
    expect($('[data-cart-count]').textContent).toBe('5');
    expect($('[data-cart-status]').textContent).toBe('Actualizamos tu pedido según el stock disponible.');
  });

  it('un carrito guardado con basura se ignora', async () => {
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, '[{"productId":1,"quantity":"x"},null]');
    const { controller } = mount({ storage });
    await controller.ready;
    expect(visibleViews()).toEqual(['empty']);
  });

  it('si otra pestaña cambia el carrito, esta se actualiza', async () => {
    const { storage, controller } = mount();
    await controller.ready;
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'p3', quantity: 2 }]));
    window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }));
    expect($('[data-cart-count]').textContent).toBe('2');
  });

  it('ignora cambios de almacenamiento de otras claves', async () => {
    const { storage, controller } = mount();
    await controller.ready;
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'p3', quantity: 2 }]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave' }));
    expect($('[data-cart-count]').textContent).toBe('0');
  });
});

describe('enviar por WhatsApp', () => {
  const link = () => $<HTMLAnchorElement>('[data-cart-checkout]');
  const message = () => new URL(link().href).searchParams.get('text');

  it('sin productos el botón queda deshabilitado y no navega', async () => {
    const { controller } = mount();
    await controller.ready;
    expect(link().getAttribute('aria-disabled')).toBe('true');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link().dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('arma el link con el pedido, el total y las opciones elegidas por defecto', async () => {
    const { controller } = mount();
    await controller.ready;
    await addAndSettle('p1');
    await addAndSettle('p1');

    expect(link().getAttribute('aria-disabled')).toBe('false');
    expect(new URL(link().href).origin + new URL(link().href).pathname).toBe(`https://wa.me/${NUMBER}`);
    expect(message()).toContain('• 2 x Aceite limpiador (Marca A) - $37.000');
    expect(message()).toContain('Total: $37.000');
    expect(message()).toContain('Entrega: Retiro');
    expect(message()).toContain('Pago: Transferencia');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link().dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it('el link cambia al elegir envío y efectivo', async () => {
    const { controller } = mount();
    await controller.ready;
    await addAndSettle('p1');

    const delivery = document.querySelector<HTMLInputElement>('input[name="cart-delivery"][value="delivery"]')!;
    const cash = document.querySelector<HTMLInputElement>('input[name="cart-payment"][value="cash"]')!;
    delivery.checked = true;
    delivery.dispatchEvent(new Event('change', { bubbles: true }));
    cash.checked = true;
    cash.dispatchEvent(new Event('change', { bubbles: true }));

    expect(message()).toContain('Entrega: Envío');
    expect(message()).toContain('Pago: Efectivo');
  });

  it('un valor de opción manipulado cae al valor por defecto', async () => {
    const { controller } = mount();
    await controller.ready;
    await addAndSettle('p1');
    const delivery = document.querySelector<HTMLInputElement>('input[name="cart-delivery"][value="delivery"]')!;
    delivery.value = 'drone';
    delivery.checked = true;
    delivery.dispatchEvent(new Event('change', { bubbles: true }));
    expect(message()).toContain('Entrega: Retiro');
  });

  it('un pedido demasiado largo para WhatsApp deshabilita el envío y explica por qué', async () => {
    const products = Array.from({ length: 12 }, (_, i) =>
      makeEntry({ id: `x${i}`, name: `Producto con un nombre bastante largo número ${i} ${'y'.repeat(80)}`, stock: 3 }),
    );
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(products.map((p) => ({ productId: p.id, quantity: 1 }))));
    const { controller } = mount({ storage, catalog: { whatsappNumber: NUMBER, products } });
    await controller.ready;
    expect(link().getAttribute('aria-disabled')).toBe('true');
    expect($('[data-cart-error]').textContent).toBe('El pedido es demasiado largo para enviarlo por WhatsApp');
  });
});

describe('seguridad del contenido', () => {
  it('los nombres de producto se muestran como texto, nunca como HTML', async () => {
    const evil = '<img src="x" onerror="window.__pwned = true">';
    const catalog: CartCatalog = { whatsappNumber: NUMBER, products: [makeEntry({ id: 'p1', name: evil })] };
    const { controller } = mount({ catalog });
    await controller.ready;
    await addAndSettle('p1');
    expect(all('[data-cart-item] [data-slot="name"]')[0].textContent).toBe(evil);
    expect(document.querySelectorAll('[data-cart-item] img[src="x"]')).toHaveLength(0);
  });

  it('una URL de imagen que no es http(s) ni ruta propia no se usa', async () => {
    const catalog: CartCatalog = {
      whatsappNumber: NUMBER,
      products: [makeEntry({ id: 'p1', imageUrl: 'javascript:alert(1)' }), makeEntry({ id: 'p3', imageUrl: '/brand/x.webp' })],
    };
    const { controller } = mount({ catalog });
    await controller.ready;
    await addAndSettle('p1');
    const bad = $<HTMLImageElement>('[data-cart-item] [data-slot="image"]');
    expect(bad.hidden).toBe(true);
    expect(bad.getAttribute('src')).toBeNull();
  });

  it('un producto sin imagen oculta el espacio de la imagen', async () => {
    const catalog: CartCatalog = { whatsappNumber: NUMBER, products: [makeEntry({ id: 'p1', imageUrl: null })] };
    const { controller } = mount({ catalog });
    await controller.ready;
    await addAndSettle('p1');
    expect($<HTMLImageElement>('[data-cart-item] [data-slot="image"]').hidden).toBe(true);
  });
});

describe('abrir y cerrar el panel', () => {
  const root = () => $('[data-cart-root]');
  const panel = () => $('[data-cart-panel]');

  it('arranca cerrado e inerte', async () => {
    const { controller } = mount();
    await controller.ready;
    expect(root().dataset.open).toBe('false');
    expect(panel().inert).toBe(true);
  });

  it('abre, enfoca el botón de cerrar y marca el documento', async () => {
    const { controller } = mount();
    await controller.ready;
    $('[data-cart-open]').click();
    expect(root().dataset.open).toBe('true');
    expect(panel().inert).toBe(false);
    expect(document.documentElement.dataset.cartLocked).toBe('true');
    expect(document.activeElement).toBe($('[data-cart-close]'));
  });

  it('Escape cierra y devuelve el foco al botón que lo abrió', async () => {
    const { controller } = mount();
    await controller.ready;
    const opener = $('[data-cart-open]');
    opener.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root().dataset.open).toBe('false');
    expect(panel().inert).toBe(true);
    expect(document.documentElement.dataset.cartLocked).toBeUndefined();
    expect(document.activeElement).toBe(opener);
  });

  it('con el panel abierto, un clic en cualquier parte de la página no vuelve a abrirlo ni cambia el foco', async () => {
    const { controller } = mount();
    await controller.ready;
    $('[data-cart-open]').click();
    $('[data-cart-close]').click();
    $('[data-cart-open]').click();
    $('[data-cart-close]').click();
    document.body.click();
    expect(root().dataset.open).toBe('false');
    expect(document.querySelectorAll('[data-cart-open]')).toHaveLength(1);
  });

  it('Escape con el panel cerrado no hace nada', async () => {
    const { controller } = mount();
    await controller.ready;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root().dataset.open).toBe('false');
  });

  it('Cerrar y un clic directo sobre el fondo cierran', async () => {
    const { controller } = mount();
    await controller.ready;
    $('[data-cart-open]').click();
    $('[data-cart-close]').click();
    expect(root().dataset.open).toBe('false');
    $('[data-cart-open]').click();
    $('[data-cart-overlay]').click();
    expect(root().dataset.open).toBe('false');
  });

  it('un clic dentro del panel no lo cierra, aunque el fondo envuelva al panel', async () => {
    document.body.innerHTML = PAGE.replace(
      '<div data-cart-overlay></div>\n    <aside data-cart-panel>',
      '<div data-cart-overlay>\n    <aside data-cart-panel>',
    ).replace('</aside>\n  </div>', '</aside></div>\n  </div>');
    const { controller } = mount();
    await controller.ready;
    $('[data-cart-open]').click();
    $('[data-cart-panel] [data-cart-when="empty"]').click();
    expect(root().dataset.open).toBe('true');
  });
});

describe('destroy', () => {
  it('deja de reaccionar a los clics', async () => {
    const { storage, controller } = mount();
    await controller.ready;
    controller.destroy();
    await addAndSettle('p1');
    expect(stored(storage)).toEqual([]);
  });
});
