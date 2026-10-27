import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente con la anon key: la seguridad la da la RLS, no el secreto de la key.
// La service_role nunca se usa acá (solo en scripts/).
export function createPublicClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireEnv(name: 'PUBLIC_SUPABASE_URL' | 'PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  }
  return value;
}

export function getPublicClient(): SupabaseClient {
  return createPublicClient(requireEnv('PUBLIC_SUPABASE_URL'), requireEnv('PUBLIC_SUPABASE_ANON_KEY'));
}
