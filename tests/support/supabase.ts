import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { createPublicClient } from '../../src/lib/supabase.ts';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env (ver .env.example)`);
  return value;
}

export const SUPABASE_URL = requireEnv('PUBLIC_SUPABASE_URL');

// Los tests crean y borran datos: solo contra la base local
if (!LOCAL_HOSTS.has(new URL(SUPABASE_URL).hostname)) {
  throw new Error(`Los tests de integración solo corren contra Supabase local, no contra ${SUPABASE_URL}`);
}

export const anonClient = (): SupabaseClient => createPublicClient(SUPABASE_URL, requireEnv('PUBLIC_SUPABASE_ANON_KEY'));

export const serviceClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}`, { cause: error });
  return client;
}

export const adminClient = (): Promise<SupabaseClient> =>
  signedInClient(requireEnv('SEED_ADMIN_EMAIL'), requireEnv('SEED_ADMIN_PASSWORD'));

export interface TestUser {
  client: SupabaseClient;
  remove: () => Promise<void>;
}

// Usuario autenticado pero SIN rol admin: la RLS tiene que tratarlo igual que a un anónimo para escribir
export async function createRegularUser(): Promise<TestUser> {
  const service = serviceClient();
  const email = `test-${randomUUID()}@camilacarro.test`;
  const password = randomUUID();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('No se pudo crear el usuario de prueba', { cause: error });
  const client = await signedInClient(email, password);
  return { client, remove: async () => void (await service.auth.admin.deleteUser(data.user.id)) };
}

export async function assertSupabaseIsUp(): Promise<void> {
  try {
    const { error } = await anonClient().from('brands').select('id').limit(1);
    if (error) throw error;
  } catch (cause) {
    throw new Error('Supabase local no responde: corré `npm run db:start` antes de los tests', { cause });
  }
}

export interface Fixture {
  tag: string;
  brandId: string;
  categoryId: string;
  lineId: string;
  publishedId: string;
  draftId: string;
  cleanup: () => Promise<void>;
}

// Datos de prueba aislados: todo lleva un tag único para no chocar con el seed ni con otros archivos
export async function createFixture(): Promise<Fixture> {
  const service = serviceClient();
  const tag = `t${randomUUID().slice(0, 8)}`;

  const brand = await service.from('brands').insert({ slug: `${tag}-brand`, name: `Marca ${tag}` }).select().single();
  const category = await service
    .from('categories')
    .insert({ slug: `${tag}-cat`, name: `Categoria ${tag}` })
    .select()
    .single();
  if (brand.error || category.error) throw new Error('No se pudo crear marca/categoría de prueba', { cause: brand.error ?? category.error });

  const line = await service
    .from('product_lines')
    .insert({ brand_id: brand.data.id, slug: `${tag}-line`, name: `Linea ${tag}`, description: 'Línea de prueba' })
    .select()
    .single();
  if (line.error) throw new Error('No se pudo crear la línea de prueba', { cause: line.error });

  const base = { brand_id: brand.data.id, category_id: category.data.id, price_ars: 1000, stock: 3 };
  const published = await service
    .from('products')
    .insert({ ...base, slug: `${tag}-published`, name: `Publicado ${tag}`, status: 'published', line_id: line.data.id, routine_step: 1 })
    .select()
    .single();
  const draft = await service
    .from('products')
    .insert({ ...base, slug: `${tag}-draft`, name: `Borrador ${tag}`, status: 'draft' })
    .select()
    .single();
  if (published.error || draft.error) throw new Error('No se pudieron crear los productos de prueba', { cause: published.error ?? draft.error });

  return {
    tag,
    brandId: brand.data.id,
    categoryId: category.data.id,
    lineId: line.data.id,
    publishedId: published.data.id,
    draftId: draft.data.id,
    cleanup: async () => {
      await service.from('products').delete().eq('brand_id', brand.data.id);
      await service.from('product_lines').delete().eq('id', line.data.id);
      await service.from('brands').delete().eq('id', brand.data.id);
      await service.from('categories').delete().eq('id', category.data.id);
    },
  };
}
