import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { createServerSupabase, type CookieIO } from '../../src/lib/supabase-server.ts';
import { SUPABASE_URL, serviceClient } from './supabase.ts';

export interface CookieWrite {
  name: string;
  value: string;
  options: CookieOptions;
}

// Un "navegador" en memoria: guarda las cookies que escribe el servidor y las devuelve en el pedido siguiente
export function cookieJar() {
  const store = new Map<string, string>();
  const writes: CookieWrite[] = [];
  const io: CookieIO = {
    read: () => [...store].map(([name, value]) => ({ name, value })),
    write: (name, value, options) => {
      writes.push({ name, value, options });
      if (value === '') store.delete(name);
      else store.set(name, value);
    },
  };
  return {
    io,
    store,
    writes,
    // el valor del encabezado Cookie tal como lo mandaría un navegador (valores codificados)
    header: () => [...store].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; '),
  };
}

export function serverClient(io: CookieIO, secure = false): SupabaseClient {
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('Falta PUBLIC_SUPABASE_ANON_KEY en .env');
  return createServerSupabase(SUPABASE_URL, anonKey, io, secure);
}

export interface TestAccount {
  email: string;
  password: string;
  id: string;
  remove: () => Promise<void>;
}

// Cuenta de prueba con contraseña (el login con contraseña solo existe en el Supabase local, para estos tests)
export async function createAccount(appMetadata: Record<string, unknown> = {}): Promise<TestAccount> {
  const service = serviceClient();
  const email = `test-${randomUUID()}@camilacarro.test`;
  const password = randomUUID();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: appMetadata });
  if (error) throw new Error('No se pudo crear la cuenta de prueba', { cause: error });
  return { email, password, id: data.user.id, remove: async () => void (await service.auth.admin.deleteUser(data.user.id)) };
}

export async function signInWithJar(account: TestAccount, secure = false) {
  const jar = cookieJar();
  const { error } = await serverClient(jar.io, secure).auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`No se pudo entrar como ${account.email}`, { cause: error });
  return jar;
}
