import { mainImage, toCartProduct } from './catalog.ts';
import { CART_CATALOG_URL } from './constants.ts';
import { CatalogLoadError } from './errors.ts';
import type { CartProduct, Product } from './types.ts';
import { normalizeWhatsAppNumber } from './whatsapp.ts';

// Lo que el navegador necesita para dibujar y validar el carrito (JSON de /api/cart-catalog.json)
export interface CatalogEntry extends CartProduct {
  slug: string;
  imageUrl: string | null;
  imageAlt: string;
}

export interface CartCatalog {
  whatsappNumber: string;
  products: CatalogEntry[];
}

export function buildCartCatalog(products: Product[], whatsappNumber: string): CartCatalog {
  return {
    whatsappNumber: normalizeWhatsAppNumber(whatsappNumber),
    products: products.map((product) => {
      const image = mainImage(product);
      return {
        ...toCartProduct(product),
        slug: product.slug,
        imageUrl: image?.url ?? null,
        imageAlt: image?.alt ?? product.name,
      };
    }),
  };
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.slug === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.brandName === 'string' &&
    typeof entry.priceArs === 'number' &&
    Number.isInteger(entry.priceArs) &&
    entry.priceArs >= 0 &&
    typeof entry.stock === 'number' &&
    Number.isInteger(entry.stock) &&
    entry.stock >= 0 &&
    (entry.imageUrl === null || typeof entry.imageUrl === 'string') &&
    typeof entry.imageAlt === 'string'
  );
}

export function isCartCatalog(value: unknown): value is CartCatalog {
  if (typeof value !== 'object' || value === null) return false;
  const catalog = value as Record<string, unknown>;
  return (
    typeof catalog.whatsappNumber === 'string' &&
    Array.isArray(catalog.products) &&
    catalog.products.every(isCatalogEntry)
  );
}

// Corre en el navegador. Cualquier falla (red, HTTP, JSON roto, forma inesperada) sale como CatalogLoadError.
export async function fetchCartCatalog(
  fetchImpl: typeof fetch = fetch,
  url: string = CART_CATALOG_URL,
): Promise<CartCatalog> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  } catch (cause) {
    throw new CatalogLoadError('No hay conexión con el catálogo', { cause });
  }
  if (!response.ok) {
    throw new CatalogLoadError(`El catálogo respondió ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new CatalogLoadError('El catálogo devolvió una respuesta ilegible', { cause });
  }
  if (!isCartCatalog(body)) {
    throw new CatalogLoadError('El catálogo devolvió datos con un formato inesperado');
  }
  return body;
}
