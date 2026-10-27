import { describe, expect, it } from 'vitest';
import {
  addToCart,
  cartItemCount,
  cartTotal,
  parseStoredCart,
  reconcileCart,
  removeFromCart,
  setQuantity,
} from '../src/lib/cart.ts';
import { MAX_QTY_PER_ITEM } from '../src/lib/constants.ts';
import { CartError } from '../src/lib/errors.ts';
import type { CartLine, CartProduct } from '../src/lib/types.ts';

function product(overrides: Partial<CartProduct> = {}): CartProduct {
  return { id: 'p1', name: 'Crema', brandName: 'Marca', priceArs: 1000, stock: 5, ...overrides };
}

function catalog(...products: CartProduct[]): Map<string, CartProduct> {
  return new Map(products.map((p) => [p.id, p]));
}

function expectCartError(fn: () => unknown, code: CartError['code']): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CartError);
    expect((error as CartError).code).toBe(code);
    return;
  }
  throw new Error(`Se esperaba CartError ${code} y no se lanzó nada`);
}

describe('addToCart', () => {
  it('agrega un producto nuevo con cantidad 1 por defecto', () => {
    expect(addToCart([], product())).toEqual([{ productId: 'p1', quantity: 1 }]);
  });

  it('acumula la cantidad si el producto ya está', () => {
    const lines = addToCart([{ productId: 'p1', quantity: 2 }], product(), 2);
    expect(lines).toEqual([{ productId: 'p1', quantity: 4 }]);
  });

  it('no muta la lista original', () => {
    const original: CartLine[] = [{ productId: 'p1', quantity: 1 }];
    addToCart(original, product(), 1);
    expect(original).toEqual([{ productId: 'p1', quantity: 1 }]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rechaza la cantidad inválida %s', (quantity) => {
    expectCartError(() => addToCart([], product(), quantity), 'INVALID_QUANTITY');
  });

  it('rechaza un producto sin stock', () => {
    expectCartError(() => addToCart([], product({ stock: 0 })), 'OUT_OF_STOCK');
  });

  it('rechaza superar el stock en una sola operación', () => {
    expectCartError(() => addToCart([], product({ stock: 3 }), 4), 'QUANTITY_EXCEEDS_STOCK');
  });

  it('rechaza superar el stock sumando a lo que ya hay en el carrito', () => {
    const lines = addToCart([], product({ stock: 3 }), 2);
    expectCartError(() => addToCart(lines, product({ stock: 3 }), 2), 'QUANTITY_EXCEEDS_STOCK');
  });

  it('permite llegar justo al stock', () => {
    expect(addToCart([], product({ stock: 3 }), 3)).toEqual([{ productId: 'p1', quantity: 3 }]);
  });

  it('respeta el máximo por producto aunque haya más stock', () => {
    const rich = product({ stock: 500 });
    expect(addToCart([], rich, MAX_QTY_PER_ITEM)).toEqual([{ productId: 'p1', quantity: MAX_QTY_PER_ITEM }]);
    expectCartError(() => addToCart([], rich, MAX_QTY_PER_ITEM + 1), 'QUANTITY_EXCEEDS_STOCK');
  });
});

describe('setQuantity', () => {
  it('cambia la cantidad sin reordenar las líneas', () => {
    const lines: CartLine[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
    ];
    expect(setQuantity(lines, product({ id: 'p1' }), 3)).toEqual([
      { productId: 'p1', quantity: 3 },
      { productId: 'p2', quantity: 1 },
    ]);
  });

  it('con cantidad 0 quita la línea', () => {
    const lines: CartLine[] = [{ productId: 'p1', quantity: 2 }];
    expect(setQuantity(lines, product(), 0)).toEqual([]);
  });

  it('con cantidad 0 sobre un producto sin stock también lo quita (limpiar un carrito viejo)', () => {
    const lines: CartLine[] = [{ productId: 'p1', quantity: 2 }];
    expect(setQuantity(lines, product({ stock: 0 }), 0)).toEqual([]);
  });

  it('rechaza cantidades negativas', () => {
    expectCartError(() => setQuantity([], product(), -2), 'INVALID_QUANTITY');
  });

  it('rechaza superar el stock', () => {
    expectCartError(() => setQuantity([], product({ stock: 2 }), 3), 'QUANTITY_EXCEEDS_STOCK');
  });
});

describe('removeFromCart / cartItemCount', () => {
  it('quita solo el producto indicado', () => {
    const lines: CartLine[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 4 },
    ];
    expect(removeFromCart(lines, 'p1')).toEqual([{ productId: 'p2', quantity: 4 }]);
  });

  it('cuenta unidades, no líneas', () => {
    expect(
      cartItemCount([
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 3 },
      ]),
    ).toBe(5);
    expect(cartItemCount([])).toBe(0);
  });
});

