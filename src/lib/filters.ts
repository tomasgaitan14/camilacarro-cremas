import { MAX_FILTER_TEXT_LENGTH } from './constants.ts';
import type { ProductFilters } from './catalog.ts';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function readSlug(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value && value.length <= MAX_FILTER_TEXT_LENGTH && SLUG_PATTERN.test(value) ? value : undefined;
}

// La query string es input del visitante: solo pasan slugs válidos y un texto de largo acotado.
export function parseCatalogFilters(params: URLSearchParams): ProductFilters {
  const search = params.get('q')?.trim().slice(0, MAX_FILTER_TEXT_LENGTH);
  return {
    brandSlug: readSlug(params, 'marca'),
    categorySlug: readSlug(params, 'categoria'),
    search: search || undefined,
  };
}

// Arma la query string del catálogo conservando los demás filtros: sirve para los links de filtro
export function catalogHref(base: string, current: ProductFilters, change: Partial<ProductFilters>): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.brandSlug) params.set('marca', next.brandSlug);
  if (next.categorySlug) params.set('categoria', next.categorySlug);
  if (next.search) params.set('q', next.search);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
