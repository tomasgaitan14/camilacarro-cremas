import { defineMiddleware } from 'astro:middleware';
import { decideAdminAccess, isAdminPath, isAdminUser } from './lib/admin-auth.ts';
import { NOINDEX_HEADER, isAdminEnabled, isNoindex } from './lib/site-flags.ts';
import { adminSupabaseFor } from './lib/supabase-server.ts';

// Nada del panel se guarda en cachés ni aparece en buscadores
const ADMIN_RESPONSE_HEADERS = {
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  expires: '0',
  'x-robots-tag': 'noindex, nofollow',
} as const;

// Estos interruptores salen del entorno del servidor en cada pedido. En producción NO se usa import.meta.env: Astro
// lo fija al compilar y un .env presente en ese momento dejaría el panel encendido para siempre. En desarrollo
// (astro dev) process.env no trae el .env, así que ahí sí se lee de import.meta.env.
const serverEnv = {
  adminEnabled: () => process.env.ADMIN_ENABLED ?? (import.meta.env.DEV ? import.meta.env.ADMIN_ENABLED : undefined),
  siteNoindex: () => process.env.SITE_NOINDEX ?? (import.meta.env.DEV ? import.meta.env.SITE_NOINDEX : undefined),
};

// Solo el panel hace consultas de sesión: la tienda pública pasa de largo (en un demo se le agrega noindex)
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const noindex = isNoindex(serverEnv.siteNoindex());

  if (!isAdminPath(pathname)) {
    const response = await next();
    if (noindex) response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
    return response;
  }

  // Con el panel apagado, /admin no existe para nadie: responde como cualquier página inexistente
  if (!isAdminEnabled(serverEnv.adminEnabled())) return context.rewrite('/404');

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
