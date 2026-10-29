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
    expect(withNotice('/admin/stock', 'cambios-guardados')).toBe('/admin/stock?aviso=cambios-guardados');
  });
  it('respeta una consulta que ya existe', () => {
    expect(withNotice('/admin/stock?q=crema', 'cambios-guardados')).toBe('/admin/stock?q=crema&aviso=cambios-guardados');
  });
  it('puede volver a la fila que se tocó', () => {
    expect(withNotice('/admin/stock', 'cambios-guardados', 'p-123')).toBe('/admin/stock?aviso=cambios-guardados#p-123');
  });
});
