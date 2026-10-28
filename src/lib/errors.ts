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

// Falla al leer o escribir datos desde el panel de administración
export class AdminDataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AdminDataError';
  }
}

export type PublishBlocker = 'PHOTO' | 'PRICE';

// El producto todavía no tiene todo lo necesario para mostrarse en la tienda
export class PublishBlockedError extends Error {
  readonly blockers: PublishBlocker[];

  constructor(blockers: PublishBlocker[]) {
    super(`No se puede publicar: falta ${blockers.join(', ')}`);
    this.name = 'PublishBlockedError';
    this.blockers = blockers;
  }
}

export type ImageErrorCode = 'NOT_AN_IMAGE' | 'TOO_BIG' | 'TOO_SMALL' | 'TOO_MANY';

export class ImageError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImageError';
    this.code = code;
  }
}
