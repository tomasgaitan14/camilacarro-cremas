import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adjustStock,
  archiveProduct,
  createDraftProduct,
  hideProduct,
  publishBlockers,
  publishProduct,
  restoreProduct,
  updateBasics,
  updateDetails,
  updatePriceStock,
  updateQuickPrice,
  updateQuickStock,
} from '../src/lib/admin-products.ts';
import { addExtraImage, removeImage, setMainImage } from '../src/lib/admin-product-images.ts';
import type { DetailsInput } from '../src/lib/admin-product-input.ts';
import { getCatalog } from '../src/lib/catalog-cache.ts';
import { getProductForAdmin, listProducts, listProductsForAdmin } from '../src/lib/catalog.ts';
import { IMAGE_MAX_PER_PRODUCT, PRODUCT_LIMITS, PRODUCT_STATUS, STORAGE_BUCKET } from '../src/lib/constants.ts';
import { AdminDataError, ImageError, PublishBlockedError } from '../src/lib/errors.ts';
import {
  adminClient,
  anonClient,
  assertSupabaseIsUp,
  createFixture,
  createRegularUser,
  serviceClient,
  type Fixture,
  type TestUser,
} from './support/supabase.ts';

let fixture: Fixture;
let admin: SupabaseClient;
let regular: TestUser;
const productIds: string[] = [];
const referenceSlugs = { brands: [] as string[], categories: [] as string[] };

const EMPTY_DETAILS: DetailsInput = {
  summary: '',
  volume: '',
  keyIngredients: '',
  benefits: [],
  usageSteps: [],
  skinTypes: [],
  warnings: '',
  usageTime: null,
  line: { kind: 'none' },
  routineStep: null,
};

async function photo(width = 900, height = 700, name = 'foto.jpg'): Promise<File> {
  const data = await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 130 } } }).jpeg().toBuffer();
  return new File([new Uint8Array(data)], name, { type: 'image/jpeg' });
}

async function newDraft(name: string) {
  const { id, slug } = await createDraftProduct(admin, {
    name,
    brand: { kind: 'existing', id: fixture.brandId },
    category: { kind: 'existing', id: fixture.categoryId },
  });
  productIds.push(id);
  return { id, slug };
}

const unique = (label: string) => `${label} ${fixture.tag}`;

async function storedPaths(productId: string): Promise<string[]> {
  const { data, error } = await serviceClient().storage.from(STORAGE_BUCKET).list(productId);
  if (error) throw error;
  return data.map((object) => `${productId}/${object.name}`);
}

beforeAll(async () => {
  await assertSupabaseIsUp();
  fixture = await createFixture();
  admin = await adminClient();
  regular = await createRegularUser();
});

afterAll(async () => {
  const service = serviceClient();
  for (const id of productIds) {
    const paths = await storedPaths(id).catch(() => []);
    if (paths.length > 0) await service.storage.from(STORAGE_BUCKET).remove(paths);
  }
  if (productIds.length > 0) await service.from('products').delete().in('id', productIds);
  await service.from('product_lines').delete().in('slug', [`otra-linea-${fixture.tag}`]);
  await service.from('brands').delete().in('slug', referenceSlugs.brands);
  await service.from('categories').delete().in('slug', referenceSlugs.categories);
  await fixture?.cleanup();
  await regular?.remove();
});

describe('publishBlockers', () => {
  it.each([
    [{ priceArs: 100, hasPhoto: true }, []],
    [{ priceArs: 100, hasPhoto: false }, ['PHOTO']],
    [{ priceArs: 0, hasPhoto: true }, ['PRICE']],
    [{ priceArs: 0, hasPhoto: false }, ['PHOTO', 'PRICE']],
    [{ priceArs: 1, hasPhoto: true }, []],
  ])('%j', (product, expected) => {
    expect(publishBlockers(product)).toEqual(expected);
  });
});

