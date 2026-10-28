import type { APIRoute } from 'astro';
import { ADMIN_NEXT_COOKIE, ADMIN_NEXT_COOKIE_MAX_AGE_S, ADMIN_PATHS, safeNextPath } from '../../lib/admin-auth.ts';
import { adminSupabaseFor } from '../../lib/supabase-server.ts';

// Empieza el ingreso con Google: guarda a dónde volver y manda a la persona a la pantalla de Google
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const rawNext = form.get('next');
  cookies.set(ADMIN_NEXT_COOKIE, safeNextPath(typeof rawNext === 'string' ? rawNext : null), {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: ADMIN_PATHS.HOME,
    maxAge: ADMIN_NEXT_COOKIE_MAX_AGE_S,
  });

  const supabase = adminSupabaseFor(request, cookies);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${url.origin}${ADMIN_PATHS.CALLBACK}`,
      skipBrowserRedirect: true,
      // siempre muestra el selector de cuentas: evita entrar sin querer con otra cuenta de Google abierta
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return redirect(`${ADMIN_PATHS.LOGIN}?error=google`, 303);
  return redirect(data.url, 303);
};
