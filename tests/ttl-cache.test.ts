import { describe, expect, it, vi } from 'vitest';
import { createTtlCache, parseTtlMs } from '../src/lib/ttl-cache.ts';

const TTL = 1000;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// reloj controlable: el tiempo solo avanza cuando el test lo dice
function clock() {
  let time = 0;
  return { now: () => time, advance: (ms: number) => void (time += ms) };
}

// espera a que se resuelvan las promesas pendientes (la renovación en segundo plano)
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('createTtlCache', () => {
  it('carga una sola vez mientras el valor está vigente', async () => {
    const c = clock();
    const load = vi.fn().mockResolvedValue('v1');
    const cache = createTtlCache(load, { ttlMs: TTL, now: c.now });
    expect(await cache.get()).toBe('v1');
    c.advance(TTL - 1);
    expect(await cache.get()).toBe('v1');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('al llegar justo al TTL el valor ya se considera vencido', async () => {
    const c = clock();
    const load = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const cache = createTtlCache(load, { ttlMs: TTL, now: c.now });
    await cache.get();
    c.advance(TTL);
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('vencido: devuelve el valor viejo al instante y lo renueva por detrás', async () => {
    const c = clock();
    const refresh = deferred<string>();
    const load = vi.fn().mockResolvedValueOnce('v1').mockReturnValueOnce(refresh.promise);
    const cache = createTtlCache(load, { ttlMs: TTL, now: c.now });
    await cache.get();
    c.advance(TTL + 1);

    expect(await cache.get()).toBe('v1'); // no espera la renovación
    expect(load).toHaveBeenCalledTimes(2);

    refresh.resolve('v2');
    await flush();
    expect(await cache.get()).toBe('v2');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('pedidos simultáneos en frío comparten una sola carga', async () => {
    const pending = deferred<string>();
    const load = vi.fn().mockReturnValue(pending.promise);
    const cache = createTtlCache(load, { ttlMs: TTL });
    const results = Promise.all([cache.get(), cache.get(), cache.get(), cache.get(), cache.get()]);
    pending.resolve('v1');
    expect(await results).toEqual(['v1', 'v1', 'v1', 'v1', 'v1']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('pedidos simultáneos con el valor vencido disparan una sola renovación', async () => {
    const c = clock();
    const refresh = deferred<string>();
    const load = vi.fn().mockResolvedValueOnce('v1').mockReturnValue(refresh.promise);
    const cache = createTtlCache(load, { ttlMs: TTL, now: c.now });
    await cache.get();
    c.advance(TTL + 1);
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('si la primera carga falla, rechaza y el próximo pedido reintenta', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce('v1');
    const cache = createTtlCache(load, { ttlMs: TTL });
    await expect(cache.get()).rejects.toThrow('sin red');
    expect(await cache.get()).toBe('v1');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('si falla la renovación sigue sirviendo el valor viejo y lo registra', async () => {
    const c = clock();
    const boom = new Error('caída de Supabase');
    const load = vi.fn().mockResolvedValueOnce('v1').mockRejectedValueOnce(boom).mockResolvedValueOnce('v2');
    const cache = createTtlCache(load, { ttlMs: TTL, now: c.now });
    await cache.get();
    c.advance(TTL + 1);

    expect(await cache.get()).toBe('v1');
    await flush();
    expect(cache.lastRefreshError()).toBe(boom);
    expect(await cache.get()).toBe('v1'); // sigue vencido: reintenta y sirve lo viejo mientras tanto
    await flush();
    expect(cache.lastRefreshError()).toBeNull();
    expect(await cache.get()).toBe('v2');
  });

  it('pasado el máximo de vencimiento ya no sirve lo viejo: espera un dato fresco', async () => {
    const c = clock();
    const load = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const cache = createTtlCache(load, { ttlMs: TTL, maxStaleMs: 5000, now: c.now });
    await cache.get();
    c.advance(5000);
    expect(await cache.get()).toBe('v2');
  });

  it('pasado el máximo y con la carga fallando, rechaza en vez de servir un dato demasiado viejo', async () => {
    const c = clock();
    const load = vi.fn().mockResolvedValueOnce('v1').mockRejectedValueOnce(new Error('caída'));
    const cache = createTtlCache(load, { ttlMs: TTL, maxStaleMs: 5000, now: c.now });
    await cache.get();
    c.advance(5000);
    await expect(cache.get()).rejects.toThrow('caída');
  });

  it('invalidate fuerza una carga nueva en el próximo pedido', async () => {
    const load = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const cache = createTtlCache(load, { ttlMs: TTL });
    await cache.get();
    cache.invalidate();
    expect(await cache.get()).toBe('v2');
  });

  it('invalidate durante una carga en curso: ese resultado no se guarda', async () => {
    const first = deferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce('v2');
    const cache = createTtlCache(load, { ttlMs: TTL });
    const pending = cache.get();
    cache.invalidate(); // el admin guardó algo mientras se cargaba el dato anterior
    first.resolve('v1-viejo');
    expect(await pending).toBe('v1-viejo'); // quien ya esperaba lo recibe...
    expect(await cache.get()).toBe('v2'); // ...pero no queda guardado
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('con TTL 0 no guarda nada: cada pedido carga', async () => {
    const load = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const cache = createTtlCache(load, { ttlMs: 0 });
    expect(await cache.get()).toBe('v1');
    expect(await cache.get()).toBe('v2');
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rechaza el TTL inválido %s', (ttlMs) => {
    expect(() => createTtlCache(async () => 'x', { ttlMs })).toThrow(RangeError);
  });
});

describe('parseTtlMs', () => {
  it('sin valor usa el de por defecto', () => {
    expect(parseTtlMs(undefined, 60000)).toBe(60000);
    expect(parseTtlMs('', 60000)).toBe(60000);
    expect(parseTtlMs('   ', 60000)).toBe(60000);
  });

  it('lee milisegundos enteros, incluido 0', () => {
    expect(parseTtlMs('30000', 60000)).toBe(30000);
    expect(parseTtlMs(' 0 ', 60000)).toBe(0);
  });

  it.each(['abc', '-5', '1.5', '10s', '1e3'])('un valor inválido ("%s") falla fuerte en vez de ignorarse', (raw) => {
    expect(() => parseTtlMs(raw, 60000)).toThrow(RangeError);
  });
});
