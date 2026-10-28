// Controlador DOM del carrito. No pone estilos ni estructura: cada versión de diseño escribe su HTML
// y este módulo lo conecta con el carrito mediante atributos data-*. El contrato está en docs/cart-dom-contract.md.
import { cartItemCount, cartTotal, maxAllowed } from './cart.ts';
import type { CartCatalog, CatalogEntry } from './cart-catalog.ts';
import { createCartStore, type CartStorage } from './cart-store.ts';
import {
  ADDED_FEEDBACK_MS,
  ERROR_VISIBLE_MS,
  CART_STORAGE_KEY,
  DELIVERY_METHOD,
  PAYMENT_METHOD,
  type DeliveryMethod,
  type PaymentMethod,
} from './constants.ts';
import { CartError, CatalogLoadError, WhatsAppError } from './errors.ts';
import { formatArs } from './money.ts';
import { buildOrderUrl } from './whatsapp.ts';

export interface CartControllerDeps {
  storage: CartStorage;
  loadCatalog: () => Promise<CartCatalog>;
}

export interface CartController {
  // se resuelve cuando terminó el primer intento de cargar el catálogo (con éxito o con error)
  ready: Promise<void>;
  destroy(): void;
}

type CatalogStatus = 'loading' | 'ready' | 'error';
type CartView = 'empty' | 'loading' | 'error' | 'ready';

const MESSAGES = {
  CATALOG_ERROR: 'No pudimos cargar los productos. Revisá tu conexión y volvé a intentar.',
  INVALID_QUANTITY: 'Ingresá una cantidad entera, de 1 en adelante.',
  UNKNOWN_PRODUCT: 'Ese producto ya no está disponible.',
  RECONCILED: 'Actualizamos tu pedido según el stock disponible.',
} as const;

const DELIVERY_VALUES = new Set<string>(Object.values(DELIVERY_METHOD));
const PAYMENT_VALUES = new Set<string>(Object.values(PAYMENT_METHOD));
const WHOLE_NUMBER = /^\d+$/;
const SAFE_IMAGE_URL = /^(https?:\/\/|\/)/;

const ACTION_SELECTOR = [
  '[data-add-to-cart]',
  '[data-cart-inc]',
  '[data-cart-dec]',
  '[data-cart-remove]',
  '[data-cart-open]',
  '[data-cart-close]',
  '[data-cart-overlay]',
  '[data-cart-retry]',
  '[data-cart-clear]',
  '[data-cart-checkout]',
].join(',');

function requireWindow(doc: Document): Window {
  if (!doc.defaultView) throw new Error('mountCart necesita un documento asociado a una ventana');
  return doc.defaultView;
}