describe('cartTotal', () => {
  it('suma precio por cantidad', () => {
    const products = catalog(product({ id: 'p1', priceArs: 18500 }), product({ id: 'p2', priceArs: 900 }));
    const lines: CartLine[] = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 3 },
    ];
    expect(cartTotal(lines, products)).toBe(18500 * 2 + 900 * 3);
  });

  it('un carrito vacío vale 0', () => {
    expect(cartTotal([], catalog())).toBe(0);
  });

  it('falla con un producto que no está en el catálogo, en vez de ignorarlo', () => {
    expectCartError(() => cartTotal([{ productId: 'fantasma', quantity: 1 }], catalog(product())), 'UNKNOWN_PRODUCT');
  });
});

describe('reconcileCart', () => {
  it('descarta productos que ya no existen o se quedaron sin stock', () => {
    const products = catalog(product({ id: 'p1', stock: 4 }), product({ id: 'p2', stock: 0 }));
    const lines: CartLine[] = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
      { productId: 'oculto', quantity: 1 },
    ];
    expect(reconcileCart(lines, products)).toEqual([{ productId: 'p1', quantity: 2 }]);
  });

  it('baja la cantidad al stock actual', () => {
    const products = catalog(product({ id: 'p1', stock: 2 }));
    expect(reconcileCart([{ productId: 'p1', quantity: 9 }], products)).toEqual([{ productId: 'p1', quantity: 2 }]);
  });

  it('baja la cantidad al máximo por producto', () => {
    const products = catalog(product({ id: 'p1', stock: 100 }));
    expect(reconcileCart([{ productId: 'p1', quantity: 50 }], products)).toEqual([
      { productId: 'p1', quantity: MAX_QTY_PER_ITEM },
    ]);
  });
});

describe('parseStoredCart', () => {
  it('devuelve vacío sin datos o con JSON roto', () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart('')).toEqual([]);
    expect(parseStoredCart('{no es json')).toEqual([]);
  });

  it('devuelve vacío si no es una lista', () => {
    expect(parseStoredCart('{"productId":"p1","quantity":1}')).toEqual([]);
    expect(parseStoredCart('"texto"')).toEqual([]);
    expect(parseStoredCart('null')).toEqual([]);
  });

  it('descarta ítems con forma inválida', () => {
    const raw = JSON.stringify([
      null,
      'texto',
      { productId: '', quantity: 1 },
      { productId: 7, quantity: 1 },
      { productId: 'p1', quantity: 0 },
      { productId: 'p2', quantity: -3 },
      { productId: 'p3', quantity: 1.5 },
      { productId: 'p4', quantity: '2' },
      { productId: 'ok', quantity: 2 },
    ]);
    expect(parseStoredCart(raw)).toEqual([{ productId: 'ok', quantity: 2 }]);
  });

  it('unifica ítems repetidos del mismo producto', () => {
    const raw = JSON.stringify([
      { productId: 'p1', quantity: 1 },
      { productId: 'p1', quantity: 2 },
    ]);
    expect(parseStoredCart(raw)).toEqual([{ productId: 'p1', quantity: 3 }]);
  });
});
