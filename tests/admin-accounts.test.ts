import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureAdminUser } from '../src/lib/admin-accounts.ts';
import { assertSupabaseIsUp, serviceClient } from './support/supabase.ts';

const service = serviceClient();
const created: string[] = [];
const newEmail = () => `test-${randomUUID()}@camilacarro.test`;

async function userByEmail(email: string) {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((user) => user.email === email);
}

beforeAll(assertSupabaseIsUp);
afterAll(async () => {
  for (const email of created) {
    const user = await userByEmail(email);
    if (user) await service.auth.admin.deleteUser(user.id);
  }
});

describe('ensureAdminUser', () => {
  it('crea la cuenta con el email confirmado y el rol admin', async () => {
    const email = newEmail();
    created.push(email);
    expect(await ensureAdminUser(service, email)).toBe('creada');
    const user = await userByEmail(email);
    expect(user?.app_metadata.role).toBe('admin');
    expect(user?.email_confirmed_at).toBeTruthy();
  });

  it('repetirlo no cambia nada', async () => {
    const email = newEmail();
    created.push(email);
    await ensureAdminUser(service, email);
    expect(await ensureAdminUser(service, email)).toBe('sin cambios');
  });

  it('una cuenta que ya existía sin rol pasa a ser admin y conserva su otra metadata', async () => {
    const email = newEmail();
    created.push(email);
    await service.auth.admin.createUser({ email, email_confirm: true, app_metadata: { plan: 'x' } });
    expect(await ensureAdminUser(service, email)).toBe('actualizada');
    const user = await userByEmail(email);
    expect(user?.app_metadata).toMatchObject({ role: 'admin', plan: 'x' });
  });

  it('una cuenta con el email sin confirmar queda confirmada', async () => {
    const email = newEmail();
    created.push(email);
    await service.auth.admin.createUser({ email, email_confirm: false, app_metadata: { role: 'admin' } });
    expect(await ensureAdminUser(service, email)).toBe('actualizada');
    expect((await userByEmail(email))?.email_confirmed_at).toBeTruthy();
  });
});
