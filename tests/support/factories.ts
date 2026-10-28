import type { Product, ProductLine } from '../../src/lib/types.ts';
import type { CatalogEntry } from '../../src/lib/cart-catalog.ts';

export function makeLine(overrides: Partial<ProductLine> = {}): ProductLine {
  return { id: 'line-1', slug: 'linea-calmante', name: 'Línea Calmante', description: '', brandId: 'brand-1', ...overrides };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'crema',
    name: 'Crema',
    brand: { id: 'brand-1', slug: 'marca', name: 'Marca' },
    category: { id: 'cat-1', slug: 'hidratacion', name: 'Hidratación' },
    line: null,
    routineStep: null,
    summary: '',
    priceArs: 1000,
    volume: '50 ml',
    keyIngredients: '',
    benefits: [],
    usageSteps: [],
    skinTypes: [],
    warnings: '',
    usageTime: null,
    faqs: [],
    stock: 5,
    status: 'published',
    images: [],
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'p1',
    slug: 'crema',
    name: 'Crema',
    brandName: 'Marca',
    priceArs: 1000,
    stock: 5,
    imageUrl: 'http://127.0.0.1:54321/storage/v1/object/public/product-images/crema.webp',
    imageAlt: 'Crema',
    ...overrides,
  };
}
