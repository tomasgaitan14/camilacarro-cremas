// Lectura y validación de lo que Camila escribe en los formularios del panel (puro: sin red ni framework).
// Cada función devuelve un mensaje claro en español, pensado para quien no es técnica.
import { NEW_CHOICE_VALUE, PRODUCT_LIMITS, USAGE_TIME, type UsageTime } from './constants.ts';
import { slugify } from './slug.ts';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export type FormResult<T> =
  | { ok: true; value: T }
  // values: lo que la persona escribió, para volver a mostrarlo sin que pierda nada
  | { ok: false; errors: Record<string, string>; values: Record<string, string> };

export type Choice = { kind: 'existing'; id: string } | { kind: 'new'; name: string } | { kind: 'none' };

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// «12.500», «12500», «$ 12.500»: puntos solo como separador de miles
const PRICE_SHAPE = /^(\d{1,3}(\.\d{3})+|\d+)$/;
// lo que Camila pega desde otro lado a veces trae viñetas o numeración
const LIST_MARKER = /^(?:[-•*–·]|\d{1,2}[.)])\s+/;
// caracteres de control (menos salto de línea y tabulación): rompen la ficha y no se ven
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

function clean(raw: string): string {
  return raw.replace(CONTROL_CHARS, '').trim();
}

export function parseName(raw: string, label: string, max: number): Parsed<string> {
  const value = clean(raw).replace(/\s+/g, ' ');
  if (value === '') return fail(`Escribí ${label}.`);
  if (value.length > max) return fail(`Es muy largo: máximo ${max} letras.`);
  return ok(value);
}

export function parseOptionalText(raw: string, max: number): Parsed<string> {
  const value = clean(raw);
  if (value.length > max) return fail(`Es muy largo: máximo ${max} letras (escribiste ${value.length}).`);
  return ok(value);
}

export function parsePriceArs(raw: string): Parsed<number> {
  const text = raw.replace(/[$\s]/g, '');
  if (text === '') return fail('Escribí el precio.');
  if (/[,]/.test(text) || /^\d+\.\d{1,2}$/.test(text)) return fail('Poné el precio en pesos, sin centavos.');
  if (!PRICE_SHAPE.test(text)) return fail('El precio solo puede llevar números. Por ejemplo: 12500');
  const value = Number(text.replace(/\./g, ''));
  if (value < 1) return fail('El precio tiene que ser mayor a cero.');
  if (value > PRODUCT_LIMITS.PRICE_ARS_MAX) return fail('Ese precio parece demasiado alto. Revisalo.');
  return ok(value);
}

export function parseStock(raw: string): Parsed<number> {
  const text = raw.trim();
  if (text === '') return fail('Escribí cuántas unidades tenés (puede ser 0).');
  if (!/^\d+$/.test(text)) return fail('Las unidades tienen que ser un número entero, por ejemplo: 8');
  const value = Number(text);
  if (value > PRODUCT_LIMITS.STOCK_MAX) return fail(`El máximo es ${PRODUCT_LIMITS.STOCK_MAX} unidades.`);
  return ok(value);
}

// Un texto con un ítem por renglón -> lista limpia (sin vacíos, viñetas ni repetidos)
export function parseLines(raw: string, maxItems: number): Parsed<string[]> {
  const items: string[] = [];
  for (const line of clean(raw).split(/\r?\n/)) {
    const item = line.replace(LIST_MARKER, '').trim();
    if (item === '' || items.includes(item)) continue;
    if (item.length > PRODUCT_LIMITS.LIST_ITEM) {
      return fail(`Un renglón es muy largo: máximo ${PRODUCT_LIMITS.LIST_ITEM} letras cada uno.`);
    }
    items.push(item);
  }
  if (items.length > maxItems) return fail(`Pusiste ${items.length} renglones y el máximo es ${maxItems}.`);
  return ok(items);
}

export function parseSkinTypes(values: readonly string[]): Parsed<string[]> {
  const items = [...new Set(values.map(clean).filter((value) => value !== ''))];
  if (items.some((item) => item.length > PRODUCT_LIMITS.SKIN_TYPE_ITEM)) return fail('Un tipo de piel es demasiado largo.');
  if (items.length > PRODUCT_LIMITS.SKIN_TYPES) return fail(`Elegí hasta ${PRODUCT_LIMITS.SKIN_TYPES} tipos de piel.`);
  return ok(items);
}

export function parseUsageTime(raw: string): Parsed<UsageTime | null> {
  if (raw === '') return ok(null);
  const known = Object.values(USAGE_TIME) as string[];
  return known.includes(raw) ? ok(raw as UsageTime) : fail('Elegí una de las opciones.');
}

// El paso de la rutina solo existe dentro de una línea
export function parseRoutineStep(raw: string, hasLine: boolean): Parsed<number | null> {
  if (raw === '' || !hasLine) return ok(null);
  if (!/^\d+$/.test(raw)) return fail('Elegí una de las opciones.');
  const value = Number(raw);
  if (value < 1 || value > PRODUCT_LIMITS.ROUTINE_STEP_MAX) return fail('Elegí una de las opciones.');
  return ok(value);
}