describe('createDraftProduct', () => {
  it('crea un borrador sin precio ni unidades, con la dirección sacada del nombre', async () => {
    const { id, slug } = await newDraft(unique('Crema Hidratante Ácida'));
    expect(slug).toBe(`crema-hidratante-acida-${fixture.tag}`);
    const product = await getProductForAdmin(admin, id);
    expect(product).toMatchObject({ status: PRODUCT_STATUS.DRAFT, priceArs: 0, stock: 0, name: `Crema Hidratante Ácida ${fixture.tag}` });
    expect(product?.brand.id).toBe(fixture.brandId);
  });

  it('un nombre repetido recibe -2, -3 en la dirección', async () => {
    const name = unique('Sérum repetido');
    const first = await newDraft(name);
    const second = await newDraft(name);
    const third = await newDraft(name);
    expect([first.slug, second.slug, third.slug]).toEqual([`serum-repetido-${fixture.tag}`, `serum-repetido-${fixture.tag}-2`, `serum-repetido-${fixture.tag}-3`]);
  });

  it('un nombre sin letras ni números usa una dirección genérica', async () => {
    const { slug } = await newDraft('!!!');
    expect(slug).toMatch(/^producto(-\d+)?$/);
  });

  it('un nombre del largo máximo no rompe el límite de la dirección, ni con el -2 de un repetido', async () => {
    const name = `${fixture.tag}${'a'.repeat(PRODUCT_LIMITS.NAME - fixture.tag.length)}`;
    const first = await newDraft(name);
    const second = await newDraft(name);
    expect(first.slug).toHaveLength(PRODUCT_LIMITS.PRODUCT_SLUG);
    expect(second.slug).toHaveLength(PRODUCT_LIMITS.PRODUCT_SLUG);
    expect(second.slug.endsWith('-2')).toBe(true);
  });

  it('crea la marca y la categoría nuevas, y las reutiliza si se escribe igual', async () => {
    const brandName = `Marca Nueva ${fixture.tag}`;
    const categoryName = `Cat Nueva ${fixture.tag}`;
    referenceSlugs.brands.push(`marca-nueva-${fixture.tag}`);
    referenceSlugs.categories.push(`cat-nueva-${fixture.tag}`);
    const make = async (brandText: string, categoryText: string) => {
      const { id } = await createDraftProduct(admin, {
        name: unique('Producto con marca nueva'),
        brand: { kind: 'new', name: brandText },
        category: { kind: 'new', name: categoryText },
      });
      productIds.push(id);
      return getProductForAdmin(admin, id);
    };
    const first = await make(brandName, categoryName);
    const second = await make(brandName.toUpperCase(), `  ${categoryName}  `);
    expect(first?.brand.slug).toBe(`marca-nueva-${fixture.tag}`);
    expect(second?.brand.id).toBe(first?.brand.id);
    expect(second?.category.id).toBe(first?.category.id);
    const { count } = await serviceClient().from('brands').select('id', { count: 'exact', head: true }).eq('slug', `marca-nueva-${fixture.tag}`);
    expect(count).toBe(1);
  });

  it('una marca que no existe falla con un error claro y no deja un producto a medias', async () => {
    await expect(
      createDraftProduct(admin, {
        name: unique('Huérfano'),
        brand: { kind: 'existing', id: '00000000-0000-4000-8000-000000000000' },
        category: { kind: 'existing', id: fixture.categoryId },
      }),
    ).rejects.toBeInstanceOf(AdminDataError);
    // se mira solo este producto: otros archivos de tests crean productos en paralelo
    const { count } = await serviceClient().from('products').select('id', { count: 'exact', head: true }).eq('name', unique('Huérfano'));
    expect(count).toBe(0);
  });

  it('sin la sesión de un admin la base lo rechaza y no se crea nada', async () => {
    for (const client of [regular.client, anonClient()]) {
      await expect(
        createDraftProduct(client, {
          name: unique('Intruso'),
          brand: { kind: 'existing', id: fixture.brandId },
          category: { kind: 'existing', id: fixture.categoryId },
        }),
      ).rejects.toBeInstanceOf(AdminDataError);
    }
    const { count } = await serviceClient().from('products').select('id', { count: 'exact', head: true }).ilike('name', `Intruso%${fixture.tag}`);
    expect(count).toBe(0);
  });
});

