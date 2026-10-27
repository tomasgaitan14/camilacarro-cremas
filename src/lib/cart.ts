import { MAX_QTY_PER_ITEM } from './constants.ts';
import { CartError } from './errors.ts';
import type { CartLine, CartProduct } from './types.ts';

// El carrito es una lista inmutable de líneas: cada función devuelve una lista nueva.

export function maxAllowed(product: CartProduct): number {
  return Math.min(product.stock, MAX_QTY_PER_ITEM);
}

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new CartError('INVALID_QUANTITY', `Cantidad inválida: ${quantity}`);
  }
}

function assertWithinStock(product: CartProduct, quantity: number): void {
  if (product.stock <= 0) {
    throw new CartError('OUT_OF_STOCK', `"${product.name}" no tiene stock`);
  }
  if (quantity > maxAllowed(product)) {
    throw new CartError(
      'QUANTITY_EXCEEDS_STOCK',
      `Máximo ${maxAllowed(product)} unidades de "${product.name}"`,
    );
  }
}

export function setQuantity(lines: CartLine[], product: CartProduct, quantity: number): CartLine[] {
  assertValidQuantity(quantity);
  if (quantity === 0) return removeFromCart(lines, product.id);
  assertWithinStock(product, quantity);
  // se conserva la posición de la línea para que la lista no se reordene al cambiar la cantidad
  if (lines.some((line) => line.productId === product.id)) {
    return lines.map((line) => (line.productId === product.id ? { ...line, quantity } : line));
  }
  return [...lines, { productId: product.id, quantity }];
}

export function addToCart(lines: CartLine[], product: CartProduct, quantity = 1): CartLine[] {
  assertValidQuantity(quantity);
  if (quantity === 0) {
    throw new CartError('INVALID_QUANTITY', 'Hay que agregar al menos 1 unidad');
  }
  const current = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  return setQuantity(lines, product, current + quantity);
}

export function removeFromCart(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((line) => line.productId !== productId);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartTotal(lines: CartLine[], productsById: ReadonlyMap<string, CartProduct>): number {
  return lines.reduce((sum, line) => {
    const product = productsById.get(line.productId);
    if (!product) {
      throw new CartError('UNKNOWN_PRODUCT', `Producto desconocido: ${line.productId}`);
    }
    return sum + product.priceArs * line.quantity;
  }, 0);
}

// El catálogo cambia (stock, productos ocultos) mientras el carrito sigue guardado en el navegador:
// se descartan los productos que ya no están y se ajustan las cantidades al stock actual.
export function reconcileCart(lines: CartLine[], productsById: ReadonlyMap<string, CartProduct>): CartLine[] {
  const reconciled: CartLine[] = [];
  for (const line of lines) {
    const product = productsById.get(line.productId);
    if (!product || product.stock <= 0) continue;
    reconciled.push({ productId: line.productId, quantity: Math.min(line.quantity, maxAllowed(product)) });
  }
  return reconciled;
}

// localStorage es input no confiable: cualquier cosa que no tenga la forma esperada se descarta.
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const byProduct = new Map<string, number>();
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const { productId, quantity } = item as Record<string, unknown>;
    if (typeof productId !== 'string' || productId === '') continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) continue;
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + quantity);
  }
  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
}
