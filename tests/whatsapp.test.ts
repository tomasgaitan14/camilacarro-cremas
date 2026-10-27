import { describe, expect, it } from 'vitest';
import { DELIVERY_METHOD, PAYMENT_METHOD } from '../src/lib/constants.ts';
import { CartError, WhatsAppError } from '../src/lib/errors.ts';
import { formatArs } from '../src/lib/money.ts';
import type { CartLine, CartProduct } from '../src/lib/types.ts';
import {
  buildOrderMessage,
  buildOrderUrl,
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
} from '../src/lib/whatsapp.ts';

const NUMBER = '5493444000000';

const PRODUCTS = new Map<string, CartProduct>([
  ['a', { id: 'a', name: 'Aceite limpiador ligero', brandName: 'Marca Demo A', priceArs: 18500, stock: 10 }],
  ['b', { id: 'b', name: 'Protector solar FPS 50', brandName: 'Marca Demo B', priceArs: 19900, stock: 10 }],
]);

const LINES: CartLine[] = [
  { productId: 'a', quantity: 2 },
  { productId: 'b', quantity: 1 },
];

const OPTIONS = { delivery: DELIVERY_METHOD.DELIVERY, payment: PAYMENT_METHOD.TRANSFER };

function expectWhatsAppError(fn: () => unknown, code: WhatsAppError['code']): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(WhatsAppError);
    expect((error as WhatsAppError).code).toBe(code);
    return;
  }
  throw new Error(`Se esperaba WhatsAppError ${code} y no se lanzó nada`);
}

describe('formatArs', () => {
  it('formatea pesos enteros con separador de miles', () => {
    expect(formatArs(0)).toBe('$0');
    expect(formatArs(900)).toBe('$900');
    expect(formatArs(1000)).toBe('$1.000');
    expect(formatArs(37000)).toBe('$37.000');
    expect(formatArs(1234567)).toBe('$1.234.567');
  });

  it.each([-1, 10.5, Number.NaN])('rechaza el monto inválido %s', (amount) => {
    expect(() => formatArs(amount)).toThrow(RangeError);
  });
});

describe('normalizeWhatsAppNumber', () => {
  it('deja solo dígitos', () => {
    expect(normalizeWhatsAppNumber('+54 9 3444 00-0000')).toBe('5493444000000');
    expect(normalizeWhatsAppNumber('(549) 3444 000000')).toBe('5493444000000');
  });

  it.each(['', 'abc', '54934440000x0', '12345', '1234567890123456', '+', '549 3444 00.0000'])(
    'rechaza el número inválido "%s"',
    (raw) => {
      expectWhatsAppError(() => normalizeWhatsAppNumber(raw), 'INVALID_NUMBER');
    },
  );
});

describe('buildOrderMessage', () => {
  it('arma el pedido con ítems, total, entrega y pago', () => {
    expect(buildOrderMessage(LINES, PRODUCTS, OPTIONS)).toBe(
      [
        '¡Hola Camila! Quiero hacer este pedido:',
        '',
        '• 2 x Aceite limpiador ligero (Marca Demo A) - $37.000',
        '• 1 x Protector solar FPS 50 (Marca Demo B) - $19.900',
        '',
        'Total: $56.900',
        'Entrega: Envío',
        'Pago: Transferencia',
        '',
        '¡Gracias!',
      ].join('\n'),
    );
  });

  it('refleja retiro y efectivo', () => {
    const message = buildOrderMessage(LINES, PRODUCTS, {
      delivery: DELIVERY_METHOD.PICKUP,
      payment: PAYMENT_METHOD.CASH,
    });
    expect(message).toContain('Entrega: Retiro');
    expect(message).toContain('Pago: Efectivo');
  });

  it('falla con el carrito vacío', () => {
    try {
      buildOrderMessage([], PRODUCTS, OPTIONS);
    } catch (error) {
      expect((error as CartError).code).toBe('EMPTY_CART');
      return;
    }
    throw new Error('Se esperaba CartError EMPTY_CART');
  });

  it('falla con un producto que no está en el catálogo', () => {
    expect(() => buildOrderMessage([{ productId: 'fantasma', quantity: 1 }], PRODUCTS, OPTIONS)).toThrow(CartError);
  });
});

describe('buildWhatsAppUrl', () => {
  it('apunta a wa.me con el número normalizado y solo el parámetro text', () => {
    const url = new URL(buildWhatsAppUrl('+54 9 3444 000000', 'hola'));
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/5493444000000');
    expect([...url.searchParams.keys()]).toEqual(['text']);
    expect(url.searchParams.get('text')).toBe('hola');
  });

  it('el texto sobrevive intacto con caracteres que rompen una URL', () => {
    const nasty = 'Crema 50% & más #1 = "top"?\n• 2 x ñandú 🌸 <b>';
    const url = new URL(buildWhatsAppUrl(NUMBER, nasty));
    expect(url.searchParams.get('text')).toBe(nasty);
    expect([...url.searchParams.keys()]).toEqual(['text']);
    expect(url.hash).toBe('');
  });

  it('rechaza un número inválido', () => {
    expectWhatsAppError(() => buildWhatsAppUrl('123', 'hola'), 'INVALID_NUMBER');
  });

  it('rechaza un pedido que no entra en una URL', () => {
    expectWhatsAppError(() => buildWhatsAppUrl(NUMBER, 'x'.repeat(5000)), 'URL_TOO_LONG');
  });
});

describe('buildOrderUrl', () => {
  it('el mensaje decodificado coincide con el pedido', () => {
    const url = new URL(buildOrderUrl(NUMBER, LINES, PRODUCTS, OPTIONS));
    expect(url.searchParams.get('text')).toBe(buildOrderMessage(LINES, PRODUCTS, OPTIONS));
  });

  it('un producto con & y # en el nombre no agrega parámetros ni fragmentos', () => {
    const products = new Map<string, CartProduct>([
      ['x', { id: 'x', name: 'Kit A&B #1', brandName: 'M&M', priceArs: 1000, stock: 3 }],
    ]);
    const url = new URL(buildOrderUrl(NUMBER, [{ productId: 'x', quantity: 1 }], products, OPTIONS));
    expect([...url.searchParams.keys()]).toEqual(['text']);
    expect(url.hash).toBe('');
    expect(url.searchParams.get('text')).toContain('Kit A&B #1 (M&M)');
  });
});