describe('updateBasics', () => {
  it('renombra sin cambiar la dirección y actualiza el texto de las fotos', async () => {
    const { id, slug } = await newDraft(unique('Nombre viejo'));
    await setMainImage(admin, { id, name: unique('Nombre viejo') }, await photo());
    await updateBasics(admin, id, {
      name: unique('Nombre nuevo'),
      brand: { kind: 'existing', id: fixture.brandId },
      category: { kind: 'existing', id: fixture.categoryId },
    });
    const product = await getProductForAdmin(admin, id);
    expect(product?.name).toBe(`Nombre nuevo ${fixture.tag}`);
    expect(product?.slug).toBe(slug);
    expect(product?.images[0].alt).toBe(`Nombre nuevo ${fixture.tag}`);
  });

  it('al cambiar de marca el producto deja la línea y el paso de rutina', async () => {
    const { id } = await newDraft(unique('Cambia de marca'));
    await updateDetails(admin, id, fixture.brandId, { ...EMPTY_DETAILS, line: { kind: 'existing', id: fixture.lineId }, routineStep: 2 });
    expect(await getProductForAdmin(admin, id)).toMatchObject({ routineStep: 2, line: { id: fixture.lineId } });

    referenceSlugs.brands.push(`otra-marca-${fixture.tag}`);
    await updateBasics(admin, id, {
      name: unique('Cambia de marca'),
      brand: { kind: 'new', name: `Otra marca ${fixture.tag}` },
      category: { kind: 'existing', id: fixture.categoryId },
    });
    const moved = await getProductForAdmin(admin, id);
    expect(moved?.brand.slug).toBe(`otra-marca-${fixture.tag}`);
    expect(moved?.line).toBeNull();
    expect(moved?.routineStep).toBeNull();
  });

  it('si la marca no cambia, conserva la línea y el paso', async () => {
    const { id } = await newDraft(unique('Misma marca'));
    await updateDetails(admin, id, fixture.brandId, { ...EMPTY_DETAILS, line: { kind: 'existing', id: fixture.lineId }, routineStep: 3 });
    await updateBasics(admin, id, {
      name: unique('Misma marca renombrada'),
      brand: { kind: 'existing', id: fixture.brandId },
      category: { kind: 'existing', id: fixture.categoryId },
    });
    expect(await getProductForAdmin(admin, id)).toMatchObject({ routineStep: 3, line: { id: fixture.lineId } });
  });
});

describe('updatePriceStock y edición rápida', () => {
  it('guarda precio y unidades', async () => {
    const { id } = await newDraft(unique('Con precio'));
    await updatePriceStock(admin, id, { priceArs: 12500, stock: 8 });
    expect(await getProductForAdmin(admin, id)).toMatchObject({ priceArs: 12500, stock: 8 });
  });

  it('la edición rápida cambia un solo dato y deja el otro', async () => {
    const { id } = await newDraft(unique('Rápida'));
    await updatePriceStock(admin, id, { priceArs: 1000, stock: 4 });
    await updateQuickPrice(admin, id, 1500);
    expect(await getProductForAdmin(admin, id)).toMatchObject({ priceArs: 1500, stock: 4 });
    await updateQuickStock(admin, id, 9);
    expect(await getProductForAdmin(admin, id)).toMatchObject({ priceArs: 1500, stock: 9 });
  });

  it('un valor que la base rechaza (negativo) falla con error claro y no cambia nada', async () => {
    const { id } = await newDraft(unique('Negativo'));
    await updatePriceStock(admin, id, { priceArs: 1000, stock: 4 });
    await expect(updateQuickStock(admin, id, -1)).rejects.toBeInstanceOf(AdminDataError);
    await expect(updateQuickPrice(admin, id, -5)).rejects.toBeInstanceOf(AdminDataError);
    expect(await getProductForAdmin(admin, id)).toMatchObject({ priceArs: 1000, stock: 4 });
  });

  it('otro usuario no puede cambiar precios', async () => {
    const { id } = await newDraft(unique('Protegido'));
    await updatePriceStock(admin, id, { priceArs: 1000, stock: 4 });
    // sin permiso la RLS filtra la fila: la actualización no toca nada
    await updateQuickPrice(regular.client, id, 1).catch(() => undefined);
    expect((await getProductForAdmin(admin, id))?.priceArs).toBe(1000);
  });
});

