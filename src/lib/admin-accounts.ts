import type { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_ROLE } from './admin-auth.ts';

const USERS_PAGE_SIZE = 200;

export type AdminAccountResult = 'creada' | 'actualizada' | 'sin cambios';

async function findUserByEmail(service: SupabaseClient, email: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) throw new Error('No se pudo listar los usuarios', { cause: error });
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < USERS_PAGE_SIZE) return null;
  }
}

// Deja una cuenta lista para entrar con Google: existe, tiene el email confirmado y el rol admin.
// El registro público está apagado, así que esta es la única forma de habilitar a alguien. Se puede repetir sin riesgo.
// Necesita el cliente con la service_role.
export async function ensureAdminUser(service: SupabaseClient, email: string): Promise<AdminAccountResult> {
  const existing = await findUserByEmail(service, email);
  if (!existing) {
    const { error } = await service.auth.admin.createUser({ email, email_confirm: true, app_metadata: { role: ADMIN_ROLE } });
    if (error) throw new Error(`No se pudo crear la cuenta de ${email}`, { cause: error });
    return 'creada';
  }
  if (existing.app_metadata?.role === ADMIN_ROLE && existing.email_confirmed_at) return 'sin cambios';
  const { error } = await service.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    app_metadata: { ...existing.app_metadata, role: ADMIN_ROLE },
  });
  if (error) throw new Error(`No se pudo actualizar la cuenta de ${email}`, { cause: error });
  return 'actualizada';
}
