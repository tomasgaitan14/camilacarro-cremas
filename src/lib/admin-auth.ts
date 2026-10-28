// Reglas de acceso del panel /admin (puras: sin red ni framework, para poder probarlas a fondo)

export const ADMIN_PATHS = {
  HOME: '/admin',
  LOGIN: '/admin/login',
  GOOGLE: '/admin/google',
  CALLBACK: '/admin/callback',
  LOGOUT: '/admin/logout',
  NO_ACCESS: '/admin/sin-acceso',
} as const;

// Páginas del panel que se pueden ver sin haber entrado: el login y todo lo que forma parte del flujo de entrada
const PUBLIC_ADMIN_PATHS: ReadonlySet<string> = new Set([
  ADMIN_PATHS.LOGIN,
  ADMIN_PATHS.GOOGLE,
  ADMIN_PATHS.CALLBACK,
  ADMIN_PATHS.LOGOUT,
  ADMIN_PATHS.NO_ACCESS,
]);

export const ADMIN_ROLE = 'admin';
export const ADMIN_NEXT_COOKIE = 'admin_next';
export const ADMIN_NEXT_COOKIE_MAX_AGE_S = 600;
const MAX_NEXT_LENGTH = 300;
// base ficticia para resolver rutas relativas: si el resultado cambia de origen, era una URL externa
const PROBE_ORIGIN = 'http://probe.invalid';

export type LoginError = 'cancelado' | 'google' | 'sesion';

export const LOGIN_ERROR_MESSAGE: Readonly<Record<LoginError, string>> = {
  cancelado: 'Cancelaste el ingreso con Google. Cuando quieras, probá de nuevo.',
  google: 'No pudimos conectar con Google. Probá de nuevo en unos minutos.',
  sesion: 'No pudimos iniciar tu sesión. Probá de nuevo.',
};

export type OAuthErrorOutcome = 'cancelado' | 'sin-acceso' | 'google';

// Cómo tratar un error que trae la vuelta desde Google:
// - la persona canceló en la pantalla de Google -> volver al login con un aviso suave;
// - la cuenta no existe y el registro está apagado -> «sin acceso» (no es un fallo técnico);
// - cualquier otra cosa -> fallo de Google.
export function classifyOAuthError(params: { error?: string | null; errorCode?: string | null; description?: string | null }): OAuthErrorOutcome {
  const description = (params.description ?? '').toLowerCase();
  if (params.errorCode === 'signup_disabled' || description.includes('signups not allowed') || description.includes('signup is disabled')) {
    return 'sin-acceso';
  }
  if (params.error === 'access_denied') return 'cancelado';
  return 'google';
}

export function isLoginError(value: string | null | undefined): value is LoginError {
  return value === 'cancelado' || value === 'google' || value === 'sesion';
}

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATHS.HOME || pathname.startsWith(`${ADMIN_PATHS.HOME}/`);
}

export function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.has(pathname);
}

interface UserLike {
  app_metadata?: Record<string, unknown> | null;
}

// El rol vive en app_metadata, que solo se escribe con la service_role: una persona no puede darse el rol a sí misma
export function isAdminUser(user: UserLike | null | undefined): boolean {
  return user?.app_metadata?.role === ADMIN_ROLE;
}

// A dónde volver después de entrar. Solo vale una ruta interna del panel: nunca una URL de otro sitio
// (si no, el login serviría para redirigir a páginas externas) ni las páginas del propio flujo de entrada.
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw === '' || raw.length > MAX_NEXT_LENGTH) return ADMIN_PATHS.HOME;
  let resolved: URL;
  try {
    resolved = new URL(raw, PROBE_ORIGIN);
  } catch {
    return ADMIN_PATHS.HOME;
  }
  if (resolved.origin !== PROBE_ORIGIN) return ADMIN_PATHS.HOME;
  if (!isAdminPath(resolved.pathname) || isPublicAdminPath(resolved.pathname)) return ADMIN_PATHS.HOME;
  return `${resolved.pathname}${resolved.search}`;
}

export type AccessDecision = { type: 'allow' } | { type: 'redirect'; to: string };

// Qué hacer con un pedido según la ruta y quién lo hace. El rol se vuelve a leer en cada pedido.
export function decideAdminAccess(url: { pathname: string; search: string }, user: UserLike | null): AccessDecision {
  const { pathname, search } = url;
  if (!isAdminPath(pathname)) return { type: 'allow' };

  const isAdmin = isAdminUser(user);
  if (isPublicAdminPath(pathname)) {
    // quien ya entró no necesita volver a ver el login
    if (isAdmin && pathname === ADMIN_PATHS.LOGIN) return { type: 'redirect', to: ADMIN_PATHS.HOME };
    return { type: 'allow' };
  }
  if (!user) {
    const next = safeNextPath(`${pathname}${search}`);
    const query = next === ADMIN_PATHS.HOME ? '' : `?next=${encodeURIComponent(next)}`;
    return { type: 'redirect', to: `${ADMIN_PATHS.LOGIN}${query}` };
  }
  if (!isAdmin) return { type: 'redirect', to: ADMIN_PATHS.NO_ACCESS };
  return { type: 'allow' };
}

// ADMIN_EMAILS="uno@gmail.com, otro@gmail.com" -> lista limpia. Un email mal escrito falla fuerte: mejor frenar que
// dejar a alguien sin acceso en silencio.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAdminEmails(raw: string | undefined): string[] {
  const emails = (raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== '');
  for (const email of emails) {
    if (!EMAIL_SHAPE.test(email)) throw new RangeError(`Email inválido en ADMIN_EMAILS: "${email}"`);
  }
  return [...new Set(emails)];
}
