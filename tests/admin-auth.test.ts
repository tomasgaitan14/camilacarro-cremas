import { describe, expect, it } from 'vitest';
import {
  ADMIN_PATHS,
  classifyOAuthError,
  decideAdminAccess,
  isAdminPath,
  isAdminUser,
  isLoginError,
  isPublicAdminPath,
  parseAdminEmails,
  safeNextPath,
} from '../src/lib/admin-auth.ts';

const admin = { app_metadata: { role: 'admin' } };
const regular = { app_metadata: {} };

describe('isAdminPath / isPublicAdminPath', () => {
  it.each(['/admin', '/admin/', '/admin/productos', '/admin/productos/nuevo'])('%s es del panel', (path) => {
    expect(isAdminPath(path)).toBe(true);
  });

  it.each(['/', '/productos', '/administrador', '/admin-extra', '/api/admin', '/Admin'])('%s no es del panel', (path) => {
    expect(isAdminPath(path)).toBe(false);
  });

  it('solo las páginas del flujo de entrada son públicas', () => {
    for (const path of [ADMIN_PATHS.LOGIN, ADMIN_PATHS.GOOGLE, ADMIN_PATHS.CALLBACK, ADMIN_PATHS.LOGOUT, ADMIN_PATHS.NO_ACCESS]) {
      expect(isPublicAdminPath(path)).toBe(true);
    }
    for (const path of ['/admin', '/admin/productos', '/admin/login/otra', '/admin/loginx']) {
      expect(isPublicAdminPath(path)).toBe(false);
    }
  });
});

describe('isAdminUser', () => {
  it('reconoce el rol admin', () => {
    expect(isAdminUser(admin)).toBe(true);
  });

  it.each([
    ['sin usuario', null],
    ['undefined', undefined],
    ['sin metadata', {}],
    ['metadata nula', { app_metadata: null }],
    ['rol distinto', { app_metadata: { role: 'editor' } }],
    ['rol en mayúsculas', { app_metadata: { role: 'ADMIN' } }],
    ['rol como lista', { app_metadata: { role: ['admin'] } }],
    ['solo en user_metadata (editable por la propia persona)', { app_metadata: {}, user_metadata: { role: 'admin' } }],
  ])('no es admin: %s', (_label, user) => {
    expect(isAdminUser(user as never)).toBe(false);
  });
});

describe('safeNextPath', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/productos', '/admin/productos'],
    ['/admin/productos?estado=borrador', '/admin/productos?estado=borrador'],
    ['/admin/productos#abajo', '/admin/productos'],
  ])('acepta %s', (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    ['https://evil.com/admin', 'URL absoluta'],
    ['//evil.com/admin', 'protocolo relativo'],
    // con una ruta del panel detrás: sin mirar el sitio de destino, el resultado sería una ruta interna «válida»
    ['https://evil.com/admin/productos', 'URL absoluta con ruta del panel'],
    ['//evil.com/admin/productos', 'protocolo relativo con ruta del panel'],
    ['/\\evil.com', 'barra invertida'],
    ['\\\\evil.com\\admin', 'doble barra invertida'],
    ['javascript:alert(1)', 'esquema javascript'],
    ['data:text/html,<script>', 'esquema data'],
    ['/productos', 'fuera del panel'],
    ['/admin/../productos', 'sube fuera del panel'],
    ['/administrador', 'prefijo parecido'],
    ['/admin/login', 'página del flujo de entrada (bucle)'],
    ['/admin/callback?code=1', 'callback (bucle)'],
    ['', 'vacío'],
    ['x'.repeat(400), 'demasiado largo'],
    [`/admin/${'x'.repeat(400)}`, 'ruta del panel demasiado larga'],
  ])('rechaza %s (%s) y vuelve al inicio', (raw) => {
    expect(safeNextPath(raw)).toBe(ADMIN_PATHS.HOME);
  });

  it.each([null, undefined])('sin valor (%s) vuelve al inicio', (raw) => {
    expect(safeNextPath(raw)).toBe(ADMIN_PATHS.HOME);
  });
});

