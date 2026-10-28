import { CATALOG_CACHE_MAX_STALE_FACTOR } from './constants.ts';

export interface TtlCacheOptions {
  ttlMs: number;
  // pasado este tiempo sin renovar, `get` espera un dato fresco en vez de servir el viejo
  maxStaleMs?: number;
  now?: () => number;
}

export interface TtlCache<T> {
  get(): Promise<T>;
  // el próximo `get` vuelve a cargar (por ejemplo, después de que el admin guarda un producto)
  invalidate(): void;
  // último error de una renovación en segundo plano (null si la última salió bien)
  lastRefreshError(): unknown;
}

// Caché de un solo valor con vencimiento, renovación en segundo plano y una sola carga a la vez:
// - dentro del TTL devuelve el valor guardado sin cargar;
// - pasado el TTL devuelve el valor viejo al instante y lo renueva por detrás (stale-while-revalidate);
// - varios pedidos simultáneos comparten la misma carga;
// - si la renovación falla se sigue sirviendo lo viejo, y el próximo `get` reintenta.
export function createTtlCache<T>(load: () => Promise<T>, options: TtlCacheOptions): TtlCache<T> {
  const { ttlMs, now = Date.now } = options;
  if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new RangeError(`TTL inválido: ${ttlMs}`);
  // con TTL 0 el máximo también es 0: todo valor guardado ya está demasiado viejo y cada `get` recarga (caché desactivada)
  const maxStaleMs = options.maxStaleMs ?? ttlMs * CATALOG_CACHE_MAX_STALE_FACTOR;

  let stored: { data: T; loadedAt: number } | null = null;
  let inflight: Promise<T> | null = null;
  // invalidate() durante una carga en curso: el resultado de esa carga ya puede ser dato viejo y no se guarda
  let generation = 0;
  let refreshError: unknown = null;

  function refresh(): Promise<T> {
    if (inflight) return inflight;
    const startedAt = generation;
    const run = load()
      .then((data) => {
        if (startedAt === generation) stored = { data, loadedAt: now() };
        refreshError = null;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    inflight = run;
    return run;
  }

  return {
    async get() {
      if (!stored) return refresh();
      const age = now() - stored.loadedAt;
      if (age < ttlMs) return stored.data;
      if (age >= maxStaleMs) return refresh();
      refresh().catch((error: unknown) => {
        refreshError = error;
      });
      return stored.data;
    },
    invalidate() {
      stored = null;
      generation += 1;
    },
    lastRefreshError: () => refreshError,
  };
}

// Lee un TTL en milisegundos de una variable de entorno: vacío usa el valor por defecto; un valor inválido falla fuerte
export function parseTtlMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new RangeError(`CATALOG_CACHE_TTL_MS inválido: "${raw}" (se esperan milisegundos enteros)`);
  return Number(raw.trim());
}
