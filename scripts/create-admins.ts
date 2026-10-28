// Habilita las cuentas que pueden entrar al panel con Google. Lee los emails de ADMIN_EMAILS (en .env) y deja cada
// cuenta creada, con el email confirmado y el rol admin. Se puede repetir sin riesgo.
// Uso: npm run admins:create   (contra Supabase local)
//      npm run admins:create -- --remote   (contra el proyecto de .env aunque no sea local: se pide a propósito)
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { ensureAdminUser } from '../src/lib/admin-accounts.ts';
import { parseAdminEmails } from '../src/lib/admin-auth.ts';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env (ver .env.example)`);
  return value;
}

const url = requireEnv('PUBLIC_SUPABASE_URL');
const remote = process.argv.includes('--remote');
if (!remote && !LOCAL_HOSTS.has(new URL(url).hostname)) {
  throw new Error(`El proyecto ${url} no es local: para crear cuentas ahí hay que pasar --remote a propósito`);
}

const emails = parseAdminEmails(process.env.ADMIN_EMAILS);
if (emails.length === 0) throw new Error('ADMIN_EMAILS está vacío: poné los emails separados por coma en .env');

const service = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Proyecto: ${url}`);
for (const email of emails) console.log(`${email}: ${await ensureAdminUser(service, email)}`);
