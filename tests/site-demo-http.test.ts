import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSupabaseIsUp } from './support/supabase.ts';
import { startSite } from './support/site.ts';

const SITE_START_TIMEOUT_MS = 120_000;
let demo: Awaited<ReturnType<typeof startSite>>;
let plain: Awaited<ReturnType<typeof startSite>>;

// «Demo»: el panel apagado y noindex, como el despliegue que se le muestra a la clienta
beforeAll(async () => {
  await assertSupabaseIsUp();
  demo = await startSite({ ADMIN_ENABLED: undefined, SITE_NOINDEX: 'true' });
  // sin noindex y con el panel encendido, para comprobar que esas cabeceras no aparecen de más
  plain = await startSite({ ADMIN_ENABLED: 'true', SITE_NOINDEX: undefined });
}, SITE_START_TIMEOUT_MS);

afterAll(async () => {
  await demo?.stop();
  await plain?.stop();
});

const get = (origin: string, path: string) => fetch(`${origin}${path}`, { redirect: 'manual' });
const post = (origin: string, path: string) =>
  fetch(`${origin}${path}`, { method: 'POST', redirect: 'manual', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: '' });

describe('demo: panel apagado', () => {
  it.each(['/admin', '/admin/login', '/admin/sin-acceso', '/admin/productos/nuevo', '/admin/stock', '/admin/lo-que-sea'])(
    '%s responde 404, sin redirigir al login',
    async (path) => {
      const response = await get(demo.origin, path);
      expect(response.status).toBe(404);
      expect(response.headers.get('location')).toBeNull();
    },
  );

  it.each(['/admin/google', '/admin/logout', '/admin/stock'])('un POST a %s tampoco hace nada', async (path) => {
    const response = await post(demo.origin, path);
    expect([404, 405]).toContain(response.status);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('el callback de Google no existe', async () => {
    expect((await get(demo.origin, '/admin/callback?code=x')).status).toBe(404);
  });

  it('la respuesta del panel apagado tampoco se indexa', async () => {
    expect((await get(demo.origin, '/admin')).headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});

describe('demo: tienda con noindex', () => {
  it.each(['/', '/productos', '/rutinas', '/api/cart-catalog.json', '/no-existe'])('%s lleva noindex', async (path) => {
    expect((await get(demo.origin, path)).headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('la tienda sigue funcionando', async () => {
    const home = await get(demo.origin, '/');
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('Camila Carro');
    expect((await get(demo.origin, '/productos')).status).toBe(200);
  });
});

describe('sin demo: el panel encendido y sin noindex', () => {
  it('/admin redirige al login y la tienda no lleva noindex', async () => {
    const admin = await get(plain.origin, '/admin');
    expect(admin.status).toBe(303);
    expect(admin.headers.get('location')).toBe('/admin/login');
    expect((await get(plain.origin, '/productos')).headers.get('x-robots-tag')).toBeNull();
  });
});
