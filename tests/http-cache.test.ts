import { describe, expect, it } from 'vitest';
import { CART_CATALOG_CACHE_CONTROL, etagFor, matchesEtag } from '../src/lib/http-cache.ts';

describe('etagFor', () => {
  it('es estable para el mismo contenido y cambia si cambia el contenido', () => {
    expect(etagFor('{"a":1}')).toBe(etagFor('{"a":1}'));
    expect(etagFor('{"a":1}')).not.toBe(etagFor('{"a":2}'));
  });

  it('va entre comillas, como exige el formato de ETag', () => {
    expect(etagFor('x')).toMatch(/^"[0-9a-f]{40}"$/);
  });
});

describe('matchesEtag', () => {
  const etag = etagFor('contenido');

  it('coincide con el mismo valor', () => {
    expect(matchesEtag(etag, etag)).toBe(true);
  });

  it('no coincide sin cabecera o con otro valor', () => {
    expect(matchesEtag(null, etag)).toBe(false);
    expect(matchesEtag('', etag)).toBe(false);
    expect(matchesEtag(etagFor('otro'), etag)).toBe(false);
  });

  it('acepta una lista de valores', () => {
    expect(matchesEtag(`${etagFor('a')}, ${etag}, ${etagFor('b')}`, etag)).toBe(true);
    expect(matchesEtag(`${etagFor('a')}, ${etagFor('b')}`, etag)).toBe(false);
  });

  it('acepta validadores débiles (W/) y el comodín *', () => {
    expect(matchesEtag(`W/${etag}`, etag)).toBe(true);
    expect(matchesEtag('*', etag)).toBe(true);
  });
});

describe('CART_CATALOG_CACHE_CONTROL', () => {
  it('es público, con vigencia corta y revalidación en segundo plano', () => {
    expect(CART_CATALOG_CACHE_CONTROL).toBe('public, max-age=30, stale-while-revalidate=120');
  });
});
