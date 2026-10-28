import type { Product, ProductLine } from './types.ts';

const ROUTINE_STEP_LABEL: Readonly<Record<number, string>> = {
  1: 'Limpiar',
  2: 'Tratar e hidratar',
  3: 'Proteger',
};

export function routineStepLabel(step: number): string {
  return ROUTINE_STEP_LABEL[step] ?? `Paso ${step}`;
}

// Para qué sirve cada paso, en lenguaje simple: es la parte educativa de la rutina
const ROUTINE_STEP_HINT: Readonly<Record<number, string>> = {
  1: 'Retira maquillaje, protector solar y exceso de grasa para que el resto de la rutina funcione mejor.',
  2: 'Aporta activos e hidratación sobre la piel ya limpia.',
  3: 'Cuida la piel de la radiación solar durante el día.',
};

export function routineStepHint(step: number): string | null {
  return ROUTINE_STEP_HINT[step] ?? null;
}

export interface RoutineStep {
  step: number;
  label: string;
  hint: string | null;
  products: Product[];
}

export interface Routine {
  line: ProductLine;
  steps: RoutineStep[];
}

// Agrupa los productos que pertenecen a una línea y tienen paso asignado: línea -> pasos -> productos.
// Los productos sin línea o sin paso no forman parte de ninguna rutina.
export function buildRoutines(products: Product[]): Routine[] {
  const byLine = new Map<string, { line: ProductLine; steps: Map<number, Product[]> }>();

  for (const product of products) {
    if (!product.line || product.routineStep === null) continue;
    const entry = byLine.get(product.line.id) ?? { line: product.line, steps: new Map<number, Product[]>() };
    const stepProducts = entry.steps.get(product.routineStep) ?? [];
    stepProducts.push(product);
    entry.steps.set(product.routineStep, stepProducts);
    byLine.set(product.line.id, entry);
  }

  return [...byLine.values()]
    .map(({ line, steps }) => ({
      line,
      steps: [...steps]
        .sort(([a], [b]) => a - b)
        .map(([step, stepProducts]) => ({
          step,
          label: routineStepLabel(step),
          hint: routineStepHint(step),
          products: [...stepProducts].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        })),
    }))
    .sort((a, b) => a.line.name.localeCompare(b.line.name, 'es'));
}

export interface RoutinePosition {
  step: RoutineStep;
  // los pasos vecinos dentro de la misma rutina (null en los extremos)
  previous: RoutineStep | null;
  next: RoutineStep | null;
}

// Dónde queda un producto dentro de su rutina y qué viene antes y después. Se deriva de los datos
// que ya existen (línea y paso del producto): Camila no tiene que cargar nada más.
export function findRoutinePosition(routine: Routine, productId: string): RoutinePosition | null {
  const index = routine.steps.findIndex((step) => step.products.some((product) => product.id === productId));
  if (index === -1) return null;
  return { step: routine.steps[index], previous: routine.steps[index - 1] ?? null, next: routine.steps[index + 1] ?? null };
}
