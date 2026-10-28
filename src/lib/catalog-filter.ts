import type { ProductFilters } from './catalog.ts';
import type { Product } from './types.ts';

// Búsqueda sin distinguir mayúsculas ni acentos: "hidratacion" encuentra "Hidratación"
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// Los mismos filtros que listProducts, pero en memoria sobre el catálogo ya cargado: no consulta la base.
// Conserva el orden de entrada.
export function filterProducts(products: readonly Product[], filters: ProductFilters = {}): Product[] {
  const term = filters.search ? normalizeText(filters.search) : '';
  return products.filter(
    (product) =>
      (!filters.brandSlug || product.brand.slug === filters.brandSlug) &&
      (!filters.categorySlug || product.category.slug === filters.categorySlug) &&
      (!filters.lineSlug || product.line?.slug === filters.lineSlug) &&
      (!term || normalizeText(product.name).includes(term)),
  );
}

export function findProduct(products: readonly Product[], slug: string): Product | null {
  return products.find((product) => product.slug === slug) ?? null;
}
