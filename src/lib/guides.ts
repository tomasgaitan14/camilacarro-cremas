import type { Product } from './types.ts';

export interface GuideProducts {
  cover: Product | null;
  related: Product[];
}

// Las guías ordenan por `order`; a igual orden se desempata por título para que el resultado sea estable
export function sortGuides<T extends { data: { order: number; title: string } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, 'es'));
}

// Resuelve los slugs de una guía contra el catálogo publicado. Un slug que ya no existe (producto oculto o
// borrado) se ignora: la guía sigue funcionando, solo sin ese producto.
export function resolveGuideProducts(
  guide: { coverProduct?: string; relatedProducts: string[] },
  products: Product[],
): GuideProducts {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const related: Product[] = [];
  for (const slug of guide.relatedProducts) {
    const product = bySlug.get(slug);
    if (product && !related.includes(product)) related.push(product);
  }
  return { cover: guide.coverProduct ? (bySlug.get(guide.coverProduct) ?? null) : null, related };
}
