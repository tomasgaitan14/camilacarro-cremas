import { describe, expect, it } from 'vitest';
import { buildCartCatalog, fetchCartCatalog, isCartCatalog } from '../src/lib/cart-catalog.ts';
import { CatalogLoadError, WhatsAppError } from '../src/lib/errors.ts';
import { makeEntry, makeProduct } from './support/factories.ts';

const NUMBER = '5493444000000';

const image = (kind: 'main' | 'detail', url: string, position: number) => ({
  id: url,
  url,
  alt: `alt ${url}`,
  position,
  kind,
});

describe('buildCartCatalog', () => {
  it('toma lo necesario para el carrito y normaliza el número', () => {
    const catalog = buildCartCatalog([makeProduct({ id: 'a', slug: 'aceite', name: 'Aceite', priceArs: 500, stock: 2 })], '+54 9 3444 000000');
    expect(catalog.whatsappNumber).toBe(NUMBER);
    expect(catalog.products).toEqual([
      { id: 'a', slug: 'aceite', name: 'Aceite', brandName: 'Marca', priceArs: 500, stock: 2, imageUrl: null, imageAlt: 'Aceite' },
    ]);
  });

  it('prefiere la imagen principal aunque no sea la primera', () => {
    const [entry] = buildCartCatalog(
      [makeProduct({ images: [image('detail', 'http://x/detalle.webp', 0), image('main', 'http://x/principal.webp', 1)] })],
      NUMBER,
    ).products;
    expect(entry.imageUrl).toBe('http://x/principal.webp');
  });

  it('sin imagen principal usa la primera disponible', () => {
    const [entry] = buildCartCatalog([makeProduct({ images: [image('detail', 'http://x/detalle.webp', 0)] })], NUMBER).products;
    expect(entry.imageUrl).toBe('http://x/detalle.webp');
  });

  it('rechaza un número de WhatsApp inválido o vacío', () => {
    expect(() => buildCartCatalog([], '')).toThrow(WhatsAppError);
    expect(() => buildCartCatalog([], 'no-es-un-numero')).toThrow(WhatsAppError);
  });
});

describe('isCartCatalog', () => {
  const valid = { whatsappNumber: NUMBER, products: [makeEntry()] };

  it('acepta un catálogo válido, incluso vacío', () => {
    expect(isCartCatalog(valid)).toBe(true);
    expect(isCartCatalog({ whatsappNumber: NUMBER, products: [] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['texto', 'x'],
    ['sin productos', { whatsappNumber: NUMBER }],
    ['sin número', { products: [] }],
    ['productos que no son lista', { whatsappNumber: NUMBER, products: {} }],
    ['precio con decimales', { whatsappNumber: NUMBER, products: [makeEntry({ priceArs: 10.5 })] }],
    ['precio negativo', { whatsappNumber: NUMBER, products: [makeEntry({ priceArs: -1 })] }],
    ['stock negativo', { whatsappNumber: NUMBER, products: [makeEntry({ stock: -1 })] }],
    ['stock como texto', { whatsappNumber: NUMBER, products: [{ ...makeEntry(), stock: '3' }] }],
    ['producto sin nombre', { whatsappNumber: NUMBER, products: [{ ...makeEntry(), name: undefined }] }],
    ['un producto inválido entre válidos', { whatsappNumber: NUMBER, products: [makeEntry(), null] }],
  ])('rechaza: %s', (_label, value) => {
    expect(isCartCatalog(value)).toBe(false);
  });
});

describe('fetchCartCatalog', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('devuelve el catálogo si la respuesta es válida', async () => {
    const body = { whatsappNumber: NUMBER, products: [makeEntry()] };
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      return json(body);
    }) as unknown as typeof fetch;

    expect(await fetchCartCatalog(fake, '/api/cart-catalog.json')).toEqual(body);
    expect(calls).toEqual(['/api/cart-catalog.json']);
  });

  it('falla con CatalogLoadError si no hay red', async () => {
    const fake = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(fetchCartCatalog(fake)).rejects.toBeInstanceOf(CatalogLoadError);
  });

  it.each([404, 500, 502])('falla con CatalogLoadError ante HTTP %s', async (status) => {
    const fake = (async () => json({ error: 'x' }, status)) as unknown as typeof fetch;
    await expect(fetchCartCatalog(fake)).rejects.toBeInstanceOf(CatalogLoadError);
  });

  it('no confía en un cuerpo válido si el HTTP no fue exitoso (por ejemplo, una página de caché o un proxy)', async () => {
    const valid = { whatsappNumber: NUMBER, products: [makeEntry()] };
    const fake = (async () => json(valid, 503)) as unknown as typeof fetch;
    await expect(fetchCartCatalog(fake)).rejects.toBeInstanceOf(CatalogLoadError);
  });

  it('falla con CatalogLoadError si el JSON está roto', async () => {
    const fake = (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
    await expect(fetchCartCatalog(fake)).rejects.toBeInstanceOf(CatalogLoadError);
  });

  it('falla con CatalogLoadError si el JSON tiene otra forma', async () => {
    const fake = (async () => json({ whatsappNumber: NUMBER, products: [{ id: 1 }] })) as unknown as typeof fetch;
    await expect(fetchCartCatalog(fake)).rejects.toBeInstanceOf(CatalogLoadError);
  });
});
