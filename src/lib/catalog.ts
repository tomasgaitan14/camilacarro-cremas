import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRODUCT_STATUS,
  STORAGE_BUCKET,
  type ImageKind,
  type ProductStatus,
  type UsageTime,
} from './constants.ts';
import { CatalogError } from './errors.ts';
import { parseFaqs } from './faqs.ts';
import type { Brand, CartProduct, Category, Product, ProductImage, ProductLine } from './types.ts';

interface BrandRow {
  id: string;
  slug: string;
  name: string;
}

interface LineRow extends BrandRow {
  description: string;
  brand_id: string;
}

interface ImageRow {
  id: string;
  path: string;
  alt: string;
  position: number;
  kind: ImageKind;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  routine_step: number | null;
  summary: string;
  price_ars: number;
  volume: string;
  key_ingredients: string;
  benefits: string[];
  usage_steps: string[];
  skin_types: string[];
  warnings: string;
  usage_time: UsageTime | null;
  faqs: unknown;
  stock: number;
  status: ProductStatus;
  brand: BrandRow;
  category: BrandRow;
  line: LineRow | null;
  images: ImageRow[];
}

// Con !inner el filtro sobre la relación descarta también los productos que no coinciden;
// sin él, PostgREST solo vaciaría el objeto embebido. La línea es opcional, así que solo es
// inner cuando se filtra por ella.
function productSelect(filterByLine: boolean): string {
  return `
  *,
  brand:brands!inner(id, slug, name),
  category:categories!inner(id, slug, name),
  line:product_lines${filterByLine ? '!inner' : ''}(id, slug, name, description, brand_id),
  images:product_images(id, path, alt, position, kind)
`;
}

export interface ProductFilters {
  brandSlug?: string;
  categorySlug?: string;
  lineSlug?: string;
  // texto libre sobre el nombre
  search?: string;
}

// Los caracteres con significado en un patrón ilike (% _ \) y en la sintaxis de PostgREST (, ( ))
// se sacan del texto de búsqueda para que no cambien la consulta.
function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_\\,()]/g, ' ').trim();
}

function toProduct(client: SupabaseClient, row: ProductRow): Product {
  const images: ProductImage[] = [...row.images]
    .sort((a, b) => a.position - b.position)
    .map((image) => ({
      id: image.id,
      url: client.storage.from(STORAGE_BUCKET).getPublicUrl(image.path).data.publicUrl,
      alt: image.alt,
      position: image.position,
      kind: image.kind,
    }));

  const line: ProductLine | null = row.line
    ? {
        id: row.line.id,
        slug: row.line.slug,
        name: row.line.name,
        description: row.line.description,
        brandId: row.line.brand_id,
      }
    : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category,
    line,
    routineStep: row.routine_step,
    summary: row.summary,
    priceArs: row.price_ars,
    volume: row.volume,
    keyIngredients: row.key_ingredients,
    benefits: row.benefits,
    usageSteps: row.usage_steps,
    skinTypes: row.skin_types,
    warnings: row.warnings,
    usageTime: row.usage_time,
    faqs: parseFaqs(row.faqs),
    stock: row.stock,
    status: row.status,
    images,
  };
}

// El cliente público solo ve productos publicados (lo garantiza la RLS); el filtro explícito
// evita que un admin logueado vea borradores en la tienda.
export async function listProducts(client: SupabaseClient, filters: ProductFilters = {}): Promise<Product[]> {
  let query = client
    .from('products')
    .select(productSelect(Boolean(filters.lineSlug)))
    .eq('status', PRODUCT_STATUS.PUBLISHED);

  if (filters.brandSlug) query = query.eq('brand.slug', filters.brandSlug);
  if (filters.categorySlug) query = query.eq('category.slug', filters.categorySlug);
  if (filters.lineSlug) query = query.eq('line.slug', filters.lineSlug);
  if (filters.search) {
    const term = sanitizeSearch(filters.search);
    if (term) query = query.ilike('name', `%${term}%`);
  }

  const { data, error } = await query.order('name');
  if (error) throw new CatalogError('No se pudo leer el catálogo', { cause: error });
  return (data as unknown as ProductRow[]).map((row) => toProduct(client, row));
}

export async function getProductBySlug(client: SupabaseClient, slug: string): Promise<Product | null> {
  const { data, error } = await client
    .from('products')
    .select(productSelect(false))
    .eq('slug', slug)
    .eq('status', PRODUCT_STATUS.PUBLISHED)
    .maybeSingle();
  if (error) throw new CatalogError(`No se pudo leer el producto "${slug}"`, { cause: error });
  return data ? toProduct(client, data as unknown as ProductRow) : null;
}

// Para el panel: todos los estados (borradores, ocultos y archivados). La RLS solo se los muestra a un admin;
// con otro cliente devuelve únicamente los publicados.
export async function listProductsForAdmin(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client.from('products').select(productSelect(false)).order('name');
  if (error) throw new CatalogError('No se pudieron leer los productos del panel', { cause: error });
  return (data as unknown as ProductRow[]).map((row) => toProduct(client, row));
}

export async function getProductForAdmin(client: SupabaseClient, id: string): Promise<Product | null> {
  const { data, error } = await client.from('products').select(productSelect(false)).eq('id', id).maybeSingle();
  if (error) throw new CatalogError(`No se pudo leer el producto "${id}"`, { cause: error });
  return data ? toProduct(client, data as unknown as ProductRow) : null;
}

export async function listLines(client: SupabaseClient): Promise<ProductLine[]> {
  const { data, error } = await client.from('product_lines').select('id, slug, name, description, brand_id').order('name');
  if (error) throw new CatalogError('No se pudieron leer las líneas', { cause: error });
  return (data as LineRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    brandId: row.brand_id,
  }));
}

export async function listBrands(client: SupabaseClient): Promise<Brand[]> {
  const { data, error } = await client.from('brands').select('id, slug, name').order('name');
  if (error) throw new CatalogError('No se pudieron leer las marcas', { cause: error });
  return data as Brand[];
}

export async function listCategories(client: SupabaseClient): Promise<Category[]> {
  const { data, error } = await client.from('categories').select('id, slug, name').order('name');
  if (error) throw new CatalogError('No se pudieron leer las categorías', { cause: error });
  return data as Category[];
}

export function mainImage(product: Product): ProductImage | null {
  return product.images.find((image) => image.kind === 'main') ?? product.images[0] ?? null;
}

export function toCartProduct(product: Product): CartProduct {
  return {
    id: product.id,
    name: product.name,
    brandName: product.brand.name,
    priceArs: product.priceArs,
    stock: product.stock,
  };
}
