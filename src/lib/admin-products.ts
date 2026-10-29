// Escritura de productos desde el panel. Todas las funciones reciben el cliente de Supabase con la sesión de la
// persona que administra: la RLS decide si puede escribir, el código no se saltea ese control.
import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidateCatalog } from './catalog-cache.ts';
import type { DetailsInput, PriceStockInput } from './admin-product-input.ts';
import { resolveBrandId, resolveCategoryId, resolveLineId } from './admin-reference.ts';
import { syncImageAlts } from './admin-product-images.ts';
import { PRODUCT_LIMITS, PRODUCT_STATUS, type ProductStatus } from './constants.ts';
import { AdminDataError, PublishBlockedError, type PublishBlocker } from './errors.ts';
import type { Choice } from './admin-product-input.ts';
import { slugify, uniqueSlug } from './slug.ts';

const UNIQUE_VIOLATION = '23505';
const SLUG_RETRIES = 3;
const FALLBACK_SLUG = 'producto';

export interface BasicsValues {
  name: string;
  brand: Choice;
  category: Choice;
}

// Lo que hace falta para mostrar un producto en la tienda: foto y precio (nombre, marca y categoría ya están siempre)
export function publishBlockers(product: { priceArs: number; hasPhoto: boolean }): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  if (!product.hasPhoto) blockers.push('PHOTO');
  if (product.priceArs < 1) blockers.push('PRICE');
  return blockers;
}

export const PUBLISH_BLOCKER_MESSAGE: Readonly<Record<PublishBlocker, string>> = {
  PHOTO: 'Falta la foto principal.',
  PRICE: 'Falta el precio.',
};

function fail(message: string, cause: unknown): never {
  throw new AdminDataError(message, { cause });
}

async function takenSlugs(client: SupabaseClient, base: string): Promise<Set<string>> {
  // el slug solo lleva letras, números y guiones, así que el patrón no necesita escapes
  const { data, error } = await client.from('products').select('slug').like('slug', `${base}%`);
  if (error) fail('No se pudieron revisar los nombres de página existentes', error);
  return new Set((data ?? []).map((row) => row.slug as string));
}

// Crea el borrador: nombre, marca y categoría alcanzan. El slug (la dirección de la ficha) sale del nombre.
export async function createDraftProduct(client: SupabaseClient, input: BasicsValues): Promise<{ id: string; slug: string }> {
  const brandId = await resolveBrandId(client, input.brand);
  const categoryId = await resolveCategoryId(client, input.category);
  const base = slugify(input.name, PRODUCT_LIMITS.PRODUCT_SLUG) || FALLBACK_SLUG;

  for (let attempt = 0; attempt < SLUG_RETRIES; attempt++) {
    const slug = uniqueSlug(base, await takenSlugs(client, base), PRODUCT_LIMITS.PRODUCT_SLUG);
    const { data, error } = await client
      .from('products')
      .insert({ slug, name: input.name, brand_id: brandId, category_id: categoryId, price_ars: 0, stock: 0, status: PRODUCT_STATUS.DRAFT })
      .select('id, slug')
      .single();
    if (!error && data) {
      invalidateCatalog();
      return { id: data.id as string, slug: data.slug as string };
    }
    // otra pestaña tomó el mismo slug en el medio: se recalcula
    if (error?.code !== UNIQUE_VIOLATION) fail('No se pudo crear el producto', error);
  }
  throw new AdminDataError('No se pudo encontrar una dirección libre para el producto');
}

// La dirección (slug) NO cambia al renombrar: así los enlaces ya compartidos siguen andando.
export async function updateBasics(client: SupabaseClient, productId: string, input: BasicsValues): Promise<void> {
  const brandId = await resolveBrandId(client, input.brand);
  const categoryId = await resolveCategoryId(client, input.category);

  const current = await client
    .from('products')
    .select('line:product_lines(brand_id)')
    .eq('id', productId)
    .single();
  if (current.error) fail('No se pudo leer el producto', current.error);
  const lineBrandId = (current.data as unknown as { line: { brand_id: string } | null }).line?.brand_id;

  // la línea es de una marca: si cambia la marca, el producto deja la línea (y su paso de rutina)
  const clearLine = lineBrandId !== undefined && lineBrandId !== brandId;
  const { error } = await client
    .from('products')
    .update({
      name: input.name,
      brand_id: brandId,
      category_id: categoryId,
      ...(clearLine ? { line_id: null, routine_step: null } : {}),
    })
    .eq('id', productId);
  if (error) fail('No se pudieron guardar los datos del producto', error);

  await syncImageAlts(client, productId, input.name);
  invalidateCatalog();
}

export async function updatePriceStock(client: SupabaseClient, productId: string, input: PriceStockInput): Promise<void> {
  const { error } = await client.from('products').update({ price_ars: input.priceArs, stock: input.stock }).eq('id', productId);
  if (error) fail('No se pudieron guardar el precio y las unidades', error);
  invalidateCatalog();
}

export async function updateDetails(client: SupabaseClient, productId: string, brandId: string, input: DetailsInput): Promise<void> {
  const lineId = await resolveLineId(client, input.line, brandId);
  const { error } = await client
    .from('products')
    .update({
      summary: input.summary,
      volume: input.volume,
      key_ingredients: input.keyIngredients,
      benefits: input.benefits,
      usage_steps: input.usageSteps,
      skin_types: input.skinTypes,
      warnings: input.warnings,
      usage_time: input.usageTime,
      line_id: lineId,
      // el paso de rutina solo existe dentro de una línea (lo exige la base)
      routine_step: lineId ? input.routineStep : null,
    })
    .eq('id', productId);
  if (error) fail('No se pudieron guardar los detalles del producto', error);
  invalidateCatalog();
}

async function setStatus(client: SupabaseClient, productId: string, status: ProductStatus): Promise<void> {
  const { error } = await client.from('products').update({ status }).eq('id', productId);
  if (error) fail('No se pudo cambiar el estado del producto', error);
  invalidateCatalog();
}

// Publicar: solo si tiene foto y precio. Si falta algo, no se toca nada y se dice qué falta.
export async function publishProduct(client: SupabaseClient, productId: string): Promise<void> {
  const [product, photos] = await Promise.all([
    client.from('products').select('price_ars').eq('id', productId).single(),
    client.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId),
  ]);
  if (product.error) fail('No se pudo leer el producto', product.error);
  if (photos.error) fail('No se pudieron leer las fotos del producto', photos.error);

  const blockers = publishBlockers({ priceArs: product.data.price_ars as number, hasPhoto: (photos.count ?? 0) > 0 });
  if (blockers.length > 0) throw new PublishBlockedError(blockers);
  await setStatus(client, productId, PRODUCT_STATUS.PUBLISHED);
}

// «Ocultar» = vuelve a borrador: no se ve en la tienda pero no se pierde nada
export const hideProduct = (client: SupabaseClient, productId: string): Promise<void> =>
  setStatus(client, productId, PRODUCT_STATUS.DRAFT);

// «Eliminar» no borra: archiva, así se puede recuperar (y los pedidos viejos no pierden su producto)
export const archiveProduct = (client: SupabaseClient, productId: string): Promise<void> =>
  setStatus(client, productId, PRODUCT_STATUS.ARCHIVED);

export const restoreProduct = (client: SupabaseClient, productId: string): Promise<void> =>
  setStatus(client, productId, PRODUCT_STATUS.DRAFT);
