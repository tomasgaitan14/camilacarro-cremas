// Ayudas para las páginas del panel: cargar el producto del que se habla y traducir los fallos a mensajes simples
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLISH_BLOCKER_MESSAGE } from './admin-products.ts';
import { getProductForAdmin } from './catalog.ts';
import { IMAGE_MAX_UPLOAD_BYTES } from './constants.ts';
import { AdminDataError, ImageError, PublishBlockedError } from './errors.ts';
import type { Product } from './types.ts';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GENERIC_SAVE_ERROR = 'No pudimos guardar los cambios. Probá de nuevo en un momento.';
const UPLOAD_TOO_BIG_ERROR = `La foto pesa demasiado: el máximo es ${IMAGE_MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`;

// Un id que no tiene forma de id ni se consulta
export async function loadAdminProduct(client: SupabaseClient, id: string | undefined): Promise<Product | null> {
  if (!id || !UUID_SHAPE.test(id)) return null;
  return getProductForAdmin(client, id);
}

// Mensaje para mostrarle a Camila, o null si el error no es de los esperados (entonces se deja subir como error 500)
export function describeAdminFailure(error: unknown): string | null {
  if (error instanceof ImageError) return error.message;
  if (error instanceof PublishBlockedError) return error.blockers.map((blocker) => PUBLISH_BLOCKER_MESSAGE[blocker]).join(' ');
  if (error instanceof AdminDataError) {
    // el detalle técnico queda en el registro del servidor; a ella solo le llega un mensaje simple
    console.error(error.message, error.cause);
    return GENERIC_SAVE_ERROR;
  }
  return null;
}

// Antes de leer un formulario con fotos: si el pedido ya declara un tamaño absurdo, se corta
export function uploadIsTooBig(request: Request): boolean {
  const declared = Number(request.headers.get('content-length'));
  return Number.isFinite(declared) && declared > IMAGE_MAX_UPLOAD_BYTES * 2;
}

export { UPLOAD_TOO_BIG_ERROR };

export function uploadedFile(form: FormData, name: string): File | null {
  const value = form.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
