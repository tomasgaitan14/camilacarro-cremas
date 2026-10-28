import { describe, expect, it } from 'vitest';
import { MAX_FAQS_PER_PRODUCT } from '../src/lib/constants.ts';
import { parseFaqs } from '../src/lib/faqs.ts';

describe('parseFaqs', () => {
  it('lee preguntas y respuestas válidas', () => {
    expect(parseFaqs([{ q: '¿Cómo se usa?', a: 'Con suaves toques.' }])).toEqual([
      { question: '¿Cómo se usa?', answer: 'Con suaves toques.' },
    ]);
  });

  it('recorta los espacios', () => {
    expect(parseFaqs([{ q: '  ¿Hola?  ', a: '  Sí  ' }])).toEqual([{ question: '¿Hola?', answer: 'Sí' }]);
  });

  it.each([null, undefined, 'texto', 42, {}, { q: 'x', a: 'y' }])('devuelve vacío si no es una lista: %j', (raw) => {
    expect(parseFaqs(raw)).toEqual([]);
  });

  it('descarta los ítems con forma inválida y conserva los válidos', () => {
    const raw = [
      null,
      'texto',
      { q: 'sin respuesta' },
      { a: 'sin pregunta' },
      { q: 1, a: 'tipos mal' },
      { q: '   ', a: 'pregunta en blanco' },
      { q: 'respuesta en blanco', a: '   ' },
      { q: 'ok', a: 'ok' },
    ];
    expect(parseFaqs(raw)).toEqual([{ question: 'ok', answer: 'ok' }]);
  });

  it('respeta el máximo de preguntas', () => {
    const raw = Array.from({ length: MAX_FAQS_PER_PRODUCT + 5 }, (_, i) => ({ q: `p${i}`, a: `r${i}` }));
    expect(parseFaqs(raw)).toHaveLength(MAX_FAQS_PER_PRODUCT);
  });

  it('no deja pasar propiedades extra al resultado', () => {
    const [faq] = parseFaqs([{ q: 'p', a: 'r', html: '<script>', extra: 1 }]);
    expect(Object.keys(faq).sort()).toEqual(['answer', 'question']);
  });
});
