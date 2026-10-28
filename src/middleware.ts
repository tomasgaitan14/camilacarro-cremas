import { defineMiddleware } from 'astro:middleware';
import { decideAdminAccess, isAdminPath, isAdminUser } from './lib/admin-auth.ts';
import { adminSupabaseFor } from './lib/supabase-server.ts';

// Nada del panel se guarda en cachés ni aparece en buscadores
const ADMIN_RESPONSE_HEADERS = {
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  expires: '0',
  'x-robots-tag': 'noindex, nofollow',
} as const;

// Solo el panel pasa por acá: la tienda pública no hace ninguna consulta de sesión
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  if (!isAdminPath(pathname)) return next();

  const supabase = adminSupabaseFor(context.request, context.cookies);
  // getUser() valida la sesión contra el servidor de Supabase (y renueva la cookie si venció): no se confía en la cookie sola
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decideAdminAccess({ pathname, search }, user);
  let response: Response;
  if (decision.type === 'redirect') {
    response = context.redirect(decision.to, 303);
  } else {
    if (user && isAdminUser(user)) {
      context.locals.supabase = supabase;
      context.locals.adminUser = user;
    }
    response = await next();
  }
  for (const [name, value] of Object.entries(ADMIN_RESPONSE_HEADERS)) response.headers.set(name, value);
  return response;
});
