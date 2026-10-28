import { describe, expect, it } from 'vitest';
import {
  formValues,
  parseBasicsForm,
  parseChoice,
  parseDetailsForm,
  parseLines,
  parseName,
  parseOptionalText,
  parsePriceArs,
  parsePriceStockForm,
  parseRoutineStep,
  parseSkinTypes,
  parseStock,
  parseUsageTime,
} from '../src/lib/admin-product-input.ts';
import { NEW_CHOICE_VALUE, PRODUCT_LIMITS } from '../src/lib/constants.ts';

const ID = '3f2b8c1e-6a4d-4e0b-9c7a-1d2e3f4a5b6c';

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

describe('parseName', () => {
  it('limpia espacios de más', () => {
    expect(parseName('  Crema   hidratante \n', 'el nombre', 120)).toEqual({ ok: true, value: 'Crema hidratante' });
  });
  it.each(['', '   ', '\n\t'])('rechaza el vacío ("%s")', (raw) => {
    expect(parseName(raw, 'el nombre', 120)).toMatchObject({ ok: false });
  });
  it('rechaza lo que se pasa del largo máximo y acepta justo el máximo', () => {
    expect(parseName('a'.repeat(121), 'el nombre', 120)).toMatchObject({ ok: false });
    expect(parseName('a'.repeat(120), 'el nombre', 120)).toMatchObject({ ok: true });
  });
  it('quita caracteres de control invisibles', () => {
    expect(parseName('Cre\u0000ma\u0007', 'el nombre', 120)).toEqual({ ok: true, value: 'Crema' });
  });
});

describe('parsePriceArs', () => {
  it.each([
    ['12500', 12500],
    ['12.500', 12500],
    ['$ 12.500', 12500],
    ['1.250.000', 1250000],
    ['  900 ', 900],
    ['1', 1],
    [String(PRODUCT_LIMITS.PRICE_ARS_MAX), PRODUCT_LIMITS.PRICE_ARS_MAX],
  ])('acepta "%s"', (raw, expected) => {
    expect(parsePriceArs(raw)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'vacío'],
    ['   ', 'solo espacios'],
    ['0', 'cero'],
    ['-500', 'negativo'],
    ['12,50', 'centavos con coma'],
    ['12.50', 'centavos con punto'],
    ['12500,00', 'coma decimal'],
    ['abc', 'letras'],
    ['12a', 'letras mezcladas'],
    ['1e5', 'notación científica'],
    ['12.5000', 'puntos mal puestos'],
    ['1..000', 'doble punto'],
    [String(PRODUCT_LIMITS.PRICE_ARS_MAX + 1), 'por encima del máximo'],
    ['99999999999999999999', 'número enorme'],
  ])('rechaza "%s" (%s)', (raw) => {
    expect(parsePriceArs(raw)).toMatchObject({ ok: false });
  });

  it('el mensaje de los centavos explica qué hacer', () => {
    expect(parsePriceArs('12,50')).toEqual({ ok: false, error: 'Poné el precio en pesos, sin centavos.' });
  });
});

describe('parseStock', () => {
  it.each([['0', 0], ['8', 8], [' 25 ', 25], [String(PRODUCT_LIMITS.STOCK_MAX), PRODUCT_LIMITS.STOCK_MAX]])('acepta "%s"', (raw, expected) => {
    expect(parseStock(raw)).toEqual({ ok: true, value: expected });
  });
  it.each(['', ' ', '-1', '1.5', '1,5', 'ocho', String(PRODUCT_LIMITS.STOCK_MAX + 1)])('rechaza "%s"', (raw) => {
    expect(parseStock(raw)).toMatchObject({ ok: false });
  });
});

describe('parseOptionalText', () => {
  it('el vacío es válido', () => {
    expect(parseOptionalText('  ', 400)).toEqual({ ok: true, value: '' });
  });
  it('rechaza pasarse y cuenta cuánto se pasó', () => {
    const result = parseOptionalText('a'.repeat(401), 400);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain('401');
  });
});

