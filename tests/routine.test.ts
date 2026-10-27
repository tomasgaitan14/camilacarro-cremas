import { describe, expect, it } from 'vitest';
import { buildRoutines, routineStepHint, routineStepLabel } from '../src/lib/routine.ts';
import { makeLine, makeProduct } from './support/factories.ts';

const LINE_A = makeLine({ id: 'la', slug: 'linea-a', name: 'Línea A' });
const LINE_B = makeLine({ id: 'lb', slug: 'linea-b', name: 'Línea B' });

describe('routineStepLabel', () => {
  it('conoce los tres pasos de la rutina', () => {
    expect(routineStepLabel(1)).toBe('Limpiar');
    expect(routineStepLabel(2)).toBe('Tratar e hidratar');
    expect(routineStepLabel(3)).toBe('Proteger');
  });

  it('usa un nombre genérico para pasos posteriores', () => {
    expect(routineStepLabel(4)).toBe('Paso 4');
  });
});

describe('routineStepHint', () => {
  it('explica los tres pasos y no inventa explicación para otros', () => {
    expect(routineStepHint(1)).toContain('maquillaje');
    expect(routineStepHint(2)).toContain('hidratación');
    expect(routineStepHint(3)).toContain('solar');
    expect(routineStepHint(4)).toBeNull();
  });
});

describe('buildRoutines', () => {
  it('agrupa por línea y ordena los pasos de menor a mayor', () => {
    const routines = buildRoutines([
      makeProduct({ id: '3', name: 'Protector', line: LINE_A, routineStep: 3 }),
      makeProduct({ id: '1', name: 'Aceite', line: LINE_A, routineStep: 1 }),
      makeProduct({ id: '2', name: 'Crema', line: LINE_A, routineStep: 2 }),
    ]);
    expect(routines).toHaveLength(1);
    expect(routines[0].line.id).toBe('la');
    expect(routines[0].steps.map((s) => [s.step, s.label, s.products.map((p) => p.name)])).toEqual([
      [1, 'Limpiar', ['Aceite']],
      [2, 'Tratar e hidratar', ['Crema']],
      [3, 'Proteger', ['Protector']],
    ]);
    expect(routines[0].steps.map((s) => s.hint)).toEqual([routineStepHint(1), routineStepHint(2), routineStepHint(3)]);
  });

  it('junta varios productos del mismo paso, ordenados por nombre', () => {
    const [routine] = buildRoutines([
      makeProduct({ id: '1', name: 'Zeta', line: LINE_A, routineStep: 1 }),
      makeProduct({ id: '2', name: 'Álamo', line: LINE_A, routineStep: 1 }),
    ]);
    expect(routine.steps[0].products.map((p) => p.name)).toEqual(['Álamo', 'Zeta']);
  });

  it('ignora productos sin línea o sin paso', () => {
    const routines = buildRoutines([
      makeProduct({ id: '1', line: null, routineStep: null }),
      makeProduct({ id: '2', line: LINE_A, routineStep: null }),
    ]);
    expect(routines).toEqual([]);
  });

  it('separa las líneas y las ordena por nombre', () => {
    const routines = buildRoutines([
      makeProduct({ id: '1', line: LINE_B, routineStep: 1 }),
      makeProduct({ id: '2', line: LINE_A, routineStep: 1 }),
    ]);
    expect(routines.map((r) => r.line.name)).toEqual(['Línea A', 'Línea B']);
  });

  it('una lista vacía no genera rutinas', () => {
    expect(buildRoutines([])).toEqual([]);
  });

  it('un salto de pasos se respeta tal cual (1 y 3 sin 2)', () => {
    const [routine] = buildRoutines([
      makeProduct({ id: '1', line: LINE_A, routineStep: 1 }),
      makeProduct({ id: '3', line: LINE_A, routineStep: 3 }),
    ]);
    expect(routine.steps.map((s) => s.step)).toEqual([1, 3]);
  });
});
