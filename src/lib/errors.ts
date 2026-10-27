export type CartErrorCode =
  | 'OUT_OF_STOCK'
  | 'INVALID_QUANTITY'
  | 'QUANTITY_EXCEEDS_STOCK'
  | 'UNKNOWN_PRODUCT'
  | 'EMPTY_CART';

export class CartError extends Error {
  readonly code: CartErrorCode;

  constructor(code: CartErrorCode, message: string) {
    super(message);
    this.name = 'CartError';
    this.code = code;
  }
}

export type WhatsAppErrorCode = 'INVALID_NUMBER' | 'URL_TOO_LONG';

export class WhatsAppError extends Error {
  readonly code: WhatsAppErrorCode;

  constructor(code: WhatsAppErrorCode, message: string) {
    super(message);
    this.name = 'WhatsAppError';
    this.code = code;
  }
}

// El navegador no pudo traer o entender el catálogo que usa el carrito
export class CatalogLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CatalogLoadError';
  }
}

export class CatalogError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CatalogError';
  }
}