describe('adjustStock', () => {
  it('suma y resta', async () => {
    const { id } = await newDraft(unique('Ajuste'));
    await updatePriceStock(admin, id, { priceArs: 100, stock: 5 });
    expect(await adjustStock(admin, id, 1)).toBe(6);
    expect(await adjustStock(admin, id, -1)).toBe(5);
    expect((await getProductForAdmin(admin, id))?.stock).toBe(5);
  });

  it('nunca baja de 0 ni pasa el máximo', async () => {
    const { id } = await newDraft(unique('Límites de stock'));
    await updatePriceStock(admin, id, { priceArs: 100, stock: 0 });
    expect(await adjustStock(admin, id, -1)).toBe(0);
    await updateQuickStock(admin, id, PRODUCT_LIMITS.STOCK_MAX);
    expect(await adjustStock(admin, id, 1)).toBe(PRODUCT_LIMITS.STOCK_MAX);
  });
});

describe('updateDetails', () => {
  it('guarda todos los detalles', async () => {
    const { id } = await newDraft(unique('Con detalles'));
    await updateDetails(admin, id, fixture.brandId, {
      summary: 'Crema suave',
      volume: '50 ml',
      keyIngredients: 'Centella',
      benefits: ['Hidrata', 'Calma'],
      usageSteps: ['Limpiá', 'Aplicá'],
      skinTypes: ['Piel seca'],
      warnings: 'Evitar los ojos',
      usageTime: 'night',
      line: { kind: 'existing', id: fixture.lineId },
      routineStep: 2,
    });
    expect(await getProductForAdmin(admin, id)).toMatchObject({
      summary: 'Crema suave',
      volume: '50 ml',
      keyIngredients: 'Centella',
      benefits: ['Hidrata', 'Calma'],
      usageSteps: ['Limpiá', 'Aplicá'],
      skinTypes: ['Piel seca'],
      warnings: 'Evitar los ojos',
      usageTime: 'night',
      routineStep: 2,
      line: { id: fixture.lineId },
    });
  });

  it('una línea nueva se crea dentro de la marca del producto y se reutiliza', async () => {
    const a = await newDraft(unique('Línea nueva A'));
    const b = await newDraft(unique('Línea nueva B'));
    const lineName = `Otra línea ${fixture.tag}`;
    await updateDetails(admin, a.id, fixture.brandId, { ...EMPTY_DETAILS, line: { kind: 'new', name: lineName }, routineStep: 1 });
    await updateDetails(admin, b.id, fixture.brandId, { ...EMPTY_DETAILS, line: { kind: 'new', name: lineName.toLowerCase() } });
    const [first, second] = [await getProductForAdmin(admin, a.id), await getProductForAdmin(admin, b.id)];
    expect(first?.line).toMatchObject({ slug: `otra-linea-${fixture.tag}`, brandId: fixture.brandId });
    expect(second?.line?.id).toBe(first?.line?.id);
  });

  it('sin línea no hay paso de rutina aunque se pida uno', async () => {
    const { id } = await newDraft(unique('Paso huérfano'));
    await updateDetails(admin, id, fixture.brandId, { ...EMPTY_DETAILS, routineStep: 4 });
    expect((await getProductForAdmin(admin, id))?.routineStep).toBeNull();
  });

  it('quitar la línea la deja vacía', async () => {
    const { id } = await newDraft(unique('Sin línea'));
    await updateDetails(admin, id, fixture.brandId, { ...EMPTY_DETAILS, line: { kind: 'existing', id: fixture.lineId }, routineStep: 1 });
    await updateDetails(admin, id, fixture.brandId, EMPTY_DETAILS);
    expect(await getProductForAdmin(admin, id)).toMatchObject({ line: null, routineStep: null });
  });

  it('no toca las preguntas frecuentes que ya tenía el producto', async () => {
    const { id } = await newDraft(unique('Con preguntas'));
    await serviceClient()
      .from('products')
      .update({ faqs: [{ q: '¿Sirve?', a: 'Sí, según el fabricante.' }] })
      .eq('id', id);
    await updateDetails(admin, id, fixture.brandId, { ...EMPTY_DETAILS, summary: 'Nuevo resumen' });
    expect((await getProductForAdmin(admin, id))?.faqs).toEqual([{ question: '¿Sirve?', answer: 'Sí, según el fabricante.' }]);
  });
});

