import { createServerClient, parseCookieHeader, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

// Lectura y escritura de cookies, aparte de Astro para poder probar la sesión sin levantar el sitio
export interface CookieIO {
  read(): { name: string; value: string }[];
  write(name: string, value: string, options: CookieOptions): void;
}

// La sesión solo la usa el servidor: la cookie va httpOnly (el navegador del visitante no puede leerla desde JavaScript),
// SameSite=Lax y Secure en producción. @supabase/ssr las deja legibles por defecto porque piensa en clientes de navegador.
export function sessionCookieOptions(options: CookieOptions, secure: boolean): CookieOptions {
  return { ...options, httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

// Un cliente nuevo por pedido: comparte la sesión del visitante a través de sus cookies y nunca entre visitantes
export function createServerSupabase(url: string, anonKey: string, io: CookieIO, secure: boolean): SupabaseClient {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => io.read(),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) io.write(name, value, sessionCookieOptions(options, secure));
      },
    },
  });
}

export function astroCookieIO(request: Request, cookies: AstroCookies): CookieIO {
  return {
    read: () => parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({ name, value: value ?? '' })),
    write: (name, value, options) => void cookies.set(name, value, options),
  };
}

function requireEnv(name: 'PUBLIC_SUPABASE_URL' | 'PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  return value;
}

// Cliente del panel para un pedido de Astro (middleware, páginas o endpoints)
export function adminSupabaseFor(request: Request, cookies: AstroCookies): SupabaseClient {
  return createServerSupabase(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    astroCookieIO(request, cookies),
    import.meta.env.PROD,
  );
}
