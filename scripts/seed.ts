// Seed local: usuario admin e imágenes de demo. Los datos de las tablas están en supabase/seed.sql.
// Uso: npm run db:seed (con `npm run db:start` corriendo)
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { IMAGE_KIND, STORAGE_BUCKET } from '../src/lib/constants.ts';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const ASSETS_DIR = new URL('../supabase/seed-assets/', import.meta.url);
const ADMIN_ROLE = 'admin';

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env (ver .env.example)`);
  return value;
}

const url = requireEnv('PUBLIC_SUPABASE_URL');
// Datos de demo y una contraseña de desarrollo: jamás contra un proyecto real
if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
  throw new Error(`El seed solo corre contra Supabase local, no contra ${url}`);
}

const supabase = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureAdmin(email: string, password: string): Promise<void> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error('No se pudo listar usuarios', { cause: listError });

  const existing = list.users.find((user) => user.email === email);
  const attributes = { password, email_confirm: true, app_metadata: { role: ADMIN_ROLE } };
  const { error } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, attributes)
    : await supabase.auth.admin.createUser({ email, ...attributes });
  if (error) throw new Error(`No se pudo ${existing ? 'actualizar' : 'crear'} el admin`, { cause: error });
  console.log(`Admin ${existing ? 'actualizado' : 'creado'}: ${email}`);
}

async function seedImages(): Promise<void> {
  const { data: products, error } = await supabase.from('products').select('id, slug, name');
  if (error) throw new Error('No se pudieron leer los productos', { cause: error });

  for (const product of products) {
    const path = `${product.slug}.webp`;
    let file: Buffer;
    try {
      file = await readFile(new URL(path, ASSETS_DIR));
    } catch {
      console.log(`Sin imagen de demo para ${product.slug}, se omite`);
      continue;
    }

    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: 'image/webp', upsert: true });
    if (upload.error) throw new Error(`No se pudo subir ${path}`, { cause: upload.error });

    const { error: imageError } = await supabase
      .from('product_images')
      .upsert(
        { product_id: product.id, path, alt: product.name, position: 0, kind: IMAGE_KIND.MAIN },
        { onConflict: 'product_id,position' },
      );
    if (imageError) throw new Error(`No se pudo registrar la imagen de ${product.slug}`, { cause: imageError });
    console.log(`Imagen: ${path}`);
  }
}

await ensureAdmin(requireEnv('SEED_ADMIN_EMAIL'), requireEnv('SEED_ADMIN_PASSWORD'));
await seedImages();
