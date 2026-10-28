import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  IMAGE_MAX_INPUT_PIXELS,
  IMAGE_MAX_SIDE_PX,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_MIN_SIDE_PX,
} from '../src/lib/constants.ts';
import { ImageError, type ImageErrorCode } from '../src/lib/errors.ts';
import { processProductImage } from '../src/lib/image-processing.ts';

const BACKGROUND = { r: 219, g: 156, b: 156 };

function blank(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: BACKGROUND } });
}

async function expectImageError(promise: Promise<unknown>, code: ImageErrorCode) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ImageError);
  expect((error as ImageError).code).toBe(code);
}

describe('processProductImage', () => {
  it('achica una foto grande a 1200 px de lado y la pasa a WebP, conservando la proporción', async () => {
    const result = await processProductImage(await blank(3000, 2000).jpeg().toBuffer());
    expect(result.width).toBe(IMAGE_MAX_SIDE_PX);
    expect(result.height).toBe(800);
    const meta = await sharp(result.data).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([1200, 800]);
  });

  it('una foto vertical también queda dentro de 1200 px', async () => {
    const result = await processProductImage(await blank(2000, 3000).png().toBuffer());
    expect([result.width, result.height]).toEqual([800, 1200]);
  });

  it('no agranda una foto que ya es chica', async () => {
    const result = await processProductImage(await blank(800, 600).jpeg().toBuffer());
    expect([result.width, result.height]).toEqual([800, 600]);
  });

  it('endereza las fotos de celular que vienen giradas (orientación EXIF)', async () => {
    // el celular guarda la foto horizontal y marca «girar»: lo que se ve es vertical
    const rotated = await blank(1600, 1000).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await processProductImage(rotated);
    expect([result.width, result.height]).toEqual([750, 1200]);
  });

  it('descarta los metadatos (ubicación, cámara, fecha)', async () => {
    const withExif = await blank(1000, 1000)
      .jpeg()
      .withExif({ IFD0: { Copyright: 'dato-privado', Make: 'camara-secreta' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const result = await processProductImage(withExif);
    const meta = await sharp(result.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(result.data.toString('latin1')).not.toContain('dato-privado');
  });

  it('acepta JPG, PNG y WebP', async () => {
    for (const buffer of [await blank(600, 600).jpeg().toBuffer(), await blank(600, 600).png().toBuffer(), await blank(600, 600).webp().toBuffer()]) {
      await expect(processProductImage(buffer)).resolves.toMatchObject({ width: 600 });
    }
  });

  it('acepta justo el lado mínimo y rechaza uno menos', async () => {
    await expect(processProductImage(await blank(IMAGE_MIN_SIDE_PX, 1000).jpeg().toBuffer())).resolves.toBeDefined();
    await expectImageError(processProductImage(await blank(IMAGE_MIN_SIDE_PX - 1, 1000).jpeg().toBuffer()), 'TOO_SMALL');
    await expectImageError(processProductImage(await blank(1000, IMAGE_MIN_SIDE_PX - 1).jpeg().toBuffer()), 'TOO_SMALL');
  });

  it.each([
    ['un archivo de texto', () => Buffer.from('esto no es una foto')],
    ['un archivo vacío', () => Buffer.alloc(0)],
    ['bytes al azar', () => Buffer.from(Array.from({ length: 2000 }, (_, i) => (i * 37) % 256))],
    ['un PDF', () => Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n')],
    ['un SVG', () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500"/></svg>')],
  ])('rechaza %s', async (_name, make) => {
    await expectImageError(processProductImage(make()), 'NOT_AN_IMAGE');
  });

  it('rechaza un GIF (formato no aceptado)', async () => {
    await expectImageError(processProductImage(await blank(600, 600).gif().toBuffer()), 'NOT_AN_IMAGE');
  });

  it('rechaza un JPG cortado a la mitad', async () => {
    // ruido: un JPG de color liso casi no pesa y no se puede cortar de forma convincente
    const side = 1500;
    const full = await sharp(randomBytes(side * side * 3), { raw: { width: side, height: side, channels: 3 } })
      .jpeg()
      .toBuffer();
    await expectImageError(processProductImage(full.subarray(0, Math.floor(full.length / 2))), 'NOT_AN_IMAGE');
  });

  it('rechaza lo que pesa más que el máximo de subida, sin intentar procesarlo', async () => {
    await expectImageError(processProductImage(Buffer.alloc(IMAGE_MAX_UPLOAD_BYTES + 1)), 'TOO_BIG');
  });

  it('rechaza una imagen con demasiados píxeles (bomba de descompresión)', async () => {
    const side = Math.ceil(Math.sqrt(IMAGE_MAX_INPUT_PIXELS)) + 100;
    const bomb = await sharp(Buffer.alloc(side * side, 128), { raw: { width: side, height: side, channels: 1 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(IMAGE_MAX_UPLOAD_BYTES);
    await expectImageError(processProductImage(bomb), 'NOT_AN_IMAGE');
  }, 60_000);
});
