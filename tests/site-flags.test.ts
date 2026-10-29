import { describe, expect, it } from 'vitest';
import { NOINDEX_HEADER, flagEnabled, isAdminEnabled, isNoindex } from '../src/lib/site-flags.ts';

describe('flagEnabled', () => {
  it.each(['true', 'TRUE', ' True ', '1', 'yes', 'YES'])('"%s" enciende', (raw) => {
    expect(flagEnabled(raw)).toBe(true);
  });

  it.each([undefined, '', ' ', 'false', '0', 'no', 'off', 'tru', 'truee', 'enabled', 'null'])('%j no enciende', (raw) => {
    expect(flagEnabled(raw)).toBe(false);
  });
});

describe('interruptores', () => {
  it('el panel está apagado salvo que se lo pida', () => {
    expect(isAdminEnabled(undefined)).toBe(false);
    expect(isAdminEnabled('')).toBe(false);
    expect(isAdminEnabled('true')).toBe(true);
  });

  it('noindex está apagado salvo que se lo pida', () => {
    expect(isNoindex(undefined)).toBe(false);
    expect(isNoindex('false')).toBe(false);
    expect(isNoindex('true')).toBe(true);
  });

  it('el encabezado pide no indexar ni seguir enlaces', () => {
    expect(NOINDEX_HEADER).toEqual({ name: 'x-robots-tag', value: 'noindex, nofollow' });
  });
});
