import { describe, expect, it, vi } from 'vitest';
import { createCartStore, memoryStorage, resolveStorage, type CartStorage } from '../src/lib/cart-store.ts';
import { CART_STORAGE_KEY } from '../src/lib/constants.ts';
import { CartError } from '../src/lib/errors.ts';
import type { CartProduct } from '../src/lib/types.ts';

const PRODUCT: CartProduct = { id: 'p1', name: 'Crema', brandName: 'Marca', priceArs: 1000, stock: 5 };

function storedWith(raw: string | null): CartStorage & { value: () => string | null } {
  let value = raw;
  return { getItem: () => value, setItem: (_key, next) => void (value = next), value: () => value };
}

describe('createCartStore', () => {
  it('arranca con lo guardado', () => {
    const store = createCartStore(storedWith(JSON.stringify([{ productId: 'p1', quantity: 2 }])));
    expect(store.getLines()).toEqual([{ productId: 'p1', quantity: 2 }]);
  });

  it('arranca vacío si lo guardado está corrupto', () => {
    expect(createCartStore(storedWith('{{{')).getLines()).toEqual([]);
  });

  it('guarda cada cambio con la clave del carrito', () => {
    const calls: [string, string][] = [];
    const storage: CartStorage = { getItem: () => null, setItem: (key, value) => void calls.push([key, value]) };
    const store = createCartStore(storage);
    store.add(PRODUCT, 2);
    expect(calls).toEqual([[CART_STORAGE_KEY, JSON.stringify([{ productId: 'p1', quantity: 2 }])]]);
  });

  it('avisa a los suscriptores y deja de avisar al desuscribirse', () => {
    const store = createCartStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.add(PRODUCT);
    store.setQuantity(PRODUCT, 3);
    store.remove('p1');
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    store.add(PRODUCT);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('una operación inválida lanza CartError y no guarda ni avisa', () => {
    const storage = storedWith(null);
    const store = createCartStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(() => store.add({ ...PRODUCT, stock: 0 })).toThrow(CartError);
    expect(() => store.add(PRODUCT, -1)).toThrow(CartError);
    expect(storage.value()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    expect(store.getLines()).toEqual([]);
  });

  it('clear vacía el carrito', () => {
    const store = createCartStore(memoryStorage());
    store.add(PRODUCT);
    store.clear();
    expect(store.getLines()).toEqual([]);
  });

  it('reconcile ajusta al catálogo, guarda y avisa solo si algo cambió', () => {
    const storage = storedWith(JSON.stringify([{ productId: 'p1', quantity: 9 }, { productId: 'viejo', quantity: 1 }]));
    const store = createCartStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    const changed = store.reconcile(new Map([['p1', PRODUCT]]));
    expect(changed).toBe(true);
    expect(store.getLines()).toEqual([{ productId: 'p1', quantity: 5 }]);
    expect(JSON.parse(storage.value() as string)).toEqual([{ productId: 'p1', quantity: 5 }]);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(store.reconcile(new Map([['p1', PRODUCT]]))).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reload relee el almacenamiento (otra pestaña cambió el carrito)', () => {
    const storage = storedWith(null);
    const store = createCartStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'p9', quantity: 4 }]));
    store.reload();
    expect(store.getLines()).toEqual([{ productId: 'p9', quantity: 4 }]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('almacenamiento bloqueado', () => {
    const blocked: CartStorage = {
      getItem: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('lleno', 'QuotaExceededError');
      },
    };

    it('sigue funcionando en memoria si leer y escribir fallan con DOMException', () => {
      const store = createCartStore(blocked);
      expect(store.getLines()).toEqual([]);
      store.add(PRODUCT, 2);
      expect(store.getLines()).toEqual([{ productId: 'p1', quantity: 2 }]);
    });

    it('un error que no es de almacenamiento se propaga', () => {
      const broken: CartStorage = {
        getItem: () => null,
        setItem: () => {
          throw new RangeError('bug');
        },
      };
      expect(() => createCartStore(broken).add(PRODUCT)).toThrow(RangeError);
    });
  });
});

describe('resolveStorage / memoryStorage', () => {
  it('devuelve el localStorage de la ventana si se puede acceder', () => {
    const local = memoryStorage();
    expect(resolveStorage({ localStorage: local as unknown as Storage })).toBe(local);
  });

  it('cae a memoria si acceder a localStorage lanza SecurityError', () => {
    const win = {
      get localStorage(): Storage {
        throw new DOMException('bloqueado', 'SecurityError');
      },
    };
    const storage = resolveStorage(win);
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
  });

  it('memoryStorage devuelve null para claves inexistentes', () => {
    expect(memoryStorage().getItem('nada')).toBeNull();
  });
});
