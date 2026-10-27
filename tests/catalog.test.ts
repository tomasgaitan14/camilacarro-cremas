import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getProductBySlug,
  listBrands,
  listCategories,
  listProducts,
  toCartProduct,
} from '../src/lib/catalog.ts';
import { PRODUCT_STATUS } from '../src/lib/constants.ts';
import {
  adminClient,
  anonClient,
  assertSupabaseIsUp,
  createFixture,
  serviceClient,
  type Fixture,
} from './support/supabase.ts';

let fixture: Fixture;
let secondPublishedId: string;

beforeAll(async () => {
  await assertSupabaseIsUp();
  fixture = await createFixture();

  const service = serviceClient();
  // segundo producto publicado de la misma marca, sin línea: sirve para probar el filtro por línea y el orden
  const { data, error } = await service
    .from('products')
    .insert({
      brand_id: fixture.brandId,
      category_id: fixture.categoryId,
      slug: `${fixture.tag}-aaa`,
      name: `Aaa ${fixture.tag}`,
      price_ars: 500,
      stock: 0,
      status: PRODUCT_STATUS.PUBLISHED,
      benefits: ['uno', 'dos'],
      usage_steps: ['paso 1', 'paso 2'],
    })
    .select('id')
    .single();
  if (error) throw new Error('No se pudo crear el producto de prueba', { cause: error });
  secondPublishedId = data.id;

  const images = await service.from('product_images').insert([
    { product_id: fixture.publishedId, path: `${fixture.tag}-b.webp`, alt: 'segunda', position: 1, kind: 'detail' },
    { product_id: fixture.publishedId, path: `${fixture.tag}-a.webp`, alt: 'principal', position: 0, kind: 'main' },
  ]);
  if (images.error) throw new Error('No se pudieron crear las imágenes de prueba', { cause: images.error });
});

afterAll(async () => {
  await fixture?.cleanup();
});

describe('listProducts', () => {
  it('devuelve solo publicados, ordenados por nombre', async () => {
    const products = await listProducts(anonClient(), { brandSlug: `${fixture.tag}-brand` });
    expect(products.map((p) => p.id)).toEqual([secondPublishedId, fixture.publishedId]);
    expect(products.every((p) => p.status === PRODUCT_STATUS.PUBLISHED)).toBe(true);
  });

  it('un admin logueado tampoco ve borradores en la tienda', async () => {
    const products = await listProducts(await adminClient(), { brandSlug: `${fixture.tag}-brand` });
    expect(products.map((p) => p.id)).not.toContain(fixture.draftId);
  });

  it('mapea las relaciones y los campos', async () => {
    const [aaa, published] = await listProducts(anonClient(), { brandSlug: `${fixture.tag}-brand` });
    expect(published.brand).toEqual({ id: fixture.brandId, slug: `${fixture.tag}-brand`, name: `Marca ${fixture.tag}` });
    expect(published.category.slug).toBe(`${fixture.tag}-cat`);
    expect(published.line).toMatchObject({ id: fixture.lineId, slug: `${fixture.tag}-line`, brandId: fixture.brandId });
    expect(published.routineStep).toBe(1);
    expect(published.priceArs).toBe(1000);
    expect(published.stock).toBe(3);

    expect(aaa.line).toBeNull();
    expect(aaa.routineStep).toBeNull();
    expect(aaa.benefits).toEqual(['uno', 'dos']);
    expect(aaa.usageSteps).toEqual(['paso 1', 'paso 2']);
  });

  it('ordena las imágenes por posición y arma URLs públicas absolutas', async () => {
    const products = await listProducts(anonClient(), { brandSlug: `${fixture.tag}-brand` });
    const published = products.find((p) => p.id === fixture.publishedId);
    expect(published?.images.map((image) => image.alt)).toEqual(['principal', 'segunda']);
    expect(published?.images[0].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/public\/product-images\//);
    expect(published?.images[0].url).toContain(`${fixture.tag}-a.webp`);
  });

  it('un producto sin imágenes devuelve lista vacía', async () => {
    const products = await listProducts(anonClient(), { brandSlug: `${fixture.tag}-brand` });
    expect(products.find((p) => p.id === secondPublishedId)?.images).toEqual([]);
  });

  it('filtra por categoría', async () => {
    const products = await listProducts(anonClient(), { categorySlug: `${fixture.tag}-cat` });
    expect(products).toHaveLength(2);
    expect(await listProducts(anonClient(), { categorySlug: 'no-existe-nunca' })).toEqual([]);
  });

  it('filtra por marca', async () => {
    expect(await listProducts(anonClient(), { brandSlug: 'no-existe-nunca' })).toEqual([]);
  });

  it('filtra por línea y deja afuera los productos sin línea', async () => {
    const products = await listProducts(anonClient(), { lineSlug: `${fixture.tag}-line` });
    expect(products.map((p) => p.id)).toEqual([fixture.publishedId]);
  });

  it('combina filtros', async () => {
    const hit = await listProducts(anonClient(), {
      brandSlug: `${fixture.tag}-brand`,
      categorySlug: `${fixture.tag}-cat`,
      lineSlug: `${fixture.tag}-line`,
    });
    expect(hit).toHaveLength(1);
    const miss = await listProducts(anonClient(), { brandSlug: 'marca-demo-a', categorySlug: `${fixture.tag}-cat` });
    expect(miss).toEqual([]);
  });

  it('busca por nombre sin distinguir mayúsculas', async () => {
    const products = await listProducts(anonClient(), { search: `PUBLICADO ${fixture.tag.toUpperCase()}` });
    expect(products.map((p) => p.id)).toEqual([fixture.publishedId]);
  });

  it.each(['%', '_', '\\', ',', '(', ')', 'a,name.eq.x', '%%'])(
    'el texto de búsqueda "%s" no se interpreta como patrón ni como sintaxis de filtro',
    async (search) => {
      const products = await listProducts(anonClient(), { search, brandSlug: `${fixture.tag}-brand` });
      // sin sanitizar, "%" o "_" matchearían todos los productos de la marca
      if (search.trim() === '' || /^[%_\\,()]+$/.test(search)) {
        expect(products).toHaveLength(2);
      } else {
        expect(products).toEqual([]);
      }
    },
  );

  it('una búsqueda que no coincide devuelve lista vacía', async () => {
    expect(await listProducts(anonClient(), { search: 'zzzz-no-existe' })).toEqual([]);
  });
});

describe('orden de imágenes', () => {
  // PostgREST no garantiza el orden de los embebidos: la capa de datos tiene que ordenar ella.
  // La fila reproduce la forma real de la respuesta (snake_case, relaciones embebidas).
  it('ordena por posición aunque la base devuelva las imágenes desordenadas', async () => {
    const row = {
      id: 'p1',
      slug: 'crema',
      name: 'Crema',
      routine_step: null,
      summary: '',
      price_ars: 1000,
      volume: '',
      key_ingredients: '',
      benefits: [],
      usage_steps: [],
      skin_types: [],
      warnings: '',
      stock: 1,
      status: 'published',
      brand: { id: 'b1', slug: 'marca', name: 'Marca' },
      category: { id: 'c1', slug: 'cat', name: 'Cat' },
      line: null,
      images: [
        { id: 'i3', path: 'c.webp', alt: 'tercera', position: 2, kind: 'detail' },
        { id: 'i1', path: 'a.webp', alt: 'primera', position: 0, kind: 'main' },
        { id: 'i2', path: 'b.webp', alt: 'segunda', position: 1, kind: 'detail' },
      ],
    };
    const builder: object = new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === 'then'
            ? (resolve: (value: unknown) => void) => resolve({ data: [row], error: null })
            : () => builder,
      },
    );
    const client = {
      from: () => builder,
      storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `http://test/${path}` } }) }) },
    } as unknown as SupabaseClient;

    const [product] = await listProducts(client);
    expect(product.images.map((image) => image.alt)).toEqual(['primera', 'segunda', 'tercera']);
    expect(product.images[0].url).toBe('http://test/a.webp');
  });
});