describe('parseLines', () => {
  it('un ítem por renglón, sin vacíos', () => {
    expect(parseLines('uno\n\n  dos  \r\ntres', 12)).toEqual({ ok: true, value: ['uno', 'dos', 'tres'] });
  });
  it('quita viñetas y numeración pegadas desde otro lado', () => {
    expect(parseLines('- uno\n• dos\n1. tres\n2) cuatro\n* cinco', 12)).toEqual({
      ok: true,
      value: ['uno', 'dos', 'tres', 'cuatro', 'cinco'],
    });
  });
  it('no confunde un número del texto con numeración', () => {
    expect(parseLines('2 gotas por la noche\n50 ml', 12)).toEqual({ ok: true, value: ['2 gotas por la noche', '50 ml'] });
  });
  it('descarta repetidos', () => {
    expect(parseLines('uno\nuno\ndos', 12)).toEqual({ ok: true, value: ['uno', 'dos'] });
  });
  it('vacío = lista vacía', () => {
    expect(parseLines('', 12)).toEqual({ ok: true, value: [] });
  });
  it('rechaza más ítems que el máximo y acepta justo el máximo', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `ítem ${i}`).join('\n');
    expect(parseLines(lines(13), 12)).toMatchObject({ ok: false });
    expect(parseLines(lines(12), 12)).toMatchObject({ ok: true });
  });
  it('rechaza un renglón demasiado largo', () => {
    expect(parseLines('a'.repeat(PRODUCT_LIMITS.LIST_ITEM + 1), 12)).toMatchObject({ ok: false });
    expect(parseLines('a'.repeat(PRODUCT_LIMITS.LIST_ITEM), 12)).toMatchObject({ ok: true });
  });
});

describe('parseSkinTypes', () => {
  it('limpia, quita vacíos y repetidos', () => {
    expect(parseSkinTypes([' Piel seca ', '', 'Piel seca', 'Piel mixta'])).toEqual({ ok: true, value: ['Piel seca', 'Piel mixta'] });
  });
  it('rechaza más de los permitidos', () => {
    const many = Array.from({ length: PRODUCT_LIMITS.SKIN_TYPES + 1 }, (_, i) => `tipo ${i}`);
    expect(parseSkinTypes(many)).toMatchObject({ ok: false });
    expect(parseSkinTypes(many.slice(1))).toMatchObject({ ok: true });
  });
  it('rechaza un valor larguísimo', () => {
    expect(parseSkinTypes(['a'.repeat(PRODUCT_LIMITS.SKIN_TYPE_ITEM + 1)])).toMatchObject({ ok: false });
  });
});

describe('parseUsageTime', () => {
  it.each([['', null], ['morning', 'morning'], ['night', 'night'], ['both', 'both']])('"%s"', (raw, expected) => {
    expect(parseUsageTime(raw)).toEqual({ ok: true, value: expected });
  });
  it.each(['noon', 'MORNING', ' night', 'null'])('rechaza "%s"', (raw) => {
    expect(parseUsageTime(raw)).toMatchObject({ ok: false });
  });
});

describe('parseRoutineStep', () => {
  it('sin línea no hay paso, aunque venga un valor', () => {
    expect(parseRoutineStep('2', false)).toEqual({ ok: true, value: null });
  });
  it('vacío = sin paso', () => {
    expect(parseRoutineStep('', true)).toEqual({ ok: true, value: null });
  });
  it('acepta de 1 al máximo', () => {
    expect(parseRoutineStep('1', true)).toEqual({ ok: true, value: 1 });
    expect(parseRoutineStep(String(PRODUCT_LIMITS.ROUTINE_STEP_MAX), true)).toMatchObject({ ok: true });
  });
  it.each(['0', '-1', String(PRODUCT_LIMITS.ROUTINE_STEP_MAX + 1), '1.5', 'dos'])('rechaza "%s"', (raw) => {
    expect(parseRoutineStep(raw, true)).toMatchObject({ ok: false });
  });
});

describe('parseChoice', () => {
  it('una opción existente', () => {
    expect(parseChoice(ID, '', 'la marca', true)).toEqual({ ok: true, value: { kind: 'existing', id: ID } });
  });
  it('«agregar nueva» usa el nombre escrito, limpio', () => {
    expect(parseChoice(NEW_CHOICE_VALUE, '  Liderma  ', 'la marca', true)).toEqual({ ok: true, value: { kind: 'new', name: 'Liderma' } });
  });
  it('«agregar nueva» sin nombre pide el nombre', () => {
    expect(parseChoice(NEW_CHOICE_VALUE, '  ', 'la marca', true)).toMatchObject({ ok: false });
  });
  it.each(['!!!', '¿?', '---'])('«agregar nueva» con un nombre sin letras ni números ("%s") falla', (name) => {
    expect(parseChoice(NEW_CHOICE_VALUE, name, 'la marca', true)).toMatchObject({ ok: false });
  });
  it('«agregar nueva» con un nombre demasiado largo falla', () => {
    expect(parseChoice(NEW_CHOICE_VALUE, 'a'.repeat(PRODUCT_LIMITS.REFERENCE_NAME + 1), 'la marca', true)).toMatchObject({ ok: false });
  });
  it('sin elegir: falla si es obligatorio y es «ninguna» si no', () => {
    expect(parseChoice('', '', 'la marca', true)).toMatchObject({ ok: false });
    expect(parseChoice('', '', 'la línea', false)).toEqual({ ok: true, value: { kind: 'none' } });
  });
  it.each(['no-es-un-id', "1' or '1'='1", '../../etc', ID + 'x'])('un id inválido ("%s") se rechaza', (raw) => {
    expect(parseChoice(raw, '', 'la marca', true)).toMatchObject({ ok: false });
  });
  it('ignora el nombre nuevo si se eligió una existente', () => {
    expect(parseChoice(ID, 'Otra', 'la marca', true)).toEqual({ ok: true, value: { kind: 'existing', id: ID } });
  });
});

