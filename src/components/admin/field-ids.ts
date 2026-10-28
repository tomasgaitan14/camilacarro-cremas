// Ids de las ayudas y errores de un campo, para aria-describedby (solo los que existen)
export function fieldDescribedBy(id: string, parts: { hint?: string; error?: string }): string | undefined {
  const ids = [parts.hint ? `${id}-hint` : '', parts.error ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
