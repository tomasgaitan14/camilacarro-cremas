import { WhatsAppError } from './errors.ts';
import { buildWhatsAppUrl } from './whatsapp.ts';

// Mensaje prearmado para consultar a Camila: sobre un producto puntual o, sin tema, sobre la rutina en general
export function buildConsultMessage(productName?: string): string {
  const topic = productName?.trim();
  return topic
    ? `¡Hola Camila! Tengo una consulta sobre ${topic}.`
    : '¡Hola Camila! Quiero hacerte una consulta sobre cómo armar mi rutina.';
}

// Link de WhatsApp para consultar. Devuelve null si el número de la tienda no está configurado o es inválido:
// en ese caso la página oculta el botón en lugar de mostrar uno que no funciona.
export function buildConsultUrl(number: string | undefined, productName?: string): string | null {
  if (!number) return null;
  try {
    return buildWhatsAppUrl(number, buildConsultMessage(productName));
  } catch (error) {
    if (error instanceof WhatsAppError) return null;
    throw error;
  }
}
