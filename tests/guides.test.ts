import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveGuideProducts, sortGuides } from '../src/lib/guides.ts';
import { listProducts } from '../src/lib/catalog.ts';
import { anonClient, assertSupabaseIsUp } from './support/supabase.ts';
import { makeProduct } from './support/factories.ts';

const GUIDES_DIR = resolve(import.meta.dirname, '../src/content/guides');
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('sortGuides', () => {
  const entry = (title: string, order: number) => ({ data: { title, order } });

  it('ordena por el campo order', () => {
    // los títulos van en orden alfabético inverso al de `order`: ordenar por título daría otro resultado
    expect(sortGuides([entry('Alfa', 3), entry('Zeta', 1), entry('Mitad', 2)]).map((e) => e.data.title)).toEqual(['Zeta', 'Mitad', 'Alfa']);
  });

  it('desempata por título', () => {
    expect(sortGuides([entry('Zeta', 1), entry('Álamo', 1)]).map((e) => e.data.title)).toEqual(['Álamo', 'Zeta']);
  });

  it('no modifica la lista original', () => {
    const original = [entry('B', 2), entry('A', 1)];
    sortGuides(original);
    expect(original.map((e) => e.data.title)).toEqual(['B', 'A']);
  });
});

describe('resolveGuideProducts', () => {
  const a = makeProduct({ id: 'a', slug: 'a' });
  const b = makeProduct({ id: 'b', slug: 'b' });

  it('resuelve la portada y los relacionados en el orden de la guía', () => {
    const result = resolveGuideProducts({ coverProduct: 'b', relatedProducts: ['b', 'a'] }, [a, b]);
    expect(result.cover).toBe(b);
    expect(result.related).toEqual([b, a]);
  });

  it('ignora los slugs que ya no existen en el catálogo', () => {
    const result = resolveGuideProducts({ coverProduct: 'borrado', relatedProducts: ['a', 'borrado'] }, [a, b]);
    expect(result.cover).toBeNull();
    expect(result.related).toEqual([a]);
  });

  it('sin portada ni relacionados devuelve vacío', () => {
    expect(resolveGuideProducts({ relatedProducts: [] }, [a])).toEqual({ cover: null, related: [] });
  });

  it('no repite productos', () => {
    expect(resolveGuideProducts({ relatedProducts: ['a', 'a'] }, [a]).related).toEqual([a]);
  });
});

describe('guías del repositorio', () => {
  const files = readdirSync(GUIDES_DIR).filter((name) => name.endsWith('.md'));
  const guides = files.map((file) => {
    const raw = readFileSync(resolve(GUIDES_DIR, file), 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
    if (!match) throw new Error(`${file}: falta el frontmatter`);
    return { file, data: parse(match[1]) as Record<string, unknown>, body: match[2] };
  });
  let publishedSlugs = new Set<string>();

  beforeAll(async () => {
    await assertSupabaseIsUp();
    publishedSlugs = new Set((await listProducts(anonClient())).map((p) => p.slug));
  });

  it('hay al menos 4 guías', () => {
    expect(guides.length).toBeGreaterThanOrEqual(4);
  });

  it('cada guía tiene título, resumen y orden únicos y un cuerpo con contenido', () => {
    const orders = guides.map((g) => g.data.order);
    expect(new Set(orders).size).toBe(orders.length);
    for (const g of guides) {
      expect(typeof g.data.title, g.file).toBe('string');
      expect((g.data.summary as string).length, g.file).toBeLessThanOrEqual(220);
      expect(g.body.trim().length, g.file).toBeGreaterThan(200);
    }
  });

  it('los nombres de archivo son slugs válidos', () => {
    for (const file of files) expect(SLUG.test(file.replace(/\.md$/, '')), file).toBe(true);
  });

  it('los productos que cita cada guía existen en el catálogo del seed', () => {
    for (const g of guides) {
      const slugs = [g.data.coverProduct, ...((g.data.relatedProducts as string[]) ?? [])].filter(Boolean) as string[];
      for (const slug of slugs) expect(publishedSlugs.has(slug), `${g.file}: ${slug}`).toBe(true);
    }
  });

  it('ninguna guía promete resultados ni habla de diagnóstico o tratamiento médico', () => {
    const forbidden = /\b(garantiz\w*|cura\w*|diagnostic\w*|elimina arrugas|resultados? (en|garantizados))\b/i;
    for (const g of guides) expect(forbidden.test(g.body), g.file).toBe(false);
  });
});
