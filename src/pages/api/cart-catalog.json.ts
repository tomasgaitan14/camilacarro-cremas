import type { APIRoute } from 'astro';
import { buildCartCatalog } from '../../lib/cart-catalog.ts';
import { listProducts } from '../../lib/catalog.ts';
import { CatalogError, WhatsAppError } from '../../lib/errors.ts';
import { getPublicClient } from '../../lib/supabase.ts';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

export const GET: APIRoute = async () => {
  try {
    const products = await listProducts(getPublicClient());
    const body = buildCartCatalog(products, import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? '');
    return new Response(JSON.stringify(body), { headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof WhatsAppError) return jsonError('El número de WhatsApp de la tienda no está configurado', 500);
    if (error instanceof CatalogError) return jsonError('No se pudo leer el catálogo', 502);
    throw error;
  }
};
