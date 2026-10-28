import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isAdminUser } from '../src/lib/admin-auth.ts';
import { sessionCookieOptions } from '../src/lib/supabase-server.ts';
import { assertSupabaseIsUp, serviceClient } from './support/supabase.ts';
import { cookieJar, createAccount, serverClient, signInWithJar, type TestAccount } from './support/session.ts';

const accounts: TestAccount[] = [];
const newAccount = async (appMetadata: Record<string, unknown> = {}) => {
  const account = await createAccount(appMetadata);
  accounts.push(account);
  return account;
};

beforeAll(assertSupabaseIsUp);
afterAll(async () => {
  await Promise.all(accounts.map((account) => account.remove()));
});

describe('sessionCookieOptions', () => {
  it('fuerza httpOnly, SameSite=Lax y path / sobre lo que traiga la librería', () => {
    expect(sessionCookieOptions({ httpOnly: false, sameSite: 'none', path: '/otro', maxAge: 10 }, false)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 10,
    });
  });

  it('Secure sigue al valor indicado', () => {
    expect(sessionCookieOptions({}, true).secure).toBe(true);
    expect(sessionCookieOptions({}, false).secure).toBe(false);
  });
});

describe('sesión en cookies', () => {
  it('todas las cookies de la sesión salen httpOnly, SameSite=Lax y path /', async () => {
    const account = await newAccount({ role: 'admin' });
    const jar = await signInWithJar(account, true);
    expect(jar.writes.length).toBeGreaterThan(0);
    for (const { name, options } of jar.writes) {
      expect(options.httpOnly, name).toBe(true);
      expect(options.sameSite, name).toBe('lax');
      expect(options.path, name).toBe('/');
      expect(options.secure, name).toBe(true);
    }
  });

  it('un cliente nuevo, con las mismas cookies, reconoce a la persona (un cliente por pedido)', async () => {
    const account = await newAccount({ role: 'admin' });
    const jar = await signInWithJar(account);
    const { data } = await serverClient(jar.io).auth.getUser();
    expect(data.user?.email).toBe(account.email);
    expect(isAdminUser(data.user)).toBe(true);
  });

  it('una cuenta común entra, pero no es admin', async () => {
    const account = await newAccount();
    const jar = await signInWithJar(account);
    const { data } = await serverClient(jar.io).auth.getUser();
    expect(data.user?.email).toBe(account.email);
    expect(isAdminUser(data.user)).toBe(false);
  });

  it('sin cookies no hay usuario', async () => {
    const { data } = await serverClient(cookieJar().io).auth.getUser();
    expect(data.user).toBeNull();
  });

  it('una cookie adulterada no sirve', async () => {
    const account = await newAccount({ role: 'admin' });
    const jar = await signInWithJar(account);
    const tampered = cookieJar();
    for (const [name, value] of jar.store) tampered.store.set(name, `${value.slice(0, -6)}XXXXXX`);
    const { data } = await serverClient(tampered.io).auth.getUser();
    expect(data.user).toBeNull();
  });

  it('quitarle el rol a la cuenta corta el acceso en el pedido siguiente, sin esperar a que venza la sesión', async () => {
    const account = await newAccount({ role: 'admin' });
    const jar = await signInWithJar(account);
    expect(isAdminUser((await serverClient(jar.io).auth.getUser()).data.user)).toBe(true);

    await serviceClient().auth.admin.updateUserById(account.id, { app_metadata: { role: null } });
    expect(isAdminUser((await serverClient(jar.io).auth.getUser()).data.user)).toBe(false);
  });

  it('cerrar sesión limpia las cookies y la sesión deja de valer', async () => {
    const account = await newAccount({ role: 'admin' });
    const jar = await signInWithJar(account);
    const saved = new Map(jar.store);

    await serverClient(jar.io).auth.signOut();
    expect(jar.store.size).toBe(0);

    // aunque alguien se hubiera quedado con las cookies viejas, el servidor ya no las acepta
    const stale = cookieJar();
    for (const [name, value] of saved) stale.store.set(name, value);
    expect((await serverClient(stale.io).auth.getUser()).data.user).toBeNull();
  });
});
