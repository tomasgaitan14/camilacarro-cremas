import { describe, expect, it } from 'vitest';
import {
  BLOCKER_STEP,
  WIZARD_STEP,
  WIZARD_STEPS,
  isFromReview,
  nextStep,
  previousStep,
  productBlockers,
  resumeStep,
  stepDestination,
  stepNumber,
  wizardPath,
} from '../src/lib/admin-wizard.ts';
import { makeProduct } from './support/factories.ts';

const photo = { id: 'i1', url: 'http://x/a.webp', alt: '', position: 0, kind: 'main' as const };
const ID = '3f2b8c1e-6a4d-4e0b-9c7a-1d2e3f4a5b6c';

describe('pasos del asistente', () => {
  it('son cinco, en orden', () => {
    expect(WIZARD_STEPS.map((step) => step.key)).toEqual(['datos', 'foto', 'precio', 'detalles', 'revisar']);
  });

  it('numera de 1 a 5', () => {
    expect(WIZARD_STEPS.map((step) => stepNumber(step.key))).toEqual([1, 2, 3, 4, 5]);
  });

  it('cada paso sigue al anterior y la revisión es el final', () => {
    expect(nextStep(WIZARD_STEP.BASICS)).toBe('foto');
    expect(nextStep(WIZARD_STEP.PHOTO)).toBe('precio');
    expect(nextStep(WIZARD_STEP.PRICE)).toBe('detalles');
    expect(nextStep(WIZARD_STEP.DETAILS)).toBe('revisar');
    expect(nextStep(WIZARD_STEP.REVIEW)).toBe('revisar');
  });

  it('el anterior del primero no existe', () => {
    expect(previousStep(WIZARD_STEP.BASICS)).toBeNull();
    expect(previousStep(WIZARD_STEP.PHOTO)).toBe('datos');
    expect(previousStep(WIZARD_STEP.REVIEW)).toBe('detalles');
  });

  it('arma la dirección de cada paso', () => {
    expect(wizardPath(ID, WIZARD_STEP.PRICE)).toBe(`/admin/productos/${ID}/precio`);
  });

  it('después de guardar sigue el paso siguiente, o vuelve a la revisión si se venía de ahí', () => {
    expect(stepDestination(ID, WIZARD_STEP.PHOTO, false)).toBe(`/admin/productos/${ID}/precio`);
    expect(stepDestination(ID, WIZARD_STEP.PHOTO, true)).toBe(`/admin/productos/${ID}/revisar`);
  });

  it('solo «de=revisar» cuenta como venir de la revisión', () => {
    expect(isFromReview(new URLSearchParams('de=revisar'))).toBe(true);
    expect(isFromReview(new URLSearchParams(''))).toBe(false);
    expect(isFromReview(new URLSearchParams('de=https://evil.example'))).toBe(false);
    expect(isFromReview(new URLSearchParams('de=Revisar'))).toBe(false);
  });
});

describe('retomar un borrador', () => {
  it('sin foto, la foto; con foto y sin precio, el precio; con ambos, la revisión', () => {
    expect(resumeStep({ priceArs: 0, images: [] })).toBe('foto');
    expect(resumeStep({ priceArs: 5000, images: [] })).toBe('foto');
    expect(resumeStep({ priceArs: 0, images: [photo] })).toBe('precio');
    expect(resumeStep({ priceArs: 5000, images: [photo] })).toBe('revisar');
  });

  it('qué falta para publicar y a qué paso lleva cada cosa', () => {
    expect(productBlockers(makeProduct({ priceArs: 0, images: [] }))).toEqual(['PHOTO', 'PRICE']);
    expect(productBlockers(makeProduct({ priceArs: 100, images: [photo] }))).toEqual([]);
    expect(BLOCKER_STEP).toEqual({ PHOTO: 'foto', PRICE: 'precio' });
  });
});