describe('decideAdminAccess', () => {
  const at = (pathname: string, search = '') => ({ pathname, search });

  it('la tienda pública no se toca', () => {
    expect(decideAdminAccess(at('/productos'), null)).toEqual({ type: 'allow' });
    expect(decideAdminAccess(at('/'), regular)).toEqual({ type: 'allow' });
  });

  it('sin sesión, el panel manda al login recordando a dónde ir', () => {
    expect(decideAdminAccess(at('/admin/productos', '?estado=borrador'), null)).toEqual({
      type: 'redirect',
      to: '/admin/login?next=%2Fadmin%2Fproductos%3Festado%3Dborrador',
    });
  });

  it('sin sesión en el inicio del panel no hace falta recordar nada', () => {
    expect(decideAdminAccess(at('/admin'), null)).toEqual({ type: 'redirect', to: '/admin/login' });
  });

  it('una cuenta común (sin rol) va a «sin acceso»', () => {
    expect(decideAdminAccess(at('/admin'), regular)).toEqual({ type: 'redirect', to: '/admin/sin-acceso' });
    expect(decideAdminAccess(at('/admin/productos/nuevo'), regular)).toEqual({ type: 'redirect', to: '/admin/sin-acceso' });
  });

  it('un admin entra', () => {
    expect(decideAdminAccess(at('/admin'), admin)).toEqual({ type: 'allow' });
    expect(decideAdminAccess(at('/admin/productos'), admin)).toEqual({ type: 'allow' });
  });

  it('el flujo de entrada es accesible sin sesión', () => {
    for (const path of [ADMIN_PATHS.LOGIN, ADMIN_PATHS.GOOGLE, ADMIN_PATHS.CALLBACK, ADMIN_PATHS.LOGOUT, ADMIN_PATHS.NO_ACCESS]) {
      expect(decideAdminAccess(at(path), null)).toEqual({ type: 'allow' });
    }
  });

  it('quien ya entró no vuelve a ver el login', () => {
    expect(decideAdminAccess(at(ADMIN_PATHS.LOGIN), admin)).toEqual({ type: 'redirect', to: '/admin' });
  });

  it('una cuenta común sí puede ver el login y «sin acceso» (para probar con otra cuenta)', () => {
    expect(decideAdminAccess(at(ADMIN_PATHS.LOGIN), regular)).toEqual({ type: 'allow' });
    expect(decideAdminAccess(at(ADMIN_PATHS.NO_ACCESS), regular)).toEqual({ type: 'allow' });
  });
});

describe('classifyOAuthError', () => {
  it('cancelar en Google vuelve al login con un aviso suave', () => {
    expect(classifyOAuthError({ error: 'access_denied' })).toBe('cancelado');
  });

  it.each([
    [{ error: 'server_error', errorCode: 'signup_disabled' }],
    [{ error: 'server_error', description: 'Signups not allowed for this instance' }],
    [{ error: 'access_denied', description: 'Signups not allowed for this instance' }],
  ])('una cuenta no habilitada (registro apagado) es «sin acceso»: %j', (params) => {
    expect(classifyOAuthError(params)).toBe('sin-acceso');
  });

  it.each([[{ error: 'server_error' }], [{ error: 'temporarily_unavailable' }], [{}]])('cualquier otro error es un fallo de Google: %j', (params) => {
    expect(classifyOAuthError(params)).toBe('google');
  });
});

describe('isLoginError', () => {
  it('solo acepta los códigos conocidos', () => {
    expect(isLoginError('cancelado')).toBe(true);
    expect(isLoginError('google')).toBe(true);
    expect(isLoginError('sesion')).toBe(true);
    for (const value of ['<script>alert(1)</script>', '', 'otro', null, undefined]) expect(isLoginError(value)).toBe(false);
  });
});

describe('parseAdminEmails', () => {
  it('limpia espacios, pasa a minúsculas y quita repetidos', () => {
    expect(parseAdminEmails(' Camila@Gmail.com , tom@gmail.com,camila@gmail.com ')).toEqual(['camila@gmail.com', 'tom@gmail.com']);
  });

  it('sin valor devuelve una lista vacía', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails('')).toEqual([]);
    expect(parseAdminEmails(' , ,')).toEqual([]);
  });

  it.each(['sin-arroba', 'a@b', '@gmail.com', 'dos espacios@gmail.com', 'ok@gmail.com,roto'])('un email mal escrito falla fuerte: "%s"', (raw) => {
    expect(() => parseAdminEmails(raw)).toThrow(RangeError);
  });
});
