import type { APIRoute } from 'astro';
import { buildCartCatalog } from '../../lib/cart-catalog.ts';
import { getCatalog } from '../../lib/catalog-cache.ts';
import { CatalogError, WhatsAppError } from '../../lib/errors.ts';
import { CART_CATALOG_CACHE_CONTROL, etagFor, matchesEtag } from '../../lib/http-cache.ts';

const JSON_TYPE = 'application/json; charset=utf-8';

// Los errores nunca se cachean: un fallo pasajero no puede quedar guardado en el navegador
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': JSON_TYPE, 'cache-control': 'no-store' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const { products } = await getCatalog();
    const body = JSON.stringify(buildCartCatalog(products, import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? ''));
    const etag = etagFor(body);
    const headers = { etag, 'cache-control': CART_CATALOG_CACHE_CONTROL };
    // Si el navegador ya tiene esta versión, se responde sin cuerpo
    if (matchesEtag(request.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers });
    return new Response(body, { headers: { ...headers, 'content-type': JSON_TYPE } });
  } catch (error) {
    if (error instanceof WhatsAppError) return jsonError('El número de WhatsApp de la tienda no está configurado', 500);
    if (error instanceof CatalogError) return jsonError('No se pudo leer el catálogo', 502);
    throw error;
  }
};
