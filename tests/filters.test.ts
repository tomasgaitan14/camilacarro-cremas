import { describe, expect, it } from 'vitest';
import { MAX_FILTER_TEXT_LENGTH } from '../src/lib/constants.ts';
import { catalogHref, parseCatalogFilters } from '../src/lib/filters.ts';

const params = (query: string) => new URLSearchParams(query);

describe('parseCatalogFilters', () => {
  it('lee marca, categoría y búsqueda', () => {
    expect(parseCatalogFilters(params('marca=marca-demo-a&categoria=limpieza&q=aceite'))).toEqual({
      brandSlug: 'marca-demo-a',
      categorySlug: 'limpieza',
      search: 'aceite',
    });
  });

  it('sin parámetros no filtra nada', () => {
    expect(parseCatalogFilters(params(''))).toEqual({ brandSlug: undefined, categorySlug: undefined, search: undefined });
  });

  it.each(['Marca Demo', 'a_b', '../etc', 'a--b', '-a', 'a-', '<script>', 'ñandú', '%00', 'a,b'])(
    'descarta el slug inválido "%s"',
    (value) => {
      const filters = parseCatalogFilters(params(`marca=${encodeURIComponent(value)}&categoria=${encodeURIComponent(value)}`));
      expect(filters.brandSlug).toBeUndefined();
      expect(filters.categorySlug).toBeUndefined();
    },
  );

  it('descarta un slug demasiado largo', () => {
    const long = 'a'.repeat(MAX_FILTER_TEXT_LENGTH + 1);
    expect(parseCatalogFilters(params(`marca=${long}`)).brandSlug).toBeUndefined();
    expect(parseCatalogFilters(params(`marca=${'a'.repeat(MAX_FILTER_TEXT_LENGTH)}`)).brandSlug).toBeDefined();
  });

  it('recorta la búsqueda al largo máximo y quita espacios', () => {
    const filters = parseCatalogFilters(params(`q=${encodeURIComponent('  ' + 'x'.repeat(200) + '  ')}`));
    expect(filters.search).toHaveLength(MAX_FILTER_TEXT_LENGTH);
  });

  it('una búsqueda vacía o de espacios no filtra', () => {
    expect(parseCatalogFilters(params('q=')).search).toBeUndefined();
    expect(parseCatalogFilters(params('q=%20%20')).search).toBeUndefined();
  });

  it('ignora parámetros desconocidos', () => {
    expect(parseCatalogFilters(params('status=draft&marca=marca-demo-a'))).toEqual({
      brandSlug: 'marca-demo-a',
      categorySlug: undefined,
      search: undefined,
    });
  });
});

describe('catalogHref', () => {
  it('sin filtros devuelve la base', () => {
    expect(catalogHref('/productos', {}, {})).toBe('/productos');
  });

  it('conserva los otros filtros al cambiar uno', () => {
    expect(catalogHref('/productos', { brandSlug: 'a', search: 'aceite' }, { categorySlug: 'limpieza' })).toBe(
      '/productos?marca=a&categoria=limpieza&q=aceite',
    );
  });

  it('quitar un filtro lo saca de la URL', () => {
    expect(catalogHref('/productos', { brandSlug: 'a', categorySlug: 'b' }, { brandSlug: undefined })).toBe(
      '/productos?categoria=b',
    );
  });

  it('codifica el texto de búsqueda', () => {
    expect(catalogHref('/productos', {}, { search: 'a&b=c' })).toBe('/productos?q=a%26b%3Dc');
  });
});
