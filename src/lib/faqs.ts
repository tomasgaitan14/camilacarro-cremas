import { MAX_FAQS_PER_PRODUCT } from './constants.ts';
import type { Faq } from './types.ts';

// La columna faqs es jsonb: la base solo garantiza que sea una lista. La forma de cada ítem se verifica
// acá, y lo que no tiene pregunta y respuesta no vacías se descarta en vez de romper la ficha.
export function parseFaqs(raw: unknown): Faq[] {
  if (!Array.isArray(raw)) return [];
  const faqs: Faq[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { q, a } = item as Record<string, unknown>;
    if (typeof q !== 'string' || typeof a !== 'string') continue;
    const question = q.trim();
    const answer = a.trim();
    if (question === '' || answer === '') continue;
    faqs.push({ question, answer });
    if (faqs.length === MAX_FAQS_PER_PRODUCT) break;
  }
  return faqs;
}
