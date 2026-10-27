import { addToCart, parseStoredCart, reconcileCart, removeFromCart, setQuantity } from './cart.ts';
import { CART_STORAGE_KEY } from './constants.ts';
import type { CartLine, CartProduct } from './types.ts';

export type CartStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface CartStore {
  getLines(): CartLine[];
  subscribe(listener: () => void): () => void;
  add(product: CartProduct, quantity?: number): void;
  setQuantity(product: CartProduct, quantity: number): void;
  remove(productId: string): void;
  clear(): void;
  // Ajusta el carrito guardado al catálogo actual. Devuelve true si cambió algo.
  reconcile(productsById: ReadonlyMap<string, CartProduct>): boolean;
  // Vuelve a leer el almacenamiento (por ejemplo, cuando otra pestaña lo modificó)
  reload(): void;
}

// localStorage puede estar bloqueado (modo privado, cookies deshabilitadas) y falla con DOMException.
// En ese caso el carrito sigue funcionando en memoria durante la visita; cualquier otro error se propaga.
function isStorageError(error: unknown): boolean {
  return error instanceof DOMException;
}

export function memoryStorage(): CartStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

// Acceder a window.localStorage ya puede lanzar SecurityError: se resuelve acá, una sola vez.
export function resolveStorage(win: Pick<Window, 'localStorage'>): CartStorage {
  try {
    return win.localStorage;
  } catch (error) {
    if (!isStorageError(error)) throw error;
    return memoryStorage();
  }
}

export function createCartStore(storage: CartStorage, key: string = CART_STORAGE_KEY): CartStore {
  const listeners = new Set<() => void>();

  function read(): CartLine[] {
    try {
      return parseStoredCart(storage.getItem(key));
    } catch (error) {
      if (!isStorageError(error)) throw error;
      return [];
    }
  }

  let lines = read();

  function commit(next: CartLine[]): void {
    lines = next;
    try {
      storage.setItem(key, JSON.stringify(lines));
    } catch (error) {
      if (!isStorageError(error)) throw error;
    }
    for (const listener of listeners) listener();
  }

  return {
    getLines: () => lines,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    add: (product, quantity = 1) => commit(addToCart(lines, product, quantity)),
    setQuantity: (product, quantity) => commit(setQuantity(lines, product, quantity)),
    remove: (productId) => commit(removeFromCart(lines, productId)),
    clear: () => commit([]),
    reconcile(productsById) {
      const next = reconcileCart(lines, productsById);
      const changed = JSON.stringify(next) !== JSON.stringify(lines);
      if (changed) commit(next);
      return changed;
    },
    reload() {
      lines = read();
      for (const listener of listeners) listener();
    },
  };
}
