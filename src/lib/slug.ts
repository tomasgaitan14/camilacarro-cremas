// Slug para URLs: minúsculas, sin acentos, solo letras, números y guiones (lo mismo que exige la base)
export function slugify(text: string, maxLength: number): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/, '');
}

// Si el slug ya existe agrega -2, -3... sin pasarse del largo máximo
export function uniqueSlug(base: string, taken: ReadonlySet<string>, maxLength: number): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, maxLength - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
