import { cartTotal } from './cart.ts';
import {
  DELIVERY_LABEL,
  MAX_WHATSAPP_URL_LENGTH,
  PAYMENT_LABEL,
  WHATSAPP_BASE_URL,
  type DeliveryMethod,
  type PaymentMethod,
} from './constants.ts';
import { CartError, WhatsAppError } from './errors.ts';
import { formatArs } from './money.ts';
import type { CartLine, CartProduct } from './types.ts';

const MIN_NUMBER_DIGITS = 10;
const MAX_NUMBER_DIGITS = 15; // E.164

export interface OrderOptions {
  delivery: DeliveryMethod;
  payment: PaymentMethod;
}

// Acepta "+54 9 3444 00-0000" y devuelve solo dígitos, que es lo que pide wa.me
export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/[\s+\-()]/g, '');
  if (!/^\d+$/.test(digits) || digits.length < MIN_NUMBER_DIGITS || digits.length > MAX_NUMBER_DIGITS) {
    throw new WhatsAppError('INVALID_NUMBER', `Número de WhatsApp inválido: "${raw}"`);
  }
  return digits;
}

export function buildOrderMessage(
  lines: CartLine[],
  productsById: ReadonlyMap<string, CartProduct>,
  options: OrderOptions,
): string {
  if (lines.length === 0) {
    throw new CartError('EMPTY_CART', 'El carrito está vacío');
  }
  const total = cartTotal(lines, productsById);

  const items = lines.map((line) => {
    // cartTotal ya verificó que todos los productos existen
    const product = productsById.get(line.productId) as CartProduct;
    const subtotal = formatArs(product.priceArs * line.quantity);
    return `• ${line.quantity} x ${product.name} (${product.brandName}) - ${subtotal}`;
  });

  return [
    '¡Hola Camila! Quiero hacer este pedido:',
    '',
    ...items,
    '',
    `Total: ${formatArs(total)}`,
    `Entrega: ${DELIVERY_LABEL[options.delivery]}`,
    `Pago: ${PAYMENT_LABEL[options.payment]}`,
    '',
    '¡Gracias!',
  ].join('\n');
}

export function buildWhatsAppUrl(number: string, message: string): string {
  const url = `${WHATSAPP_BASE_URL}/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(message)}`;
  if (url.length > MAX_WHATSAPP_URL_LENGTH) {
    throw new WhatsAppError('URL_TOO_LONG', 'El pedido es demasiado largo para enviarlo por WhatsApp');
  }
  return url;
}

export function buildOrderUrl(
  number: string,
  lines: CartLine[],
  productsById: ReadonlyMap<string, CartProduct>,
  options: OrderOptions,
): string {
  return buildWhatsAppUrl(number, buildOrderMessage(lines, productsById, options));
}