export function mountCart(doc: Document, deps: CartControllerDeps): CartController {
  const win = requireWindow(doc);
  const store = createCartStore(deps.storage);
  const root = doc.querySelector<HTMLElement>('[data-cart-root]');
  const panel = doc.querySelector<HTMLElement>('[data-cart-panel]');
  const itemTemplate = doc.querySelector<HTMLTemplateElement>('template[data-cart-item-template]');
  const addedTimers = new Map<HTMLElement, number>();

  let catalogStatus: CatalogStatus = 'loading';
  let catalog: CartCatalog | null = null;
  let productsById = new Map<string, CatalogEntry>();
  let errorMessage = '';
  let statusMessage = '';
  // aviso flotante de un error de acción: visible aunque el panel esté cerrado, y se borra solo
  let toastMessage = '';
  let toastTimer: number | undefined;
  let opener: HTMLElement | null = null;
  let catalogPromise: Promise<void> = Promise.resolve();

  function view(): CartView {
    if (store.getLines().length === 0) return 'empty';
    return catalogStatus;
  }

  function readOption<T extends string>(name: string, allowed: Set<string>, fallback: T): T {
    const checked = doc.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
    return checked && allowed.has(checked.value) ? (checked.value as T) : fallback;
  }

  function setSlot(item: HTMLElement, name: string, text: string): void {
    const slot = item.querySelector<HTMLElement>(`[data-slot="${name}"]`);
    if (slot) slot.textContent = text;
  }

  function renderItems(container: HTMLElement): void {
    container.replaceChildren();
    if (!itemTemplate) return;
    for (const line of store.getLines()) {
      const product = productsById.get(line.productId);
      const node = itemTemplate.content.firstElementChild?.cloneNode(true);
      if (!product || !(node instanceof HTMLElement)) continue;

      node.dataset.productId = product.id;
      setSlot(node, 'name', product.name);
      setSlot(node, 'brand', product.brandName);
      setSlot(node, 'quantity', String(line.quantity));
      setSlot(node, 'unitPrice', formatArs(product.priceArs));
      setSlot(node, 'subtotal', formatArs(product.priceArs * line.quantity));

      const image = node.querySelector<HTMLImageElement>('[data-slot="image"]');
      if (image) {
        const showImage = product.imageUrl !== null && SAFE_IMAGE_URL.test(product.imageUrl);
        image.hidden = !showImage;
        if (showImage) {
          image.src = product.imageUrl as string;
          image.alt = product.imageAlt;
        }
      }

      const increase = node.querySelector<HTMLButtonElement>('[data-cart-inc]');
      if (increase) increase.disabled = line.quantity >= maxAllowed(product);

      container.append(node);
    }
  }

  function renderCheckout(): void {
    const link = doc.querySelector<HTMLAnchorElement>('a[data-cart-checkout]');
    if (!link) return;

    let href: string | null = null;
    if (view() === 'ready' && catalog) {
      try {
        href = buildOrderUrl(catalog.whatsappNumber, store.getLines(), productsById, {
          delivery: readOption<DeliveryMethod>('cart-delivery', DELIVERY_VALUES, DELIVERY_METHOD.PICKUP),
          payment: readOption<PaymentMethod>('cart-payment', PAYMENT_VALUES, PAYMENT_METHOD.TRANSFER),
        });
      } catch (error) {
        if (!(error instanceof CartError || error instanceof WhatsAppError)) throw error;
        errorMessage = error.message;
      }
    }

    link.href = href ?? '#';
    link.setAttribute('aria-disabled', href ? 'false' : 'true');
  }

  function render(): void {
    const currentView = view();
    const lines = store.getLines();
    const count = cartItemCount(lines);

    for (const badge of doc.querySelectorAll<HTMLElement>('[data-cart-count]')) {
      badge.textContent = String(count);
      badge.dataset.empty = String(count === 0);
    }

    for (const section of doc.querySelectorAll<HTMLElement>('[data-cart-when]')) {
      section.hidden = section.dataset.cartWhen !== currentView;
    }

    const itemsContainer = doc.querySelector<HTMLElement>('[data-cart-items]');
    if (itemsContainer) {
      if (currentView === 'ready') renderItems(itemsContainer);
      else itemsContainer.replaceChildren();
    }

    const total = currentView === 'ready' ? formatArs(cartTotal(lines, productsById)) : '';
    for (const element of doc.querySelectorAll<HTMLElement>('[data-cart-total]')) element.textContent = total;

    renderCheckout();

    for (const element of doc.querySelectorAll<HTMLElement>('[data-cart-error]')) {
      element.textContent = errorMessage;
      element.hidden = errorMessage === '';
    }
    for (const element of doc.querySelectorAll<HTMLElement>('[data-cart-status]')) {
      element.textContent = statusMessage;
    }
    for (const element of doc.querySelectorAll<HTMLElement>('[data-cart-toast]')) {
      element.textContent = toastMessage;
      element.hidden = toastMessage === '';
    }
  }

  function showToast(message: string): void {
    toastMessage = message;
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => {
      toastMessage = '';
      render();
    }, ERROR_VISIBLE_MS);
  }

  function report(error: unknown): void {
    if (!(error instanceof CartError)) throw error;
    errorMessage = error.message;
    statusMessage = error.message;
    showToast(error.message);
    render();
  }

  function succeed(status: string): void {
    errorMessage = '';
    statusMessage = status;
    toastMessage = '';
    win.clearTimeout(toastTimer);
    render();
  }

  async function loadCatalog(): Promise<void> {
    catalogStatus = 'loading';
    render();
    try {
      catalog = await deps.loadCatalog();
      productsById = new Map(catalog.products.map((product) => [product.id, product]));
      catalogStatus = 'ready';
      errorMessage = '';
      const changed = store.reconcile(productsById);
      statusMessage = changed ? MESSAGES.RECONCILED : '';
    } catch (error) {
      if (!(error instanceof CatalogLoadError)) throw error;
      catalogStatus = 'error';
      errorMessage = MESSAGES.CATALOG_ERROR;
      statusMessage = MESSAGES.CATALOG_ERROR;
    }
    render();
  }

  function parseQuantity(productId: string): number {
    const input = [...doc.querySelectorAll<HTMLInputElement>('[data-qty-for]')].find(
      (candidate) => candidate.dataset.qtyFor === productId,
    );
    if (!input) return 1;
    const raw = input.value.trim();
    const quantity = WHOLE_NUMBER.test(raw) ? Number(raw) : 0;
    if (quantity < 1) throw new CartError('INVALID_QUANTITY', MESSAGES.INVALID_QUANTITY);
    return quantity;
  }

  function flashAdded(button: HTMLElement): void {
    win.clearTimeout(addedTimers.get(button));
    button.dataset.state = 'added';
    addedTimers.set(
      button,
      win.setTimeout(() => {
        delete button.dataset.state;
        addedTimers.delete(button);
      }, ADDED_FEEDBACK_MS),
    );
  }

  async function handleAdd(button: HTMLElement): Promise<void> {
    const productId = button.dataset.productId ?? '';
    await catalogPromise;
    const product = productsById.get(productId);
    if (!product) {
      errorMessage = catalogStatus === 'error' ? MESSAGES.CATALOG_ERROR : MESSAGES.UNKNOWN_PRODUCT;
      statusMessage = errorMessage;
      showToast(errorMessage);
      render();
      return;
    }
    try {
      store.add(product, parseQuantity(productId));
    } catch (error) {
      report(error);
      return;
    }
    flashAdded(button);
    succeed(`Agregaste ${product.name} a tu pedido`);
  }

  function changeQuantity(item: HTMLElement, delta: number): void {
    const productId = item.dataset.productId ?? '';
    const product = productsById.get(productId);
    const line = store.getLines().find((candidate) => candidate.productId === productId);
    if (!product || !line) return;
    try {
      store.setQuantity(product, line.quantity + delta);
    } catch (error) {
      report(error);
      return;
    }
    succeed('');
  }

  // Con el diálogo abierto, el resto de la página no recibe foco ni lo leen los lectores de pantalla
  function setBackgroundInert(inert: boolean): void {
    for (const element of doc.querySelectorAll<HTMLElement>('[data-cart-background]')) element.inert = inert;
  }

  function openPanel(trigger: HTMLElement): void {
    if (!root || !panel) return;
    opener = trigger;
    root.dataset.open = 'true';
    panel.inert = false;
    setBackgroundInert(true);
    doc.documentElement.dataset.cartLocked = 'true';
    doc.querySelector<HTMLElement>('[data-cart-close]')?.focus();
  }

  function closePanel(): void {
    if (!root || !panel || root.dataset.open !== 'true') return;
    root.dataset.open = 'false';
    panel.inert = true;
    setBackgroundInert(false);
    delete doc.documentElement.dataset.cartLocked;
    opener?.focus();
    opener = null;
  }

  function onClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>(ACTION_SELECTOR);
    if (!control) return;

    if (control.hasAttribute('data-add-to-cart')) {
      void handleAdd(control);
    } else if (control.hasAttribute('data-cart-open')) {
      openPanel(control);
    } else if (control.hasAttribute('data-cart-close')) {
      closePanel();
    } else if (control.hasAttribute('data-cart-overlay')) {
      // solo un clic directo sobre el fondo cierra: un clic dentro del panel no debe cerrarlo
      if (event.target === control) closePanel();
    } else if (control.hasAttribute('data-cart-retry')) {
      catalogPromise = loadCatalog();
    } else if (control.hasAttribute('data-cart-clear')) {
      store.clear();
      succeed('Vaciaste tu pedido');
    } else if (control.hasAttribute('data-cart-checkout')) {
      if (control.getAttribute('aria-disabled') === 'true') event.preventDefault();
    } else {
      const item = control.closest<HTMLElement>('[data-cart-item]');
      if (!item) return;
      if (control.hasAttribute('data-cart-inc')) changeQuantity(item, 1);
      else if (control.hasAttribute('data-cart-dec')) changeQuantity(item, -1);
      else if (control.hasAttribute('data-cart-remove')) {
        store.remove(item.dataset.productId ?? '');
        succeed('');
      }
    }
  }

  function onChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && (target.name === 'cart-delivery' || target.name === 'cart-payment')) {
      renderCheckout();
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') closePanel();
  }

  function onStorage(event: StorageEvent): void {
    if (event.key === null || event.key === CART_STORAGE_KEY) store.reload();
  }

  if (root && panel) {
    root.dataset.open = 'false';
    panel.inert = true;
  }

  const unsubscribe = store.subscribe(render);
  doc.addEventListener('click', onClick);
  doc.addEventListener('change', onChange);
  doc.addEventListener('keydown', onKeydown);
  win.addEventListener('storage', onStorage);

  catalogPromise = loadCatalog();

  return {
    ready: catalogPromise,
    destroy() {
      unsubscribe();
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('change', onChange);
      doc.removeEventListener('keydown', onKeydown);
      win.removeEventListener('storage', onStorage);
      for (const timer of addedTimers.values()) win.clearTimeout(timer);
      addedTimers.clear();
      win.clearTimeout(toastTimer);
    },
  };
}
