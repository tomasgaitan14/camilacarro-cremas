import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STORAGE_BUCKET } from '../src/lib/constants.ts';
import {
  adminClient,
  anonClient,
  assertSupabaseIsUp,
  createFixture,
  createRegularUser,
  serviceClient,
  type Fixture,
  type TestUser,
} from './support/supabase.ts';

// PostgreSQL: 23514 = check_violation, 23505 = unique_violation
const PG_CHECK_VIOLATION = '23514';
const PG_UNIQUE_VIOLATION = '23505';

const TINY_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

let fixture: Fixture;
let admin: SupabaseClient;
let regular: TestUser;
const uploadedPaths: string[] = [];

beforeAll(async () => {
  await assertSupabaseIsUp();
  fixture = await createFixture();
  admin = await adminClient();
  regular = await createRegularUser();
});

afterAll(async () => {
  if (uploadedPaths.length > 0) await serviceClient().storage.from(STORAGE_BUCKET).remove(uploadedPaths);
  await fixture?.cleanup();
  await regular?.remove();
});

function newProduct(suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    brand_id: fixture.brandId,
    category_id: fixture.categoryId,
    slug: `${fixture.tag}-${suffix}`,
    name: `Producto ${suffix}`,
    price_ars: 1000,
    ...overrides,
  };
}

describe('lectura pública', () => {
  it('un anónimo ve los publicados y no los borradores', async () => {
    const { data, error } = await anonClient().from('products').select('id, status').eq('brand_id', fixture.brandId);
    expect(error).toBeNull();
    expect(data?.map((row) => row.id)).toEqual([fixture.publishedId]);
  });

  it('un anónimo no puede pedir un borrador por id', async () => {
    const { data } = await anonClient().from('products').select('id').eq('id', fixture.draftId);
    expect(data).toEqual([]);
  });

  it('un usuario logueado sin rol admin tampoco ve borradores', async () => {
    const { data } = await regular.client.from('products').select('id').eq('brand_id', fixture.brandId);
    expect(data?.map((row) => row.id)).toEqual([fixture.publishedId]);
  });

  it('un archivado no es público', async () => {
    const service = serviceClient();
    const { data: archived } = await service
      .from('products')
      .insert(newProduct('archived', { status: 'archived' }))
      .select('id')
      .single();
    const { data } = await anonClient().from('products').select('id').eq('id', archived?.id);
    expect(data).toEqual([]);
  });

  it('el admin ve también los borradores', async () => {
    const { data } = await admin.from('products').select('id').eq('brand_id', fixture.brandId);
    expect(data?.map((row) => row.id)).toContain(fixture.draftId);
  });

  it('marcas, categorías y líneas son públicas', async () => {
    const anon = anonClient();
    expect((await anon.from('brands').select('id').eq('id', fixture.brandId)).data).toHaveLength(1);
    expect((await anon.from('categories').select('id').eq('id', fixture.categoryId)).data).toHaveLength(1);
    expect((await anon.from('product_lines').select('id').eq('id', fixture.lineId)).data).toHaveLength(1);
  });
});

describe('imágenes de producto', () => {
  beforeAll(async () => {
    const { error } = await serviceClient()
      .from('product_images')
      .insert([
        { product_id: fixture.publishedId, path: `${fixture.tag}-pub.webp`, kind: 'main', position: 0 },
        { product_id: fixture.draftId, path: `${fixture.tag}-draft.webp`, kind: 'main', position: 0 },
      ]);
    if (error) throw new Error('No se pudieron crear las imágenes de prueba', { cause: error });
  });

  it('las imágenes de un borrador no son visibles para el público', async () => {
    const { data } = await anonClient().from('product_images').select('product_id').in('product_id', [fixture.publishedId, fixture.draftId]);
    expect(data?.map((row) => row.product_id)).toEqual([fixture.publishedId]);
  });

  it('no permite dos imágenes principales en el mismo producto', async () => {
    const { error } = await serviceClient()
      .from('product_images')
      .insert({ product_id: fixture.publishedId, path: `${fixture.tag}-second-main.webp`, kind: 'main', position: 1 });
    expect(error?.code).toBe(PG_UNIQUE_VIOLATION);
  });

  it('no permite repetir la posición dentro de un producto', async () => {
    const { error } = await serviceClient()
      .from('product_images')
      .insert({ product_id: fixture.publishedId, path: `${fixture.tag}-dup-pos.webp`, kind: 'detail', position: 0 });
    expect(error?.code).toBe(PG_UNIQUE_VIOLATION);
  });

  it('rechaza un tipo de imagen desconocido', async () => {
    const { error } = await serviceClient()
      .from('product_images')
      .insert({ product_id: fixture.publishedId, path: 'x.webp', kind: 'video', position: 5 });
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });
});

