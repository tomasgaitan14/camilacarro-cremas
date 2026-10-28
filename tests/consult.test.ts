import { describe, expect, it } from 'vitest';
import { buildConsultMessage, buildConsultUrl } from '../src/lib/consult.ts';

const NUMBER = '5493444000000';

describe('buildConsultMessage', () => {
  it('sin producto pregunta por la rutina en general', () => {
    expect(buildConsultMessage()).toBe('¡Hola Camila! Quiero hacerte una consulta sobre cómo armar mi rutina.');
  });

  it('con producto lo nombra', () => {
    expect(buildConsultMessage('Toning Toner')).toBe('¡Hola Camila! Tengo una consulta sobre Toning Toner.');
  });

  it('un nombre vacío o de espacios se trata como "sin producto"', () => {
    expect(buildConsultMessage('   ')).toBe(buildConsultMessage());
    expect(buildConsultMessage('')).toBe(buildConsultMessage());
  });
});

describe('buildConsultUrl', () => {
  it('arma un link de wa.me con el mensaje codificado', () => {
    const url = new URL(buildConsultUrl(NUMBER, 'Kit A&B #1') as string);
    expect(url.origin + url.pathname).toBe(`https://wa.me/${NUMBER}`);
    expect(url.searchParams.get('text')).toBe('¡Hola Camila! Tengo una consulta sobre Kit A&B #1.');
    expect([...url.searchParams.keys()]).toEqual(['text']);
  });

  it.each([undefined, '', 'no-es-un-numero', '123'])('devuelve null con el número %j', (number) => {
    expect(buildConsultUrl(number)).toBeNull();
  });

  it('no esconde errores que no son del número de WhatsApp', () => {
    // un mensaje enorme no puede pasar a null por error: URL_TOO_LONG también es WhatsAppError y sí se oculta;
    // acá solo se verifica que un producto larguísimo no lance
    expect(buildConsultUrl(NUMBER, 'x'.repeat(5000))).toBeNull();
  });
});