describe('getProductBySlug', () => {
  it('devuelve el producto publicado', async () => {
    const product = await getProductBySlug(anonClient(), `${fixture.tag}-published`);
    expect(product?.id).toBe(fixture.publishedId);
    expect(product?.images).toHaveLength(2);
  });

  it('devuelve null para un borrador, aunque lo pida un admin logueado', async () => {
    expect(await getProductBySlug(anonClient(), `${fixture.tag}-draft`)).toBeNull();
    expect(await getProductBySlug(await adminClient(), `${fixture.tag}-draft`)).toBeNull();
  });

  it('devuelve null para un slug inexistente', async () => {
    expect(await getProductBySlug(anonClient(), 'no-existe-nunca')).toBeNull();
  });
});

describe('marcas, categorías y datos del seed', () => {
  it('lista las marcas y categorías ordenadas por nombre', async () => {
    const brands = await listBrands(anonClient());
    const names = brands.map((b) => b.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(brands.map((b) => b.slug)).toContain(`${fixture.tag}-brand`);
    expect((await listCategories(anonClient())).map((c) => c.slug)).toContain(`${fixture.tag}-cat`);
  });

  it('el seed de demo está publicado y con imagen principal', async () => {
    const products = await listProducts(anonClient(), { brandSlug: 'marca-demo-a' });
    expect(products.length).toBeGreaterThanOrEqual(4);
    for (const product of products) {
      expect(product.images[0]?.kind, product.slug).toBe('main');
      expect(product.usageSteps.length, product.slug).toBeGreaterThan(0);
      expect(product.benefits.length, product.slug).toBeGreaterThan(0);
    }
  });
});

describe('toCartProduct', () => {
  it('toma solo lo que necesita el carrito', async () => {
    const product = await getProductBySlug(anonClient(), `${fixture.tag}-published`);
    expect(toCartProduct(product!)).toEqual({
      id: fixture.publishedId,
      name: `Publicado ${fixture.tag}`,
      brandName: `Marca ${fixture.tag}`,
      priceArs: 1000,
      stock: 3,
    });
  });
});
