import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GENERIC_SAVE_ERROR, describeAdminFailure, loadAdminProduct, uploadIsTooBig, uploadedFile } from '../src/lib/admin-page.ts';
import { IMAGE_MAX_UPLOAD_BYTES } from '../src/lib/constants.ts';
import { AdminDataError, ImageError, PublishBlockedError } from '../src/lib/errors.ts';

afterEach(() => vi.restoreAllMocks());

describe('describeAdminFailure', () => {
  it('muestra el mensaje de un problema con la foto', () => {
    expect(describeAdminFailure(new ImageError('TOO_SMALL', 'La foto es muy chica'))).toBe('La foto es muy chica');
  });

  it('dice qué falta para publicar', () => {
    expect(describeAdminFailure(new PublishBlockedError(['PHOTO', 'PRICE']))).toBe('Falta la foto principal. Falta el precio.');
  });

  it('un fallo de datos da un mensaje simple y deja el detalle en el registro del servidor', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cause = new Error('detalle técnico');
    const message = describeAdminFailure(new AdminDataError('No se pudo crear el producto', { cause }));
    expect(message).toBe(GENERIC_SAVE_ERROR);
    expect(message).not.toContain('crear');
    expect(log).toHaveBeenCalledWith('No se pudo crear el producto', cause);
  });

  it('un error inesperado no se disfraza: devuelve null para que suba como error', () => {
    expect(describeAdminFailure(new TypeError('bug'))).toBeNull();
    expect(describeAdminFailure('texto')).toBeNull();
  });
});

describe('loadAdminProduct', () => {
  const failingClient = new Proxy({}, { get: () => () => { throw new Error('no debería consultar la base'); } }) as unknown as SupabaseClient;

  it.each([undefined, '', 'abc', "1' or '1'='1", '../../etc/passwd', '3f2b8c1e-6a4d-4e0b-9c7a-1d2e3f4a5b6cX'])(
    'un id inválido ("%s") no llega a la base',
    async (id) => {
      await expect(loadAdminProduct(failingClient, id)).resolves.toBeNull();
    },
  );
});

describe('uploadIsTooBig', () => {
  const request = (length?: string) => new Request('http://x/', { method: 'POST', headers: length ? { 'content-length': length } : {} });
  it('corta pedidos que declaran un tamaño exagerado', () => {
    expect(uploadIsTooBig(request(String(IMAGE_MAX_UPLOAD_BYTES * 2 + 1)))).toBe(true);
  });
  it('deja pasar un tamaño razonable, el justo máximo y los pedidos sin tamaño declarado', () => {
    expect(uploadIsTooBig(request('1000'))).toBe(false);
    expect(uploadIsTooBig(request(String(IMAGE_MAX_UPLOAD_BYTES * 2)))).toBe(false);
    expect(uploadIsTooBig(request())).toBe(false);
  });
});

describe('uploadedFile', () => {
  it('devuelve el archivo si lo hay', () => {
    const form = new FormData();
    const file = new File(['x'], 'a.jpg');
    form.append('photo', file);
    expect(uploadedFile(form, 'photo')).toBeInstanceOf(File);
  });
  it('un campo de archivo vacío (no eligió nada) cuenta como sin archivo', () => {
    const form = new FormData();
    form.append('photo', new File([], ''));
    expect(uploadedFile(form, 'photo')).toBeNull();
  });
  it('un texto o un campo ausente no es un archivo', () => {
    const form = new FormData();
    form.append('photo', 'texto');
    expect(uploadedFile(form, 'photo')).toBeNull();
    expect(uploadedFile(form, 'otro')).toBeNull();
  });
});
