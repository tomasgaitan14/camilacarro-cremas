import sharp, { type Metadata } from 'sharp';
import {
  IMAGE_MAX_INPUT_PIXELS,
  IMAGE_MAX_SIDE_PX,
  IMAGE_MAX_STORED_BYTES,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_MIN_SIDE_PX,
  IMAGE_WEBP_QUALITY,
} from './constants.ts';
import { ImageError } from './errors.ts';

const ACCEPTED_FORMATS: readonly string[] = ['jpeg', 'png', 'webp'];

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

const MB = 1024 * 1024;

// Foto del celular -> WebP de hasta 1200 px de lado: se corrige la orientación y se descartan los metadatos
// (sharp no los copia salvo que se pida), entre ellos la ubicación GPS.
export async function processProductImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length > IMAGE_MAX_UPLOAD_BYTES) {
    throw new ImageError('TOO_BIG', `La foto pesa demasiado: el máximo es ${IMAGE_MAX_UPLOAD_BYTES / MB} MB.`);
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS }).metadata();
  } catch (cause) {
    throw new ImageError('NOT_AN_IMAGE', 'No pudimos leer ese archivo. Probá con una foto en formato JPG, PNG o WebP.', { cause });
  }
  // un GIF animado, un PDF o un HEIC no son fotos que podamos usar
  if (!metadata.format || !ACCEPTED_FORMATS.includes(metadata.format) || (metadata.pages ?? 1) > 1) {
    throw new ImageError('NOT_AN_IMAGE', 'Ese archivo no es una foto que podamos usar. Probá con una foto en formato JPG, PNG o WebP.');
  }
  if (Math.min(metadata.width ?? 0, metadata.height ?? 0) < IMAGE_MIN_SIDE_PX) {
    throw new ImageError('TOO_SMALL', `La foto es muy chica: tiene que medir al menos ${IMAGE_MIN_SIDE_PX} píxeles de lado.`);
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: IMAGE_MAX_SIDE_PX, height: IMAGE_MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    if (data.length > IMAGE_MAX_STORED_BYTES) {
      throw new ImageError('TOO_BIG', 'La foto sigue pesando demasiado después de achicarla. Probá con otra.');
    }
    return { data, width: info.width, height: info.height };
  } catch (cause) {
    if (cause instanceof ImageError) throw cause;
    throw new ImageError('NOT_AN_IMAGE', 'No pudimos procesar esa foto. Probá con otra.', { cause });
  }
}
