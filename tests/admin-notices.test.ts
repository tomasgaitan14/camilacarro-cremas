import { describe, expect, it } from 'vitest';
import { ADMIN_NOTICES, noticeFor, withNotice } from '../src/lib/admin-notices.ts';

describe('noticeFor', () => {
  it.each(Object.keys(ADMIN_NOTICES))('el código «%s» tiene un mensaje', (code) => {
    expect(noticeFor(code)).toBe(ADMIN_NOTICES[code as keyof typeof ADMIN_NOTICES]);
  });

  it.each([null, undefined, '', 'no-existe', '<script>alert(1)</script>', 'toString', '__proto__', 'constructor', 'hasOwnProperty'])(
    'un código desconocido ("%s") no muestra nada',
    (code) => {
      expect(noticeFor(code)).toBeNull();
    },
  );
});

describe('withNotice', () => {
  it('agrega el aviso a una dirección simple', () => {
    expect(withNotice('/admin/stock', 'precio')).toBe('/admin/stock?aviso=precio');
  });
  it('respeta una consulta que ya existe', () => {
    expect(withNotice('/admin/stock?q=crema', 'precio')).toBe('/admin/stock?q=crema&aviso=precio');
  });
  it('puede volver a la fila que se tocó', () => {
    expect(withNotice('/admin/stock', 'unidades', 'p-123')).toBe('/admin/stock?aviso=unidades#p-123');
  });
});
