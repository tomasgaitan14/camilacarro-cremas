// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_LIMITS } from '../src/lib/constants.ts';
import { initStockRows, stepStock } from '../src/lib/stock-rows.ts';

describe('stepStock', () => {
  it.each([
    ['5', 1, '6'],
    ['5', -1, '4'],
    ['0', 1, '1'],
    [' 12 ', 1, '13'],
    ['0', -1, '0'],
    [String(PRODUCT_LIMITS.STOCK_MAX), 1, String(PRODUCT_LIMITS.STOCK_MAX)],
    [String(PRODUCT_LIMITS.STOCK_MAX - 1), 1, String(PRODUCT_LIMITS.STOCK_MAX)],
  ] as const)('%j con %i da %j', (raw, direction, expected) => {
    expect(stepStock(raw, direction)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '1.5', '1,5', '-3', '5 unidades', '1e3'])('un valor que no es un entero ("%s") parte de 0', (raw) => {
    expect(stepStock(raw, 1)).toBe('1');
    expect(stepStock(raw, -1)).toBe('0');
  });

  it('un número exagerado vuelve al máximo en lugar de seguir creciendo', () => {
    expect(stepStock('9'.repeat(30), 1)).toBe(String(PRODUCT_LIMITS.STOCK_MAX));
    expect(stepStock('9'.repeat(30), -1)).toBe(String(PRODUCT_LIMITS.STOCK_MAX));
  });
});

function rowHtml(id: string, stock: string, price: string): string {
  return `
    <form method="post" data-stock-row data-saved-stock="${stock}" data-saved-price="${price}" id="form-${id}">
      <button type="button" hidden data-stock-step="-1" id="less-${id}">menos</button>
      <input name="stock" data-stock-input value="${stock}" />
      <button type="button" hidden data-stock-step="1" id="more-${id}">más</button>
      <input name="price" data-price-input value="${price}" />
      <button type="submit" data-save class="btn btn-solid">Guardar</button>
      <p hidden data-unsaved-hint>Tenés cambios sin guardar</p>
    </form>`;
}

const field = (selector: string, formId = 'a') => document.querySelector<HTMLInputElement>(`#form-${formId} ${selector}`)!;
const click = (id: string) => document.getElementById(id)!.click();
const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('initStockRows', () => {
  let submitted: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = rowHtml('a', '5', '12500') + rowHtml('b', '2', '900');
    submitted = vi.fn((event: Event) => event.preventDefault());
    document.addEventListener('submit', submitted as EventListener);
    initStockRows(document);
  });

  it('muestra los botones − y + (sin JavaScript quedan ocultos)', () => {
    expect([...document.querySelectorAll<HTMLElement>('[data-stock-step]')].every((button) => !button.hidden)).toBe(true);
  });

  it('+ y − cambian solo el número, sin enviar el formulario', () => {
    click('more-a');
    click('more-a');
    expect(field('[data-stock-input]').value).toBe('7');
    click('less-a');
    expect(field('[data-stock-input]').value).toBe('6');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('no toca el precio ni las unidades de otras filas', () => {
    click('more-a');
    expect(field('[data-price-input]').value).toBe('12500');
    expect(field('[data-stock-input]', 'b').value).toBe('2');
  });

  it('no baja de 0', () => {
    click('less-b');
    click('less-b');
    click('less-b');
    expect(field('[data-stock-input]', 'b').value).toBe('0');
  });

  it('sin cambios, el aviso está oculto y «Guardar» es secundario', () => {
    expect(field('[data-unsaved-hint]').hidden).toBe(true);
    expect(field('[data-save]').classList.contains('btn-ghost')).toBe(true);
    expect(field('[data-save]').classList.contains('btn-solid')).toBe(false);
  });

  it('con cambios aparece el aviso y «Guardar» pasa a ser el botón principal', () => {
    click('more-a');
    expect(field('[data-unsaved-hint]').hidden).toBe(false);
    expect(field('[data-save]').classList.contains('btn-solid')).toBe(true);
    expect(document.getElementById('form-a')!.hasAttribute('data-dirty')).toBe(true);
    // la otra fila no cambió
    expect(field('[data-unsaved-hint]', 'b').hidden).toBe(true);
  });

  it('escribir el precio a mano también cuenta como cambio', () => {
    type(field('[data-price-input]'), '13000');
    expect(field('[data-unsaved-hint]').hidden).toBe(false);
  });

  it('volver al valor guardado quita el aviso', () => {
    click('more-a');
    click('less-a');
    expect(field('[data-unsaved-hint]').hidden).toBe(true);
    type(field('[data-price-input]'), '13000');
    type(field('[data-price-input]'), ' 12500 ');
    expect(field('[data-unsaved-hint]').hidden).toBe(true);
  });

  it('si la página volvió con un valor que no se pudo guardar, ya arranca con el aviso', () => {
    document.body.innerHTML = `<form data-stock-row data-saved-stock="5" data-saved-price="12500" id="form-c">
      <button type="button" hidden data-stock-step="1">más</button>
      <input name="stock" data-stock-input value="abc" />
      <input name="price" data-price-input value="12500" />
      <button type="submit" data-save class="btn btn-solid">Guardar</button>
      <p hidden data-unsaved-hint>Tenés cambios sin guardar</p>
    </form>`;
    initStockRows(document);
    expect(field('[data-unsaved-hint]', 'c').hidden).toBe(false);
  });

  it('una fila incompleta se saltea sin romper las demás', () => {
    document.body.innerHTML = `<form data-stock-row id="form-x"><input data-stock-input value="1" /></form>` + rowHtml('a', '5', '12500');
    expect(() => initStockRows(document)).not.toThrow();
    click('more-a');
    expect(field('[data-stock-input]').value).toBe('6');
  });
});
