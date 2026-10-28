import { createHash } from 'node:crypto';
import { CART_CATALOG_MAX_AGE_S, CART_CATALOG_STALE_WHILE_REVALIDATE_S } from './constants.ts';

export const CART_CATALOG_CACHE_CONTROL = `public, max-age=${CART_CATALOG_MAX_AGE_S}, stale-while-revalidate=${CART_CATALOG_STALE_WHILE_REVALIDATE_S}`;

export function etagFor(body: string): string {
  return `"${createHash('sha1').update(body).digest('hex')}"`;
}

// If-None-Match puede traer varios valores, "*" o validadores débiles (W/"...")
export function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  return ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .includes(etag);
}
