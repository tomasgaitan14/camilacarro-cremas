import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '../src/lib/slug.ts';

// el mismo formato que exige el check de la base
const DB_SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('slugify', () => {
  it.each([
    ['Crema Hidratante', 'crema-hidratante'],
    ['Ácido Hialurónico 50 ml', 'acido-hialuronico-50-ml'],
    ['Sérum Niño + Mamá', 'serum-nino-mama'],
    ['  --Aceite   limpiador--  ', 'aceite-limpiador'],
    ['SPF 50+ / PA++++', 'spf-50-pa'],
    ['Línea_Calmante', 'linea-calmante'],
  ])('"%s" -> "%s"', (text, expected) => {
    const slug = slugify(text, 120);
    expect(slug).toBe(expected);
    expect(slug).toMatch(DB_SLUG_SHAPE);
  });

  it.each(['', '   ', '!!!', '¡¿?!', '😀'])('un texto sin letras ni números ("%s") da vacío', (text) => {
    expect(slugify(text, 120)).toBe('');
  });

  it('corta en el largo máximo sin dejar un guion al final', () => {
    const slug = slugify('palabra '.repeat(40), 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug).toMatch(DB_SLUG_SHAPE);
    expect(slugify('abcdefghi jkl', 9)).toBe('abcdefghi');
    expect(slugify('abcdefgh ijk', 9)).toBe('abcdefgh');
  });
});

describe('uniqueSlug', () => {
  it('devuelve el mismo slug si está libre', () => {
    expect(uniqueSlug('crema', new Set(['otra']), 120)).toBe('crema');
  });

  it('suma -2, -3... si ya existe', () => {
    expect(uniqueSlug('crema', new Set(['crema']), 120)).toBe('crema-2');
    expect(uniqueSlug('crema', new Set(['crema', 'crema-2', 'crema-3']), 120)).toBe('crema-4');
  });

  it('respeta el largo máximo aunque haya que acortar la base', () => {
    const base = 'a'.repeat(20);
    const result = uniqueSlug(base, new Set([base]), 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('-2')).toBe(true);
    expect(result).toMatch(DB_SLUG_SHAPE);
  });

  it('no deja un doble guion cuando la base acortada termina en guion', () => {
    const base = 'abcd-efgh';
    // al agregar «-2» la base se corta a 7 letras: «abcd-ef»; con 6 quedaría «abcd-e», sin guion colgando
    const result = uniqueSlug(base, new Set([base]), 7);
    expect(result).toMatch(DB_SLUG_SHAPE);
    const tight = uniqueSlug('abcd-efgh', new Set(['abcd-efgh']), 6);
    expect(tight).toMatch(DB_SLUG_SHAPE);
    expect(tight).toBe('abcd-2');
  });
});
