import { CATALOG_CACHE_TTL_MS } from './constants.ts';
import { loadCatalogSnapshot } from './catalog-snapshot.ts';
import { getPublicClient } from './supabase.ts';
import { createTtlCache, parseTtlMs } from './ttl-cache.ts';

// Una caché por proceso del servidor: todas las visitas comparten la misma carga del catálogo.
// Las páginas filtran y buscan en memoria sobre este resultado (ver catalog-filter.ts).
const cache = createTtlCache(() => loadCatalogSnapshot(getPublicClient()), {
  // En producción Astro fija import.meta.env al compilar: para poder cambiar el TTL al arrancar se lee primero process.env
  ttlMs: parseTtlMs(process.env.CATALOG_CACHE_TTL_MS ?? import.meta.env.CATALOG_CACHE_TTL_MS, CATALOG_CACHE_TTL_MS),
});

export const getCatalog = cache.get;

// Para el panel de administración: tras guardar un producto, que el cambio se vea sin esperar el vencimiento
export const invalidateCatalog = cache.invalidate;
