export const PRODUCT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const USAGE_TIME = {
  MORNING: 'morning',
  NIGHT: 'night',
  BOTH: 'both',
} as const;

export type UsageTime = (typeof USAGE_TIME)[keyof typeof USAGE_TIME];

export const USAGE_TIME_LABEL: Record<UsageTime, string> = {
  [USAGE_TIME.MORNING]: 'Por la mañana',
  [USAGE_TIME.NIGHT]: 'Por la noche',
  [USAGE_TIME.BOTH]: 'Mañana y noche',
};

export const MAX_FAQS_PER_PRODUCT = 10;

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
// tiempo que el aviso flotante de un error de acción (ej. superar el stock) queda visible
export const ERROR_VISIBLE_MS = 5000;
export const MAX_FILTER_TEXT_LENGTH = 60;

// Caché del catálogo en el servidor: un cambio de Camila tarda como máximo esto en verse
export const CATALOG_CACHE_TTL_MS = 60_000;
// Pasado este múltiplo del TTL sin poder renovar, se deja de servir lo viejo y se espera un dato fresco
export const CATALOG_CACHE_MAX_STALE_FACTOR = 10;

// /api/cart-catalog.json: el navegador lo reutiliza este tiempo y luego revalida con ETag
export const CART_CATALOG_MAX_AGE_S = 30;
export const CART_CATALOG_STALE_WHILE_REVALIDATE_S = 120;

// ---------- Panel de administración ----------

// Límites de los campos del producto: coinciden con los checks de la base (ver las migraciones)
export const PRODUCT_LIMITS = {
  NAME: 120,
  SUMMARY: 400,
  VOLUME: 40,
  KEY_INGREDIENTS: 600,
  WARNINGS: 600,
  BENEFITS: 12,
  USAGE_STEPS: 12,
  SKIN_TYPES: 8,
  ROUTINE_STEP_MAX: 20,
  PRODUCT_SLUG: 120,
  REFERENCE_NAME: 80,
  REFERENCE_SLUG: 80,
  // la base no limita cada ítem de una lista: se pone un tope razonable para que la ficha no se rompa
  LIST_ITEM: 300,
  SKIN_TYPE_ITEM: 60,
  PRICE_ARS_MAX: 10_000_000,
  STOCK_MAX: 9999,
} as const;

// Tipos de piel que se ofrecen como casillas; los demás valores guardados se conservan al editar
export const SKIN_TYPE_OPTIONS = [
  'Todo tipo de piel',
  'Piel seca',
  'Piel grasa',
  'Piel mixta',
  'Piel sensible',
  'Piel con acné',
  'Piel madura',
] as const;

// Valor del desplegable que significa «agregar uno nuevo» (marca, categoría o línea)
export const NEW_CHOICE_VALUE = '__new__';

// Fotos: el navegador manda el original del celular; acá se reduce y se pasa a WebP
export const IMAGE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const IMAGE_MAX_SIDE_PX = 1200;
export const IMAGE_MIN_SIDE_PX = 300;
export const IMAGE_MAX_INPUT_PIXELS = 60_000_000;
export const IMAGE_WEBP_QUALITY = 80;
// tamaño máximo del bucket (ver la migración): el resultado nunca debería acercarse
export const IMAGE_MAX_STORED_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_PER_PRODUCT = 5;
// el nombre del archivo es único, así que la foto no cambia nunca: se puede cachear un año
export const IMAGE_CACHE_CONTROL_S = 31_536_000;
export const IMAGE_MAIN_POSITION = 0;

export const STOCK_STEP = 1;