describe('publicar, ocultar, archivar y recuperar', () => {
  async function ready(label: string) {
    const draft = await newDraft(unique(label));
    await updatePriceStock(admin, draft.id, { priceArs: 5000, stock: 2 });
    await setMainImage(admin, { id: draft.id, name: unique(label) }, await photo());
    return draft;
  }

  it('sin foto ni precio no se publica y avisa qué falta', async () => {
    const { id } = await newDraft(unique('Vacío'));
    const error = await publishProduct(admin, id).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublishBlockedError);
    expect((error as PublishBlockedError).blockers).toEqual(['PHOTO', 'PRICE']);
    expect((await getProductForAdmin(admin, id))?.status).toBe(PRODUCT_STATUS.DRAFT);
  });

  it('con precio pero sin foto avisa la foto', async () => {
    const { id } = await newDraft(unique('Sin foto'));
    await updatePriceStock(admin, id, { priceArs: 5000, stock: 1 });
    const error = await publishProduct(admin, id).catch((caught: unknown) => caught);
    expect((error as PublishBlockedError).blockers).toEqual(['PHOTO']);
  });

  it('con foto pero sin precio avisa el precio', async () => {
    const { id } = await newDraft(unique('Sin precio'));
    await setMainImage(admin, { id, name: unique('Sin precio') }, await photo());
    const error = await publishProduct(admin, id).catch((caught: unknown) => caught);
    expect((error as PublishBlockedError).blockers).toEqual(['PRICE']);
  });

  it('publicado se ve en la tienda; oculto, no; y se puede volver a publicar', async () => {
    const { id } = await ready('Ciclo de vida');
    await publishProduct(admin, id);
    expect((await listProducts(anonClient(), { search: fixture.tag })).map((p) => p.id)).toContain(id);

    await hideProduct(admin, id);
    expect((await getProductForAdmin(admin, id))?.status).toBe(PRODUCT_STATUS.DRAFT);
    expect((await listProducts(anonClient(), { search: fixture.tag })).map((p) => p.id)).not.toContain(id);

    await publishProduct(admin, id);
    expect((await getProductForAdmin(admin, id))?.status).toBe(PRODUCT_STATUS.PUBLISHED);
  });

  it('archivar saca el producto de la tienda sin borrarlo, y se puede recuperar como borrador', async () => {
    const { id } = await ready('Archivable');
    await publishProduct(admin, id);
    await archiveProduct(admin, id);
    expect((await getProductForAdmin(admin, id))?.status).toBe(PRODUCT_STATUS.ARCHIVED);
    expect((await listProducts(anonClient(), { search: fixture.tag })).map((p) => p.id)).not.toContain(id);
    expect((await listProductsForAdmin(admin)).map((p) => p.id)).toContain(id);

    await restoreProduct(admin, id);
    expect((await getProductForAdmin(admin, id))?.status).toBe(PRODUCT_STATUS.DRAFT);
  });

  it('el cliente sin permisos no puede publicar', async () => {
    const { id } = await ready('Sin permisos');
    await publishProduct(regular.client, id).catch(() => undefined);
    expect((await getProductForAdmin(admin, id))?.status).toBe(PRODUCT_STATUS.DRAFT);
  });
});

describe('la tienda se entera de los cambios al instante (caché del catálogo)', () => {
  it('publicar, ocultar y cambiar precio o unidades invalidan la caché', async () => {
    const draft = await newDraft(unique('Caché'));
    await updatePriceStock(admin, draft.id, { priceArs: 700, stock: 3 });
    await setMainImage(admin, { id: draft.id, name: unique('Caché') }, await photo());
    const inCatalog = async () => (await getCatalog()).products.find((p) => p.id === draft.id);

    expect(await inCatalog()).toBeUndefined();
    await publishProduct(admin, draft.id);
    expect(await inCatalog()).toMatchObject({ priceArs: 700, stock: 3 });
    await updateQuickPrice(admin, draft.id, 900);
    expect((await inCatalog())?.priceArs).toBe(900);
    await updateQuickStock(admin, draft.id, 1);
    expect((await inCatalog())?.stock).toBe(1);
    await adjustStock(admin, draft.id, 4);
    expect((await inCatalog())?.stock).toBe(5);
    await updateDetails(admin, draft.id, fixture.brandId, { ...EMPTY_DETAILS, summary: 'Resumen nuevo' });
    expect((await inCatalog())?.summary).toBe('Resumen nuevo');
    await updateBasics(admin, draft.id, {
      name: unique('Caché renombrado'),
      brand: { kind: 'existing', id: fixture.brandId },
      category: { kind: 'existing', id: fixture.categoryId },
    });
    expect((await inCatalog())?.name).toBe(`Caché renombrado ${fixture.tag}`);
    await addExtraImage(admin, { id: draft.id, name: unique('Caché renombrado') }, await photo());
    expect((await inCatalog())?.images).toHaveLength(2);
    await hideProduct(admin, draft.id);
    expect(await inCatalog()).toBeUndefined();
    await restoreProduct(admin, draft.id);
    await archiveProduct(admin, draft.id);
    expect(await inCatalog()).toBeUndefined();
  });
});

