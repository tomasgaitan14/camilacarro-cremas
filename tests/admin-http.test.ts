import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSupabaseIsUp } from './support/supabase.ts';
import { startSite } from './support/site.ts';
import { cookieJar, createAccount, signInWithJar, type TestAccount } from './support/session.ts';

const SITE_START_TIMEOUT_MS = 120_000;
let site: Awaited<ReturnType<typeof startSite>>;
const accounts: TestAccount[] = [];

beforeAll(async () => {
  await assertSupabaseIsUp();
  site = await startSite();
}, SITE_START_TIMEOUT_MS);

afterAll(async () => {
  await site?.stop();
  await Promise.all(accounts.map((account) => account.remove()));
});

const get = (path: string, init: RequestInit = {}) => fetch(`${site.origin}${path}`, { redirect: 'manual', ...init });
const formPost = (path: string, origin: string | null, body = '') =>
  fetch(`${site.origin}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin ? { origin } : {}) },
    body,
  });

async function sessionCookie(appMetadata: Record<string, unknown>) {
  const account = await createAccount(appMetadata);
  accounts.push(account);
  return (await signInWithJar(account)).header();
}

describe('protección del panel (sitio compilado en producción)', () => {
  it('sin sesión, /admin manda al login', async () => {
    const response = await get('/admin');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login');
  });

  it('sin sesión, una página interna del panel recuerda a dónde ir', async () => {
    const response = await get('/admin/productos/nuevo?paso=2');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login?next=%2Fadmin%2Fproductos%2Fnuevo%3Fpaso%3D2');
  });

  it('lo que no existe dentro de /admin tampoco se revela: también va al login', async () => {
    const response = await get('/admin/lo-que-sea');
    expect(response.status).toBe(303);
  });

  it('las respuestas del panel no se guardan en cachés ni se indexan', async () => {
    for (const path of ['/admin', '/admin/login']) {
      const response = await get(path);
      expect(response.headers.get('cache-control'), path).toContain('no-store');
      expect(response.headers.get('x-robots-tag'), path).toBe('noindex, nofollow');
    }
  });

  it('la tienda pública sigue sin pasar por el control de sesión ni llevar esas cabeceras', async () => {
    const response = await get('/productos');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBeNull();
  });

  it('una cuenta común (sin rol) va a «sin acceso»', async () => {
    const response = await get('/admin', { headers: { cookie: await sessionCookie({}) } });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/sin-acceso');
  });

  it('un admin entra al panel', async () => {
    const response = await get('/admin', { headers: { cookie: await sessionCookie({ role: 'admin' }) } });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Entraste bien a tu panel');
    expect(html).toContain('Salir');
  });

  it('un admin que abre el login vuelve al inicio del panel', async () => {
    const response = await get('/admin/login', { headers: { cookie: await sessionCookie({ role: 'admin' }) } });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin');
  });

  it('una cookie de sesión adulterada no sirve', async () => {
    const real = await sessionCookie({ role: 'admin' });
    const tampered = real.replace(/(=[^;]{10})[^;]{6}/g, '$1XXXXXX');
    const response = await get('/admin', { headers: { cookie: tampered } });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login');
  });

  it('una cookie con el rol quitado deja de dar acceso aunque la sesión siga vigente', async () => {
    const account = await createAccount({ role: 'admin' });
    accounts.push(account);
    const cookie = (await signInWithJar(account)).header();
    expect((await get('/admin', { headers: { cookie } })).status).toBe(200);

    const { serviceClient } = await import('./support/supabase.ts');
    await serviceClient().auth.admin.updateUserById(account.id, { app_metadata: { role: null } });
    const response = await get('/admin', { headers: { cookie } });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/sin-acceso');
  });
});

describe('pantalla de login', () => {
  it('muestra el botón de Google', async () => {
    const html = await (await get('/admin/login')).text();
    expect(html).toContain('Entrar con Google');
    expect(html).toContain('action="/admin/google"');
    expect(html).toContain('noindex');
  });

  it('un next hacia otro sitio se descarta', async () => {
    const html = await (await get('/admin/login?next=https%3A%2F%2Fevil.example%2Fadmin')).text();
    expect(html).toContain('name="next" value="/admin"');
    expect(html).not.toContain('evil.example');
  });

  it('un next válido se conserva', async () => {
    const html = await (await get('/admin/login?next=%2Fadmin%2Fproductos')).text();
    expect(html).toContain('value="/admin/productos"');
  });

  it('muestra los avisos conocidos y no refleja texto arbitrario', async () => {
    expect(await (await get('/admin/login?error=cancelado')).text()).toContain('Cancelaste el ingreso con Google');
    const html = await (await get('/admin/login?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E')).text();
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('role="alert"');
  });
});

describe('inicio del ingreso con Google', () => {
  it('redirige a Supabase para ir a Google, volviendo a /admin/callback y pidiendo elegir cuenta', async () => {
    const response = await formPost('/admin/google', site.origin, 'next=%2Fadmin%2Fproductos');
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/auth/v1/authorize');
    expect(location.searchParams.get('provider')).toBe('google');
    expect(location.searchParams.get('redirect_to')).toBe(`${site.origin}/admin/callback`);
    expect(location.searchParams.get('prompt')).toBe('select_account');
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
  });

  it('guarda el verificador del flujo y el destino en cookies httpOnly', async () => {
    const response = await formPost('/admin/google', site.origin, 'next=%2Fadmin%2Fproductos');
    const cookies = response.headers.getSetCookie();
    const verifier = cookies.find((cookie) => cookie.includes('code-verifier'));
    const next = cookies.find((cookie) => cookie.startsWith('admin_next='));
    for (const cookie of [verifier, next]) {
      expect(cookie).toBeTruthy();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/;\s*Secure/i);
    }
    expect(next).toContain('admin_next=/admin/productos');
  });

  it('un destino externo no se guarda', async () => {
    const response = await formPost('/admin/google', site.origin, 'next=https%3A%2F%2Fevil.example');
    const next = response.headers.getSetCookie().find((cookie) => cookie.startsWith('admin_next='));
    expect(next).toContain('admin_next=/admin;');
    expect(next).not.toContain('evil');
  });

  it('un pedido que viene de otro sitio se rechaza (protección contra pedidos falsificados)', async () => {
    const response = await formPost('/admin/google', 'https://evil.example');
    expect(response.status).toBe(403);
  });
});

describe('vuelta desde Google (callback)', () => {
  const callback = (query: string) => get(`/admin/callback${query}`);

  it('si la persona cancela, vuelve al login con un aviso', async () => {
    const response = await callback('?error=access_denied');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login?error=cancelado');
  });

  it('una cuenta no habilitada (registro apagado) va a «sin acceso»', async () => {
    const response = await callback('?error=server_error&error_code=signup_disabled&error_description=Signups+not+allowed');
    expect(response.headers.get('location')).toBe('/admin/sin-acceso');
  });

  it('un error cualquiera de Google vuelve al login con el aviso de Google', async () => {
    expect((await callback('?error=server_error')).headers.get('location')).toBe('/admin/login?error=google');
  });

  it('sin código ni error vuelve al login', async () => {
    expect((await callback('')).headers.get('location')).toBe('/admin/login?error=google');
  });

  it('un código inventado no abre ninguna sesión', async () => {
    const response = await callback('?code=codigo-inventado');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login?error=sesion');
    expect(response.headers.getSetCookie().filter((cookie) => /auth-token/.test(cookie) && !/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(cookie))).toEqual([]);
  });
});

describe('salir', () => {
  it('solo acepta POST: un enlace de otro sitio no puede cerrar la sesión', async () => {
    const response = await get('/admin/logout');
    expect([404, 405]).toContain(response.status);
  });

  it('un POST desde otro sitio se rechaza', async () => {
    expect((await formPost('/admin/logout', 'https://evil.example')).status).toBe(403);
  });

  it('un POST propio cierra la sesión y vuelve al login', async () => {
    const cookie = await sessionCookie({ role: 'admin' });
    const response = await fetch(`${site.origin}/admin/logout`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: site.origin, cookie },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login');
    // la cookie vieja ya no da acceso
    expect((await get('/admin', { headers: { cookie } })).headers.get('location')).toBe('/admin/login');
  });

  it('la pantalla «sin acceso» se puede ver sin sesión y ofrece probar con otra cuenta', async () => {
    const response = await get('/admin/sin-acceso');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Probar con otra cuenta');
    void cookieJar;
  });
});
