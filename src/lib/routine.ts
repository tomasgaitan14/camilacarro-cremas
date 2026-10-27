import type { Product, ProductLine } from './types.ts';

const ROUTINE_STEP_LABEL: Readonly<Record<number, string>> = {
  1: 'Limpiar',
  2: 'Tratar e hidratar',
  3: 'Proteger',
};

export function routineStepLabel(step: number): string {
  return ROUTINE_STEP_LABEL[step] ?? `Paso ${step}`;
}

export interface RoutineStep {
  step: number;
  label: string;
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
          products: [...stepProducts].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        })),
    }))
    .sort((a, b) => a.line.name.localeCompare(b.line.name, 'es'));
}
