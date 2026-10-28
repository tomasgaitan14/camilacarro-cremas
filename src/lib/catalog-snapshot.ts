import type { SupabaseClient } from '@supabase/supabase-js';
import { listBrands, listCategories, listProducts } from './catalog.ts';
import type { Brand, Category, Product } from './types.ts';

// Todo lo que necesitan las páginas públicas, en una sola carga: productos publicados, marcas y categorías
export interface CatalogSnapshot {
  products: Product[];
  brands: Brand[];
  categories: Category[];
}

export async function loadCatalogSnapshot(client: SupabaseClient): Promise<CatalogSnapshot> {
  const [products, brands, categories] = await Promise.all([listProducts(client), listBrands(client), listCategories(client)]);
  return { products, brands, categories };
}
