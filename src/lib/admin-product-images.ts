// Fotos del producto en el panel: se reducen, se suben con nombre único (cacheables un año) y se registran en la base.
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { processProductImage } from './image-processing.ts';
import { invalidateCatalog } from './catalog-cache.ts';
import {
  IMAGE_CACHE_CONTROL_S,
  IMAGE_MAIN_POSITION,
  IMAGE_MAX_PER_PRODUCT,
  IMAGE_KIND,
  STORAGE_BUCKET,
  type ImageKind,
} from './constants.ts';
import { AdminDataError, ImageError } from './errors.ts';

const WEBP_CONTENT_TYPE = 'image/webp';

interface StoredImage {
  id: string;
  path: string;
  position: number;
  kind: ImageKind;
}

async function listStoredImages(client: SupabaseClient, productId: string): Promise<StoredImage[]> {
  const { data, error } = await client
    .from('product_images')
    .select('id, path, position, kind')
    .eq('product_id', productId)
    .order('position');
  if (error) throw new AdminDataError('No se pudieron leer las fotos del producto', { cause: error });
  return data as StoredImage[];
}

function altFor(productName: string, position: number): string {
  return position === IMAGE_MAIN_POSITION ? productName : `${productName} (foto ${position + 1})`;
}

async function uploadProcessed(client: SupabaseClient, productId: string, file: File): Promise<string> {
  const { data } = await processProductImage(Buffer.from(await file.arrayBuffer()));
  // nombre único: la foto nunca cambia bajo la misma dirección, por eso se puede cachear un año
  const path = `${productId}/${randomUUID()}.webp`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, data, {
    contentType: WEBP_CONTENT_TYPE,
    cacheControl: String(IMAGE_CACHE_CONTROL_S),
    upsert: false,
  });
  if (error) throw new AdminDataError('No se pudo subir la foto', { cause: error });
  return path;
}

async function removeObject(client: SupabaseClient, path: string): Promise<void> {
  const { data, error } = await client.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw new AdminDataError('No se pudo borrar el archivo de la foto', { cause: error });
  // Storage responde bien aunque no encuentre el archivo (o no tenga permiso para verlo): se cuenta lo borrado
  if (data.length === 0) throw new AdminDataError(`No se borró el archivo de la foto (${path}): no existe o falta permiso`);
}

// Foto principal: la primera que se sube, o reemplaza a la que ya hay
export async function setMainImage(client: SupabaseClient, product: { id: string; name: string }, file: File): Promise<void> {
  const images = await listStoredImages(client, product.id);
  const main = images.find((image) => image.kind === IMAGE_KIND.MAIN);
  const path = await uploadProcessed(client, product.id, file);

  if (main) {
    const { error } = await client.from('product_images').update({ path, alt: altFor(product.name, IMAGE_MAIN_POSITION) }).eq('id', main.id);
    if (error) {
      await removeObject(client, path);
      throw new AdminDataError('No se pudo guardar la foto', { cause: error });
    }
    await removeObject(client, main.path);
  } else {
    // sin principal pero con otras fotos: la nueva toma la posición 0, que tiene que estar libre
    const taken = images.find((image) => image.position === IMAGE_MAIN_POSITION);
    if (taken) {
      await removeObject(client, path);
      throw new AdminDataError('El producto tiene fotos sin foto principal');
    }
    const { error } = await client
      .from('product_images')
      .insert({ product_id: product.id, path, alt: altFor(product.name, IMAGE_MAIN_POSITION), position: IMAGE_MAIN_POSITION, kind: IMAGE_KIND.MAIN });
    if (error) {
      await removeObject(client, path);
      throw new AdminDataError('No se pudo guardar la foto', { cause: error });
    }
  }
  invalidateCatalog();
}

// Fotos extra (hasta el máximo del producto)
export async function addExtraImage(client: SupabaseClient, product: { id: string; name: string }, file: File): Promise<void> {
  const images = await listStoredImages(client, product.id);
  if (images.length >= IMAGE_MAX_PER_PRODUCT) {
    throw new ImageError('TOO_MANY', `Ya hay ${IMAGE_MAX_PER_PRODUCT} fotos: quitá alguna para agregar otra.`);
  }
  const used = new Set(images.map((image) => image.position));
  let position = IMAGE_MAIN_POSITION + 1;
  while (used.has(position)) position++;

  const path = await uploadProcessed(client, product.id, file);
  const { error } = await client
    .from('product_images')
    .insert({ product_id: product.id, path, alt: altFor(product.name, position), position, kind: IMAGE_KIND.DETAIL });
  if (error) {
    await removeObject(client, path);
    throw new AdminDataError('No se pudo guardar la foto', { cause: error });
  }
  invalidateCatalog();
}

// Al quitar la principal, la siguiente foto pasa a ser la principal (si no, el producto quedaría sin foto de portada)
export async function removeImage(client: SupabaseClient, productId: string, imageId: string): Promise<void> {
  const images = await listStoredImages(client, productId);
  const target = images.find((image) => image.id === imageId);
  if (!target) throw new AdminDataError('Esa foto ya no existe');

  const { error } = await client.from('product_images').delete().eq('id', imageId);
  if (error) throw new AdminDataError('No se pudo quitar la foto', { cause: error });

  if (target.kind === IMAGE_KIND.MAIN) {
    const next = images.find((image) => image.id !== imageId);
    if (next) {
      const promoted = await client
        .from('product_images')
        .update({ kind: IMAGE_KIND.MAIN, position: IMAGE_MAIN_POSITION })
        .eq('id', next.id);
      if (promoted.error) throw new AdminDataError('No se pudo elegir la nueva foto principal', { cause: promoted.error });
    }
  }
  invalidateCatalog();
  await removeObject(client, target.path);
}

// El texto alternativo sale del nombre: si se renombra el producto, las fotos lo siguen
export async function syncImageAlts(client: SupabaseClient, productId: string, productName: string): Promise<void> {
  const images = await listStoredImages(client, productId);
  for (const image of images) {
    const { error } = await client.from('product_images').update({ alt: altFor(productName, image.position) }).eq('id', image.id);
    if (error) throw new AdminDataError('No se pudo actualizar el texto de las fotos', { cause: error });
  }
}
