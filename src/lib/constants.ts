export const PRODUCT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const IMAGE_KIND = {
  MAIN: 'main',
  TEXTURE: 'texture',
  USAGE: 'usage',
  DETAIL: 'detail',
} as const;

export type ImageKind = (typeof IMAGE_KIND)[keyof typeof IMAGE_KIND];

// Gualeguaychú: solo se vende en la ciudad, con retiro o envío
export const DELIVERY_METHOD = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
} as const;

export type DeliveryMethod = (typeof DELIVERY_METHOD)[keyof typeof DELIVERY_METHOD];

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  [DELIVERY_METHOD.PICKUP]: 'Retiro',
  [DELIVERY_METHOD.DELIVERY]: 'Envío',
};

// Solo efectivo o transferencia
export const PAYMENT_METHOD = {
  CASH: 'cash',
  TRANSFER: 'transfer',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.CASH]: 'Efectivo',
  [PAYMENT_METHOD.TRANSFER]: 'Transferencia',
};

export const MAX_QTY_PER_ITEM = 10;
export const STORAGE_BUCKET = 'product-images';

// Largo máximo del texto prearmado: wa.me corta URLs largas
export const MAX_WHATSAPP_URL_LENGTH = 2000;

export const WHATSAPP_BASE_URL = 'https://wa.me';

export const CART_STORAGE_KEY = 'camilacarro:cart:v1';
export const CART_CATALOG_URL = '/api/cart-catalog.json';
// tiempo que el botón "Agregar" muestra su estado de confirmación
export const ADDED_FEEDBACK_MS = 1600;
export const MAX_FILTER_TEXT_LENGTH = 60;