describe('escritura: solo el admin', () => {
  it('un anónimo no puede insertar productos', async () => {
    const { error } = await anonClient().from('products').insert(newProduct('anon-insert'));
    expect(error).not.toBeNull();
  });

  it('un usuario sin rol admin no puede insertar productos', async () => {
    const { error } = await regular.client.from('products').insert(newProduct('user-insert'));
    expect(error).not.toBeNull();
  });

  it('un usuario no puede darse el rol admin editando su propio perfil', async () => {
    const { data: before } = await regular.client.auth.getUser();
    expect(before.user?.app_metadata?.role).toBeUndefined();

    // user_metadata es editable por el usuario; app_metadata no, y la RLS solo mira app_metadata
    await regular.client.auth.updateUser({ data: { role: 'admin' } });
    await regular.client.auth.refreshSession();

    const { error } = await regular.client.from('products').insert(newProduct('self-promoted'));
    expect(error).not.toBeNull();
  });

  it('un anónimo no puede modificar el precio ni el stock', async () => {
    const anon = anonClient();
    await anon.from('products').update({ price_ars: 1, stock: 999 }).eq('id', fixture.publishedId);
    const { data } = await serviceClient().from('products').select('price_ars, stock').eq('id', fixture.publishedId).single();
    expect(data).toEqual({ price_ars: 1000, stock: 3 });
  });

  it('un anónimo no puede borrar productos', async () => {
    await anonClient().from('products').delete().eq('id', fixture.publishedId);
    const { data } = await serviceClient().from('products').select('id').eq('id', fixture.publishedId);
    expect(data).toHaveLength(1);
  });

  it('un usuario sin rol admin no puede modificar ni borrar productos', async () => {
    await regular.client.from('products').update({ price_ars: 1 }).eq('id', fixture.publishedId);
    await regular.client.from('products').delete().eq('id', fixture.publishedId);
    const { data } = await serviceClient().from('products').select('price_ars').eq('id', fixture.publishedId).single();
    expect(data?.price_ars).toBe(1000);
  });

  it('un anónimo no puede crear marcas, categorías ni imágenes', async () => {
    const anon = anonClient();
    expect((await anon.from('brands').insert({ slug: `${fixture.tag}-x`, name: 'X' })).error).not.toBeNull();
    expect((await anon.from('categories').insert({ slug: `${fixture.tag}-x`, name: 'X' })).error).not.toBeNull();
    expect(
      (await anon.from('product_images').insert({ product_id: fixture.publishedId, path: 'x.webp', position: 9 })).error,
    ).not.toBeNull();
  });

  it('el admin puede crear, editar y borrar un producto', async () => {
    const created = await admin.from('products').insert(newProduct('admin-crud')).select('id, status').single();
    expect(created.error).toBeNull();
    expect(created.data?.status).toBe('draft');

    const updated = await admin
      .from('products')
      .update({ price_ars: 2500, stock: 7, status: 'published' })
      .eq('id', created.data?.id)
      .select('price_ars, stock, status')
      .single();
    expect(updated.data).toEqual({ price_ars: 2500, stock: 7, status: 'published' });

    const removed = await admin.from('products').delete().eq('id', created.data?.id).select('id');
    expect(removed.data).toHaveLength(1);
  });

  it('updated_at avanza al editar', async () => {
    const before = await serviceClient().from('products').select('updated_at').eq('id', fixture.draftId).single();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await admin.from('products').update({ summary: 'cambio' }).eq('id', fixture.draftId);
    const after = await serviceClient().from('products').select('updated_at').eq('id', fixture.draftId).single();
    expect(new Date(after.data?.updated_at).getTime()).toBeGreaterThan(new Date(before.data?.updated_at).getTime());
  });
});

