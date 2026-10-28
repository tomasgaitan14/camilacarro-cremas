import { beforeAll, describe, expect, it } from 'vitest';
import { listProducts } from '../src/lib/catalog.ts';
import { filterProducts, findProduct, normalizeText } from '../src/lib/catalog-filter.ts';
import { loadCatalogSnapshot } from '../src/lib/catalog-snapshot.ts';
import type { Product } from '../src/lib/types.ts';
import { makeLine, makeProduct } from './support/factories.ts';
import { anonClient, assertSupabaseIsUp } from './support/supabase.ts';

const brandA = { id: 'ba', slug: 'marca-a', name: 'Marca A' };
const brandB = { id: 'bb', slug: 'marca-b', name: 'Marca B' };
const catLimpieza = { id: 'c1', slug: 'limpieza', name: 'Limpieza' };
const catHidratacion = { id: 'c2', slug: 'hidratacion', name: 'Hidratación' };
const line = makeLine({ slug: 'linea-x' });

const PRODUCTS: Product[] = [
  makeProduct({ id: '1', slug: 'aceite', name: 'Aceite limpiador', brand: brandA, category: catLimpieza, line }),
  makeProduct({ id: '2', slug: 'crema', name: 'Crema de Hidratación', brand: brandA, category: catHidratacion }),
  makeProduct({ id: '3', slug: 'espuma', name: 'Espuma suave', brand: brandB, category: catLimpieza }),
];
const ids = (products: Product[]) => products.map((p) => p.id);

describe('normalizeText', () => {
  it('quita acentos, mayúsculas y espacios de los bordes', () => {
    expect(normalizeText('  Hidratación Ñandú ')).toBe('hidratacion nandu');
  });
});

describe('filterProducts', () => {
  it('sin filtros devuelve todo, en el mismo orden', () => {
    expect(ids(filterProducts(PRODUCTS))).toEqual(['1', '2', '3']);
    expect(ids(filterProducts(PRODUCTS, {}))).toEqual(['1', '2', '3']);
  });

  it('filtra por marca, categoría y línea', () => {
    expect(ids(filterProducts(PRODUCTS, { brandSlug: 'marca-a' }))).toEqual(['1', '2']);
    expect(ids(filterProducts(PRODUCTS, { categorySlug: 'limpieza' }))).toEqual(['1', '3']);
    expect(ids(filterProducts(PRODUCTS, { lineSlug: 'linea-x' }))).toEqual(['1']);
  });

  it('la línea excluye los productos que no tienen línea', () => {
    expect(ids(filterProducts(PRODUCTS, { lineSlug: 'otra-linea' }))).toEqual([]);
  });

  it('combina filtros', () => {
    expect(ids(filterProducts(PRODUCTS, { brandSlug: 'marca-a', categorySlug: 'limpieza' }))).toEqual(['1']);
    expect(ids(filterProducts(PRODUCTS, { brandSlug: 'marca-b', categorySlug: 'hidratacion' }))).toEqual([]);
  });

  it('busca por nombre sin distinguir mayúsculas ni acentos', () => {
    expect(ids(filterProducts(PRODUCTS, { search: 'ACEITE' }))).toEqual(['1']);
    expect(ids(filterProducts(PRODUCTS, { search: 'hidratacion' }))).toEqual(['2']);
    expect(ids(filterProducts(PRODUCTS, { search: 'hidratación' }))).toEqual(['2']);
  });

  it('una búsqueda vacía o de espacios no filtra', () => {
    expect(ids(filterProducts(PRODUCTS, { search: '' }))).toEqual(['1', '2', '3']);
    expect(ids(filterProducts(PRODUCTS, { search: '   ' }))).toEqual(['1', '2', '3']);
  });

  it('una búsqueda sin coincidencias devuelve lista vacía', () => {
    expect(filterProducts(PRODUCTS, { search: 'zzzz' })).toEqual([]);
  });

  it('los caracteres especiales son texto literal, no comodines', () => {
    expect(filterProducts(PRODUCTS, { search: '%' })).toEqual([]);
    expect(filterProducts(PRODUCTS, { search: '_' })).toEqual([]);
  });

  it('no modifica la lista original', () => {
    const copy = [...PRODUCTS];
    filterProducts(PRODUCTS, { brandSlug: 'marca-b' });
    expect(PRODUCTS).toEqual(copy);
  });
});

describe('findProduct', () => {
  it('encuentra por slug o devuelve null', () => {
    expect(findProduct(PRODUCTS, 'crema')?.id).toBe('2');
    expect(findProduct(PRODUCTS, 'no-existe')).toBeNull();
  });
});

describe('paridad con la base real', () => {
  // La caché filtra en memoria lo que antes filtraba Postgres: tienen que dar lo mismo
  let all: Product[];
  beforeAll(async () => {
    await assertSupabaseIsUp();
    all = (await loadCatalogSnapshot(anonClient())).products;
  });

  it.each([
    [{ brandSlug: 'skin1004' }],
    [{ categorySlug: 'limpieza' }],
    [{ categorySlug: 'hidratacion' }],
    [{ lineSlug: 'madagascar-centella' }],
    [{ search: 'ampoule' }],
    [{ search: 'AMPOULE' }],
    [{ search: 'cream' }],
    [{ categorySlug: 'limpieza', search: 'foam' }],
    [{ brandSlug: 'skin1004', categorySlug: 'proteccion-solar', lineSlug: 'madagascar-centella' }],
    [{ search: 'zzzz-no-existe' }],
    // sin filtros de texto ni categoría, acotado a la marca del seed: otros tests crean productos temporales en paralelo
    [{ brandSlug: 'skin1004', search: '' }],
  ])('filtrar en memoria da lo mismo que consultar la base: %j', async (filters) => {
    const fromDb = await listProducts(anonClient(), filters);
    expect(ids(filterProducts(all, filters))).toEqual(ids(fromDb));
  });
});

describe('loadCatalogSnapshot', () => {
  it('trae productos publicados, marcas y categorías en una sola carga', async () => {
    await assertSupabaseIsUp();
    const snapshot = await loadCatalogSnapshot(anonClient());
    expect(snapshot.products.length).toBeGreaterThan(0);
    expect(snapshot.products.every((p) => p.status === 'published')).toBe(true);
    expect(snapshot.brands.length).toBeGreaterThan(0);
    expect(snapshot.categories.length).toBeGreaterThan(0);
  });
});
