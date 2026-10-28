import type { APIRoute } from 'astro';
import { ADMIN_NEXT_COOKIE, ADMIN_PATHS, classifyOAuthError, isAdminUser, safeNextPath } from '../../lib/admin-auth.ts';
import { adminSupabaseFor } from '../../lib/supabase-server.ts';

// Vuelta desde Google: canjea el código por la sesión y deja pasar solo a las cuentas con rol admin
export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
  const providerError = url.searchParams.get('error');
  if (providerError) {
    const outcome = classifyOAuthError({
      error: providerError,
      errorCode: url.searchParams.get('error_code'),
      description: url.searchParams.get('error_description'),
    });
    return redirect(outcome === 'sin-acceso' ? ADMIN_PATHS.NO_ACCESS : `${ADMIN_PATHS.LOGIN}?error=${outcome}`, 303);
  }

  const code = url.searchParams.get('code');
  if (!code) return redirect(`${ADMIN_PATHS.LOGIN}?error=google`, 303);

  const supabase = adminSupabaseFor(request, cookies);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return redirect(`${ADMIN_PATHS.LOGIN}?error=sesion`, 303);

  if (!isAdminUser(data.user)) {
    // una cuenta de Google válida pero sin permiso: no queda ninguna sesión abierta
    await supabase.auth.signOut();
    return redirect(ADMIN_PATHS.NO_ACCESS, 303);
  }

  const next = safeNextPath(cookies.get(ADMIN_NEXT_COOKIE)?.value);
  cookies.delete(ADMIN_NEXT_COOKIE, { path: ADMIN_PATHS.HOME });
  return redirect(next, 303);
};