describe('validaciones de datos', () => {
  it('rechaza precio negativo', async () => {
    const { error } = await admin.from('products').insert(newProduct('neg-price', { price_ars: -1 }));
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('rechaza stock negativo', async () => {
    const { error } = await admin.from('products').insert(newProduct('neg-stock', { stock: -1 }));
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('rechaza publicar un producto sin precio', async () => {
    const { error } = await admin.from('products').insert(newProduct('free-published', { price_ars: 0, status: 'published' }));
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('permite un borrador con precio 0', async () => {
    const { error } = await admin.from('products').insert(newProduct('free-draft', { price_ars: 0 }));
    expect(error).toBeNull();
  });

  it('rechaza un estado desconocido', async () => {
    const { error } = await admin.from('products').insert(newProduct('bad-status', { status: 'oculto' }));
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('rechaza un slug duplicado', async () => {
    const { error } = await admin.from('products').insert(newProduct('published'));
    expect(error?.code).toBe(PG_UNIQUE_VIOLATION);
  });

  it.each(['Con Mayúsculas', 'con espacios', 'con_guion_bajo', '-empieza', 'termina-', 'doble--guion', '', 'ñandú'])(
    'rechaza el slug inválido "%s"',
    async (slug) => {
      const { error } = await admin.from('products').insert(newProduct('slug-test', { slug }));
      expect(error?.code).toBe(PG_CHECK_VIOLATION);
    },
  );

  it('rechaza un nombre vacío o de solo espacios', async () => {
    expect((await admin.from('products').insert(newProduct('empty-name', { name: '' }))).error?.code).toBe(PG_CHECK_VIOLATION);
    expect((await admin.from('products').insert(newProduct('blank-name', { name: '   ' }))).error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('rechaza textos demasiado largos', async () => {
    expect((await admin.from('products').insert(newProduct('long-name', { name: 'x'.repeat(121) }))).error?.code).toBe(PG_CHECK_VIOLATION);
    expect((await admin.from('products').insert(newProduct('long-summary', { summary: 'x'.repeat(401) }))).error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('rechaza más pasos de uso que el máximo', async () => {
    const steps = Array.from({ length: 13 }, (_, i) => `paso ${i}`);
    const { error } = await admin.from('products').insert(newProduct('many-steps', { usage_steps: steps }));
    expect(error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('rechaza un paso de rutina fuera de rango o sin línea', async () => {
    const outOfRange = await admin.from('products').insert(newProduct('step-0', { line_id: fixture.lineId, routine_step: 0 }));
    expect(outOfRange.error?.code).toBe(PG_CHECK_VIOLATION);
    const withoutLine = await admin.from('products').insert(newProduct('step-no-line', { routine_step: 1 }));
    expect(withoutLine.error?.code).toBe(PG_CHECK_VIOLATION);
  });

  it('no deja borrar una marca que tiene productos', async () => {
    const { error } = await admin.from('brands').delete().eq('id', fixture.brandId);
    expect(error).not.toBeNull();
  });
});

describe('storage de imágenes', () => {
  async function upload(client: SupabaseClient, name: string, contentType = 'image/png') {
    const path = `${fixture.tag}-${name}`;
    const result = await client.storage.from(STORAGE_BUCKET).upload(path, TINY_PNG, { contentType });
    if (!result.error) uploadedPaths.push(path);
    return result;
  }

  it('un anónimo no puede subir archivos', async () => {
    expect((await upload(anonClient(), 'anon.png')).error).not.toBeNull();
  });

  it('un usuario sin rol admin no puede subir archivos', async () => {
    expect((await upload(regular.client, 'user.png')).error).not.toBeNull();
  });

  it('el admin puede subir y cualquiera puede leer por la URL pública', async () => {
    const result = await upload(admin, 'admin.png');
    expect(result.error).toBeNull();

    const { publicUrl } = anonClient().storage.from(STORAGE_BUCKET).getPublicUrl(`${fixture.tag}-admin.png`).data;
    const response = await fetch(publicUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('rechaza tipos que no son imagen (por ejemplo SVG o HTML)', async () => {
    expect((await upload(admin, 'x.svg', 'image/svg+xml')).error).not.toBeNull();
    expect((await upload(admin, 'x.html', 'text/html')).error).not.toBeNull();
  });

  it('un anónimo no puede borrar archivos', async () => {
    await upload(admin, 'keep.png');
    await anonClient().storage.from(STORAGE_BUCKET).remove([`${fixture.tag}-keep.png`]);
    const response = await fetch(
      anonClient().storage.from(STORAGE_BUCKET).getPublicUrl(`${fixture.tag}-keep.png`).data.publicUrl,
    );
    expect(response.status).toBe(200);
  });
});