// Desplegable + «agregar nueva». required = la marca y la categoría no pueden quedar vacías.
export function parseChoice(select: string, newName: string, label: string, required: boolean): Parsed<Choice> {
  if (select === NEW_CHOICE_VALUE) {
    const name = parseName(newName, `el nombre de ${label}`, PRODUCT_LIMITS.REFERENCE_NAME);
    if (!name.ok) return name;
    // el nombre se convierte en el slug de la marca/categoría/línea: tiene que quedar algo
    if (slugify(name.value, PRODUCT_LIMITS.REFERENCE_SLUG) === '') return fail('El nombre tiene que llevar letras o números.');
    return ok({ kind: 'new', name: name.value });
  }
  if (select === '') return required ? fail(`Elegí ${label}.`) : ok({ kind: 'none' });
  if (!UUID_SHAPE.test(select)) return fail(`Elegí ${label} de la lista.`);
  return ok({ kind: 'existing', id: select });
}

// ---------- Formularios completos (FormData -> valores listos para guardar) ----------

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

// Lo que la persona escribió, para volver a mostrarlo si el guardado falla (los archivos no se devuelven)
export function formValues(form: FormData): Record<string, string> {
  return Object.fromEntries([...form].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export function texts(form: FormData, name: string): string[] {
  return form.getAll(name).filter((value): value is string => typeof value === 'string');
}

interface Collector {
  errors: Record<string, string>;
  take<T>(field: string, parsed: Parsed<T>): T | undefined;
}

function collector(): Collector {
  const errors: Record<string, string> = {};
  return {
    errors,
    take(field, parsed) {
      if (parsed.ok) return parsed.value;
      errors[field] = parsed.error;
      return undefined;
    },
  };
}

function finish<T>(c: Collector, values: Record<string, string>, build: () => T): FormResult<T> {
  return Object.keys(c.errors).length > 0 ? { ok: false, errors: c.errors, values } : { ok: true, value: build() };
}

export interface BasicsInput {
  name: string;
  brand: Choice;
  category: Choice;
}

export function parseBasicsForm(form: FormData): FormResult<BasicsInput> {
  const c = collector();
  const values = {
    name: text(form, 'name'),
    brand: text(form, 'brand'),
    brandNew: text(form, 'brandNew'),
    category: text(form, 'category'),
    categoryNew: text(form, 'categoryNew'),
  };
  const name = c.take('name', parseName(values.name, 'el nombre del producto', PRODUCT_LIMITS.NAME));
  const brand = c.take('brand', parseChoice(values.brand, values.brandNew, 'la marca', true));
  const category = c.take('category', parseChoice(values.category, values.categoryNew, 'la categoría', true));
  return finish(c, values, () => ({ name: name as string, brand: brand as Choice, category: category as Choice }));
}

export interface PriceStockInput {
  priceArs: number;
  stock: number;
}

export function parsePriceStockForm(form: FormData): FormResult<PriceStockInput> {
  const c = collector();
  const values = { price: text(form, 'price'), stock: text(form, 'stock') };
  const priceArs = c.take('price', parsePriceArs(values.price));
  const stock = c.take('stock', parseStock(values.stock));
  return finish(c, values, () => ({ priceArs: priceArs as number, stock: stock as number }));
}

export interface DetailsInput {
  summary: string;
  volume: string;
  keyIngredients: string;
  benefits: string[];
  usageSteps: string[];
  skinTypes: string[];
  warnings: string;
  usageTime: UsageTime | null;
  line: Choice;
  routineStep: number | null;
}

// Todo opcional: un campo vacío es válido y deja el dato sin cargar
export function parseDetailsForm(form: FormData): FormResult<DetailsInput> {
  const c = collector();
  const values = {
    summary: text(form, 'summary'),
    volume: text(form, 'volume'),
    keyIngredients: text(form, 'keyIngredients'),
    benefits: text(form, 'benefits'),
    usageSteps: text(form, 'usageSteps'),
    warnings: text(form, 'warnings'),
    usageTime: text(form, 'usageTime'),
    line: text(form, 'line'),
    lineNew: text(form, 'lineNew'),
    routineStep: text(form, 'routineStep'),
  };
  const summary = c.take('summary', parseOptionalText(values.summary, PRODUCT_LIMITS.SUMMARY));
  const volume = c.take('volume', parseOptionalText(values.volume, PRODUCT_LIMITS.VOLUME));
  const keyIngredients = c.take('keyIngredients', parseOptionalText(values.keyIngredients, PRODUCT_LIMITS.KEY_INGREDIENTS));
  const benefits = c.take('benefits', parseLines(values.benefits, PRODUCT_LIMITS.BENEFITS));
  const usageSteps = c.take('usageSteps', parseLines(values.usageSteps, PRODUCT_LIMITS.USAGE_STEPS));
  const skinTypes = c.take('skinTypes', parseSkinTypes(texts(form, 'skinTypes')));
  const warnings = c.take('warnings', parseOptionalText(values.warnings, PRODUCT_LIMITS.WARNINGS));
  const usageTime = c.take('usageTime', parseUsageTime(values.usageTime));
  const line = c.take('line', parseChoice(values.line, values.lineNew, 'la línea', false));
  const routineStep = c.take('routineStep', parseRoutineStep(values.routineStep, line !== undefined && line.kind !== 'none'));
  return finish(c, values, () => ({
    summary: summary as string,
    volume: volume as string,
    keyIngredients: keyIngredients as string,
    benefits: benefits as string[],
    usageSteps: usageSteps as string[],
    skinTypes: skinTypes as string[],
    warnings: warnings as string,
    usageTime: usageTime as UsageTime | null,
    line: line as Choice,
    routineStep: routineStep as number | null,
  }));
}
