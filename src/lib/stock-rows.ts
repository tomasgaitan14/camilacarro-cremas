import { PRODUCT_LIMITS, STOCK_STEP } from './constants.ts';

// Lo que muestra el campo de unidades después de tocar − o +: nunca baja de 0 ni pasa el máximo.
// Si lo escrito no es un número entero se parte de 0.
export function stepStock(raw: string, direction: 1 | -1): string {
  const text = raw.trim();
  const current = /^\d+$/.test(text) ? Number(text) : 0;
  return String(Math.min(PRODUCT_LIMITS.STOCK_MAX, Math.max(0, current + direction * STOCK_STEP)));
}

const SELECTORS = {
  ROW: 'form[data-stock-row]',
  STOCK: '[data-stock-input]',
  PRICE: '[data-price-input]',
  STEP: '[data-stock-step]',
  SAVE: '[data-save]',
  HINT: '[data-unsaved-hint]',
} as const;

// «−» y «+» solo cambian el número que se ve: no guardan ni recargan. Recién «Guardar» manda precio y unidades.
// Sin JavaScript los botones quedan ocultos y se escribe el número directamente.
export function initStockRows(root: ParentNode): void {
  for (const form of root.querySelectorAll<HTMLFormElement>(SELECTORS.ROW)) {
    const stock = form.querySelector<HTMLInputElement>(SELECTORS.STOCK);
    const price = form.querySelector<HTMLInputElement>(SELECTORS.PRICE);
    const save = form.querySelector<HTMLButtonElement>(SELECTORS.SAVE);
    const hint = form.querySelector<HTMLElement>(SELECTORS.HINT);
    if (!stock || !price || !save || !hint) continue;

    // lo guardado en la base, no lo que haya quedado escrito si un intento anterior falló
    const savedStock = form.dataset.savedStock ?? '';
    const savedPrice = form.dataset.savedPrice ?? '';

    const refresh = () => {
      const dirty = stock.value.trim() !== savedStock || price.value.trim() !== savedPrice;
      form.toggleAttribute('data-dirty', dirty);
      hint.hidden = !dirty;
      save.classList.toggle('btn-solid', dirty);
      save.classList.toggle('btn-ghost', !dirty);
    };

    for (const button of form.querySelectorAll<HTMLButtonElement>(SELECTORS.STEP)) {
      button.hidden = false;
      button.addEventListener('click', () => {
        stock.value = stepStock(stock.value, button.dataset.stockStep === '-1' ? -1 : 1);
        refresh();
      });
    }
    stock.addEventListener('input', refresh);
    price.addEventListener('input', refresh);
    refresh();
  }
}
