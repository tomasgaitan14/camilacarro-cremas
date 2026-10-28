// Pasos del asistente para cargar un producto (puro: sin red ni framework)
import { publishBlockers } from './admin-products.ts';
import type { PublishBlocker } from './errors.ts';
import type { Product } from './types.ts';

export const WIZARD_STEP = {
  BASICS: 'datos',
  PHOTO: 'foto',
  PRICE: 'precio',
  DETAILS: 'detalles',
  REVIEW: 'revisar',
} as const;

export type WizardStepKey = (typeof WIZARD_STEP)[keyof typeof WIZARD_STEP];

export const WIZARD_STEPS: ReadonlyArray<{ key: WizardStepKey; label: string }> = [
  { key: WIZARD_STEP.BASICS, label: 'Qué producto es' },
  { key: WIZARD_STEP.PHOTO, label: 'Foto' },
  { key: WIZARD_STEP.PRICE, label: 'Precio y unidades' },
  { key: WIZARD_STEP.DETAILS, label: 'Detalles' },
  { key: WIZARD_STEP.REVIEW, label: 'Revisar y publicar' },
];

export const ADMIN_ROUTES = {
  NEW_PRODUCT: '/admin/productos/nuevo',
  STOCK: '/admin/stock',
  VISIBILITY: '/admin/visibilidad',
} as const;

// Al volver desde «Revisar», cada paso guarda y regresa a la revisión en lugar de seguir con el paso siguiente
export const REVIEW_RETURN_PARAM = 'de';

export function wizardPath(productId: string, step: WizardStepKey): string {
  return `/admin/productos/${productId}/${step}`;
}

export function stepNumber(step: WizardStepKey): number {
  return WIZARD_STEPS.findIndex((entry) => entry.key === step) + 1;
}

export function nextStep(step: WizardStepKey): WizardStepKey {
  const next = WIZARD_STEPS[stepNumber(step)];
  return next ? next.key : WIZARD_STEP.REVIEW;
}

export function previousStep(step: WizardStepKey): WizardStepKey | null {
  return WIZARD_STEPS[stepNumber(step) - 2]?.key ?? null;
}

// A dónde ir después de guardar un paso
export function stepDestination(productId: string, step: WizardStepKey, fromReview: boolean): string {
  return wizardPath(productId, fromReview ? WIZARD_STEP.REVIEW : nextStep(step));
}

export function isFromReview(searchParams: URLSearchParams): boolean {
  return searchParams.get(REVIEW_RETURN_PARAM) === WIZARD_STEP.REVIEW;
}

// Dónde retomar un borrador: el primer paso obligatorio que falta; si no falta nada, la revisión
export function resumeStep(product: Pick<Product, 'priceArs' | 'images'>): WizardStepKey {
  if (product.images.length === 0) return WIZARD_STEP.PHOTO;
  if (product.priceArs < 1) return WIZARD_STEP.PRICE;
  return WIZARD_STEP.REVIEW;
}

export function productBlockers(product: Pick<Product, 'priceArs' | 'images'>): PublishBlocker[] {
  return publishBlockers({ priceArs: product.priceArs, hasPhoto: product.images.length > 0 });
}

// Cada faltante lleva al paso donde se arregla
export const BLOCKER_STEP: Readonly<Record<PublishBlocker, WizardStepKey>> = {
  PHOTO: WIZARD_STEP.PHOTO,
  PRICE: WIZARD_STEP.PRICE,
};
