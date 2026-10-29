// Interruptores del sitio que se leen del entorno del servidor en cada pedido (no se fijan al compilar)
const ENABLED_VALUES = new Set(['1', 'true', 'yes']);

export function flagEnabled(raw: string | undefined): boolean {
  return raw !== undefined && ENABLED_VALUES.has(raw.trim().toLowerCase());
}

// El panel /admin solo existe si se lo enciende: un despliegue que no lo necesita (por ejemplo, el demo para mostrar
// la tienda) no expone ni siquiera la pantalla de login.
export const isAdminEnabled = (raw: string | undefined): boolean => flagEnabled(raw);

// Sitio de demostración: se pide a los buscadores que no lo indexen
export const isNoindex = (raw: string | undefined): boolean => flagEnabled(raw);

export const NOINDEX_HEADER = { name: 'x-robots-tag', value: 'noindex, nofollow' } as const;