describe('fotos', () => {
  const publicUrl = (path: string) => serviceClient().storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

  it('la primera foto queda como principal en posición 0, en WebP, con un año de caché', async () => {
    const { id } = await newDraft(unique('Con foto'));
    await setMainImage(admin, { id, name: unique('Con foto') }, await photo(2400, 1600));
    const product = await getProductForAdmin(admin, id);
    expect(product?.images).toHaveLength(1);
    expect(product?.images[0]).toMatchObject({ kind: 'main', position: 0, alt: `Con foto ${fixture.tag}` });

    const response = await fetch(product!.images[0].url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('max-age=31536000');
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 800]);
  });

  it('cada foto se guarda con un nombre único dentro de la carpeta del producto', async () => {
    const { id } = await newDraft(unique('Nombres únicos'));
    const product = { id, name: unique('Nombres únicos') };
    await setMainImage(admin, product, await photo(900, 700, 'IMG_0001.jpg'));
    await addExtraImage(admin, product, await photo(900, 700, 'IMG_0001.jpg'));
    const paths = await storedPaths(id);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(2);
    for (const path of paths) expect(path).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.webp$`));
  });

  it('cambiar la principal reemplaza la foto y borra el archivo anterior', async () => {
    const { id } = await newDraft(unique('Reemplazo'));
    const product = { id, name: unique('Reemplazo') };
    await setMainImage(admin, product, await photo());
    const [before] = await storedPaths(id);
    await setMainImage(admin, product, await photo(1000, 1000));
    const after = await storedPaths(id);
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before);
    expect((await fetch(publicUrl(before))).status).not.toBe(200);
    const stored = await getProductForAdmin(admin, id);
    expect(stored?.images).toHaveLength(1);
    expect(stored?.images[0]).toMatchObject({ kind: 'main', position: 0 });
  });

  it('las fotos extra toman las posiciones libres y respetan el máximo', async () => {
    const { id } = await newDraft(unique('Muchas fotos'));
    const product = { id, name: unique('Muchas fotos') };
    await setMainImage(admin, product, await photo());
    for (let i = 1; i < IMAGE_MAX_PER_PRODUCT; i++) await addExtraImage(admin, product, await photo());
    const stored = await getProductForAdmin(admin, id);
    expect(stored?.images.map((image) => image.position)).toEqual([0, 1, 2, 3, 4]);
    expect(stored?.images.map((image) => image.kind)).toEqual(['main', 'detail', 'detail', 'detail', 'detail']);
    expect(stored?.images[2].alt).toBe(`Muchas fotos ${fixture.tag} (foto 3)`);

    const error = await addExtraImage(admin, product, await photo()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImageError);
    expect((error as ImageError).code).toBe('TOO_MANY');
    expect(await storedPaths(id)).toHaveLength(IMAGE_MAX_PER_PRODUCT);
  });

  it('quitar una foto extra libera su lugar y borra el archivo', async () => {
    const { id } = await newDraft(unique('Quitar extra'));
    const product = { id, name: unique('Quitar extra') };
    await setMainImage(admin, product, await photo());
    await addExtraImage(admin, product, await photo());
    await addExtraImage(admin, product, await photo());
    const before = await getProductForAdmin(admin, id);
    const target = before!.images[1];
    await removeImage(admin, id, target.id);
    const after = await getProductForAdmin(admin, id);
    expect(after?.images.map((image) => image.position)).toEqual([0, 2]);
    expect(await storedPaths(id)).toHaveLength(2);
    expect((await fetch(target.url)).status).not.toBe(200);
    await addExtraImage(admin, product, await photo());
    expect((await getProductForAdmin(admin, id))?.images.map((image) => image.position)).toEqual([0, 1, 2]);
  });

  it('quitar la principal promueve la siguiente foto a principal', async () => {
    const { id } = await newDraft(unique('Quitar principal'));
    const product = { id, name: unique('Quitar principal') };
    await setMainImage(admin, product, await photo());
    await addExtraImage(admin, product, await photo());
    const [main, extra] = (await getProductForAdmin(admin, id))!.images;
    await removeImage(admin, id, main.id);
    const after = await getProductForAdmin(admin, id);
    expect(after?.images).toHaveLength(1);
    expect(after?.images[0]).toMatchObject({ id: extra.id, kind: 'main', position: 0 });
  });

  it('quitar la única foto deja el producto sin fotos', async () => {
    const { id } = await newDraft(unique('Quitar única'));
    await setMainImage(admin, { id, name: unique('Quitar única') }, await photo());
    const [only] = (await getProductForAdmin(admin, id))!.images;
    await removeImage(admin, id, only.id);
    expect((await getProductForAdmin(admin, id))?.images).toEqual([]);
    expect(await storedPaths(id)).toEqual([]);
  });

  it('quitar una foto que no existe falla con error claro', async () => {
    const { id } = await newDraft(unique('Foto fantasma'));
    await expect(removeImage(admin, id, '00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(AdminDataError);
  });

  it('si el archivo ya no estaba en Storage, quitar la foto avisa en lugar de dar todo por bien', async () => {
    const { id } = await newDraft(unique('Archivo perdido'));
    await setMainImage(admin, { id, name: unique('Archivo perdido') }, await photo());
    const [image] = (await getProductForAdmin(admin, id))!.images;
    await serviceClient().storage.from(STORAGE_BUCKET).remove(await storedPaths(id));
    await expect(removeImage(admin, id, image.id)).rejects.toBeInstanceOf(AdminDataError);
    // la foto ya no figura en el producto, aunque el aviso diga que el archivo faltaba
    expect((await getProductForAdmin(admin, id))?.images).toEqual([]);
  });

  it('no se puede quitar una foto de otro producto usando su id', async () => {
    const a = await newDraft(unique('Dueño A'));
    const b = await newDraft(unique('Dueño B'));
    await setMainImage(admin, { id: a.id, name: unique('Dueño A') }, await photo());
    const [image] = (await getProductForAdmin(admin, a.id))!.images;
    await expect(removeImage(admin, b.id, image.id)).rejects.toBeInstanceOf(AdminDataError);
    expect((await getProductForAdmin(admin, a.id))?.images).toHaveLength(1);
  });

  it('un archivo que no es foto no deja nada guardado', async () => {
    const { id } = await newDraft(unique('Archivo malo'));
    const bad = new File([new TextEncoder().encode('no soy una foto')], 'falso.jpg', { type: 'image/jpeg' });
    await expect(setMainImage(admin, { id, name: unique('Archivo malo') }, bad)).rejects.toBeInstanceOf(ImageError);
    await expect(addExtraImage(admin, { id, name: unique('Archivo malo') }, bad)).rejects.toBeInstanceOf(ImageError);
    expect((await getProductForAdmin(admin, id))?.images).toEqual([]);
    expect(await storedPaths(id)).toEqual([]);
  });

  it('sin permisos la subida falla y no queda ni archivo ni fila', async () => {
    const { id } = await newDraft(unique('Subida ajena'));
    await expect(setMainImage(regular.client, { id, name: unique('Subida ajena') }, await photo())).rejects.toBeInstanceOf(AdminDataError);
    expect((await getProductForAdmin(admin, id))?.images).toEqual([]);
    expect(await storedPaths(id)).toEqual([]);
  });

  it('si la fila no se puede guardar, el archivo subido se borra (sin huérfanos)', async () => {
    const { id } = await newDraft(unique('Sin huérfanos'));
    const product = { id, name: unique('Sin huérfanos') };
    await setMainImage(admin, product, await photo());
    // el producto se borra "por debajo": la inserción de la fila falla por la clave foránea
    const ghost = { id: '00000000-0000-4000-8000-000000000001', name: 'Fantasma' };
    await expect(setMainImage(admin, ghost, await photo())).rejects.toBeInstanceOf(AdminDataError);
    expect(await storedPaths(ghost.id)).toEqual([]);
  });
});
