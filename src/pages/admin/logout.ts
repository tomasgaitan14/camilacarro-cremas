import type { APIRoute } from 'astro';
import { ADMIN_PATHS } from '../../lib/admin-auth.ts';
import { adminSupabaseFor } from '../../lib/supabase-server.ts';

// Solo POST: así un enlace o una imagen de otro sitio no puede cerrar la sesión
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  await adminSupabaseFor(request, cookies).auth.signOut();
  return redirect(ADMIN_PATHS.LOGIN, 303);
};
