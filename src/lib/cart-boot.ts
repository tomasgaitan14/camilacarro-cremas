import { fetchCartCatalog } from './cart-catalog.ts';
import { mountCart, type CartController } from './cart-controller.ts';
import { resolveStorage } from './cart-store.ts';

// Punto de entrada que usan los layouts de cada versión de diseño: `<script> import { bootCart } ... bootCart(); </script>`
export function bootCart(): CartController {
  return mountCart(document, {
    storage: resolveStorage(window),
    loadCatalog: () => fetchCartCatalog(),
  });
}