describe('parseBasicsForm', () => {
  it('arma los valores', () => {
    const result = parseBasicsForm(form({ name: ' Crema ', brand: ID, category: NEW_CHOICE_VALUE, categoryNew: 'Hidratación' }));
    expect(result).toEqual({
      ok: true,
      value: { name: 'Crema', brand: { kind: 'existing', id: ID }, category: { kind: 'new', name: 'Hidratación' } },
    });
  });
  it('junta todos los errores a la vez y devuelve lo escrito', () => {
    const result = parseBasicsForm(form({ name: '', brand: '', category: 'x', categoryNew: 'queda' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['brand', 'category', 'name']);
    expect(result.values.categoryNew).toBe('queda');
  });
  it('un formulario vacío falla sin romperse', () => {
    expect(parseBasicsForm(new FormData())).toMatchObject({ ok: false });
  });
  it('un archivo en lugar de texto cuenta como vacío', () => {
    const data = new FormData();
    data.append('name', new File(['x'], 'x.txt'));
    expect(parseBasicsForm(data)).toMatchObject({ ok: false });
  });
});

describe('parsePriceStockForm', () => {
  it('precio y unidades', () => {
    expect(parsePriceStockForm(form({ price: '$ 12.500', stock: '8' }))).toEqual({ ok: true, value: { priceArs: 12500, stock: 8 } });
  });
  it('señala qué campo está mal', () => {
    const result = parsePriceStockForm(form({ price: '0', stock: '8' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['price']);
  });
  it('0 unidades es válido (agotado)', () => {
    expect(parsePriceStockForm(form({ price: '100', stock: '0' }))).toMatchObject({ ok: true });
  });
});

describe('parseDetailsForm', () => {
  it('un formulario vacío es válido: todo es opcional', () => {
    expect(parseDetailsForm(new FormData())).toEqual({
      ok: true,
      value: {
        summary: '',
        volume: '',
        keyIngredients: '',
        benefits: [],
        usageSteps: [],
        skinTypes: [],
        warnings: '',
        usageTime: null,
        line: { kind: 'none' },
        routineStep: null,
      },
    });
  });

  it('lee todos los campos', () => {
    const result = parseDetailsForm(
      form({
        summary: 'Crema suave',
        volume: '50 ml',
        keyIngredients: 'Centella',
        benefits: 'Hidrata\n- Calma',
        usageSteps: '1. Limpiá\n2. Aplicá',
        skinTypes: ['Piel seca', 'Piel mixta'],
        warnings: 'Evitar los ojos',
        usageTime: 'night',
        line: ID,
        routineStep: '2',
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        summary: 'Crema suave',
        volume: '50 ml',
        keyIngredients: 'Centella',
        benefits: ['Hidrata', 'Calma'],
        usageSteps: ['Limpiá', 'Aplicá'],
        skinTypes: ['Piel seca', 'Piel mixta'],
        warnings: 'Evitar los ojos',
        usageTime: 'night',
        line: { kind: 'existing', id: ID },
        routineStep: 2,
      },
    });
  });

  it('el paso de rutina sin línea se ignora', () => {
    const result = parseDetailsForm(form({ routineStep: '3' }));
    expect(result).toMatchObject({ ok: true, value: { routineStep: null } });
  });

  it('una línea nueva sin nombre falla en el campo de la línea', () => {
    const result = parseDetailsForm(form({ line: NEW_CHOICE_VALUE, lineNew: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['line']);
  });

  it('un texto demasiado largo falla en su campo', () => {
    const result = parseDetailsForm(form({ summary: 'a'.repeat(PRODUCT_LIMITS.SUMMARY + 1), warnings: 'ok' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['summary']);
  });
});

describe('formValues', () => {
  it('devuelve lo escrito y deja afuera los archivos', () => {
    const data = form({ name: 'Crema', brand: ID });
    data.append('photo', new File(['x'], 'a.jpg'));
    expect(formValues(data)).toEqual({ name: 'Crema', brand: ID });
  });
  it('si un campo se repite queda el último valor', () => {
    expect(formValues(form({ skinTypes: ['a', 'b'] }))).toEqual({ skinTypes: 'b' });
  });
  it('un formulario vacío da un objeto vacío', () => {
    expect(formValues(new FormData())).toEqual({});
  });
});
