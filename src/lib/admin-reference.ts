// Marcas, categorías y líneas que Camila crea al vuelo desde el formulario del producto («+ agregar nueva»).
// Si ya existe una con el mismo slug (aunque esté escrita distinto: «Liderma», «liderma ») se reutiliza.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Choice } from './admin-product-input.ts';
import { PRODUCT_LIMITS } from './constants.ts';
import { AdminDataError } from './errors.ts';
import { slugify } from './slug.ts';

const UNIQUE_VIOLATION = '23505';

type ReferenceTable = 'brands' | 'categories' | 'product_lines';

async function findOrCreate(
  client: SupabaseClient,
  table: ReferenceTable,
  name: string,
  scope: { column: string; value: string } | null,
): Promise<string> {
  const slug = slugify(name, PRODUCT_LIMITS.REFERENCE_SLUG);
  if (slug === '') throw new AdminDataError(`El nombre "${name}" no tiene letras ni números`);

  const find = async (): Promise<string | null> => {
    let query = client.from(table).select('id').eq('slug', slug);
    if (scope) query = query.eq(scope.column, scope.value);
    const { data, error } = await query.maybeSingle();
    if (error) throw new AdminDataError(`No se pudo buscar en ${table}`, { cause: error });
    return data?.id ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const row = { slug, name, ...(scope ? { [scope.column]: scope.value } : {}) };
  const { data, error } = await client.from(table).insert(row).select('id').single();
  if (error?.code === UNIQUE_VIOLATION) {
    // otra pestaña la creó justo antes: se usa esa
    const raced = await find();
    if (raced) return raced;
  }
  if (error || !data) throw new AdminDataError(`No se pudo crear en ${table}`, { cause: error });
  return data.id;
}

export async function resolveBrandId(client: SupabaseClient, choice: Choice): Promise<string> {
  if (choice.kind === 'existing') return choice.id;
  if (choice.kind === 'new') return findOrCreate(client, 'brands', choice.name, null);
  throw new AdminDataError('Falta elegir la marca');
}

export async function resolveCategoryId(client: SupabaseClient, choice: Choice): Promise<string> {
  if (choice.kind === 'existing') return choice.id;
  if (choice.kind === 'new') return findOrCreate(client, 'categories', choice.name, null);
  throw new AdminDataError('Falta elegir la categoría');
}

// La línea pertenece a una marca: una «Línea Calmante» de Liderma no es la de otra marca
export async function resolveLineId(client: SupabaseClient, choice: Choice, brandId: string): Promise<string | null> {
  if (choice.kind === 'none') return null;
  if (choice.kind === 'existing') return choice.id;
  return findOrCreate(client, 'product_lines', choice.name, { column: 'brand_id', value: brandId });
}
