# camilacarro-cremas

## Descripción

Tienda online de cremas para **Camila Carro · Estética y cuidado personal** (Gualeguaychú, Entre Ríos). Camila revende varias marcas (Liderma, entre otras). Además de vender, la página tiene que **educar**: línea → pasos de rutina → ficha con ingredientes, beneficios y modo de uso (estilo de la presentación en `referencias/Skin1004-Presentacion.pdf`). El botón **Comprar** no cobra: arma el pedido y abre WhatsApp.

## Contexto

Personal (cliente chico, sin restricciones de cliente). Ver `../CLAUDE.md`.

## Stack usado en este proyecto

- Astro 7 (SSR con `@astrojs/node`) + Tailwind 4. Node 24 (`nvm use`).
- Supabase **local** (CLI + Docker) para desarrollo. Todavía no hay proyecto en la nube.
- Vitest: unitarios + integración contra el Supabase local.
- Hosting: sin definir (por ahora todo corre en local).

## Proyectos relacionados

- `camila-carro-estetica` (app de turnos de la misma clienta): **separada**, no se enlaza ni comparte datos.

## Estado actual

- Tienda pública terminada en local (rama `design/design-taste`): portada de 7 secciones, catálogo con filtros y búsqueda, ficha educativa, `/rutinas`, carrito + pedido por WhatsApp, 404/500 con diseño. Probada en móvil (320 a 768 px) y con auditoría de contraste, títulos, nombres de enlaces y teclado. Tests con pruebas de mutación.
- Accesibilidad: contraste AA en textos y controles, foco visible, diálogo del pedido con fondo inerte y foco devuelto, región en vivo para avisos, `prefers-reduced-motion` respetado.
- Base: esquema + RLS + storage, seed de demo, capa de datos (`src/lib/`), `cart-store.ts`, `cart-controller.ts` (DOM por atributos `data-*`, contrato en `docs/cart-dom-contract.md`), `/api/cart-catalog.json`, `routine.ts`, `filters.ts`.
- Sin hacer todavía: panel `/admin` y publicación.

## Decisiones tomadas

- Solo se vende en Gualeguaychú: entrega **retiro o envío**; pago **efectivo o transferencia** (constantes en `src/lib/constants.ts`).
- Carrito en el navegador (localStorage), validado contra stock; un solo botón "Comprar" manda todo el pedido a WhatsApp (`wa.me`).
- Los productos los carga Camila desde un panel `/admin` (formulario + fotos) sobre Supabase. **Falta construirlo (fase 2).**
- Seguridad: solo la `anon key` en el navegador; la escritura depende de la RLS (`app_metadata.role = 'admin'`, que el usuario no puede editar). La `service_role` solo en `scripts/`.
- Registro público desactivado; el admin se crea con `npm run db:seed` (credenciales en `.env`, `SEED_ADMIN_*`).
- Diseño elegido: la versión B (skill `design-taste-frontend`, rama `design/design-taste`). La A (`frontend-design`) se descarta.
- **Camila se pierde si se le piden muchas cosas**: todo lo que cargue ella (panel `/admin`, datos de producto) debe ser mínimo y super guiado. Pocos campos obligatorios (nombre, marca, categoría, precio, foto), el resto opcional y con ayuda; derivar lo que se pueda; los bloques de la web se ocultan solos si falta el dato.
- Se quitó el apartado de guías «Aprendé con Camila» (menos contenido para mantener). Lo educativo vive en las fichas («Cómo incorporarlo a tu rutina», preguntas frecuentes) y en `/rutinas`.
- Estilo: clínico y profesional, paleta del logo (rosa empolvado ~`#DB9C9C` + blanco).
- Productos de demo: salen de la presentación de SKIN1004 (`referencias/`: textos y fotos de la marca, solo para mostrar el sitio a Camila en local). Precios y stock son inventados. **No publicar ni commitear esas fotos** (`supabase/seed-assets/skin1004/` está en `.gitignore`). Antes de publicar: reemplazar por los productos y fotos de Camila y revisar los claims de cada marca (ANMAT).

## Rendimiento y caché

- El servidor guarda el catálogo (productos publicados, marcas y categorías) en memoria 60 s (`src/lib/catalog-cache.ts`, `ttl-cache.ts`): una sola carga para todo el sitio, renovación en segundo plano y, si Supabase falla, sigue sirviendo lo último que cargó. Búsquedas y filtros se resuelven en memoria (`catalog-filter.ts`), sin consultar la base.
- Un cambio de Camila tarda hasta 60 s en verse. `CATALOG_CACHE_TTL_MS` lo cambia (0 desactiva la caché). El panel de administración tiene que llamar a `invalidateCatalog()` después de guardar para que se vea al instante.
- `/api/cart-catalog.json` va con `Cache-Control` corto y ETag (304 sin cuerpo). Los errores nunca se cachean.
- Pendiente según el hosting: compresión y caché de páginas completas en la CDN. Pendiente con el panel: fotos con nombre con hash y un año de caché.

## Próximos pasos

1. Mergear `design/design-taste` a `main` y descartar la versión A.
2. Panel `/admin` (login + formulario de producto + subida de fotos), **simple y guiado** (ver Decisiones).
3. Cuando se decida publicar: proyecto Supabase en la nube (**verificar el límite de 2 por cuenta**), hosting, cambiar la contraseña del admin, número real de WhatsApp, dominio, SEO/analítica.

## Archivos clave

- `supabase/migrations/20261027000000_catalog.sql`: tablas, RLS, bucket `product-images`.
- `supabase/seed.sql` y `supabase/seed-assets/`: demo. `scripts/seed.ts`: admin + imágenes (solo contra local).
- `src/lib/catalog.ts` (lectura), `cart.ts` (carrito puro), `whatsapp.ts` (mensaje y URL), `constants.ts`.
- `tests/`: `cart`, `whatsapp` (unitarios); `rls`, `catalog` (integración, requieren `npm run db:start`).
- `referencias/`: PDF de estilo. El `.env` es local y está en `.gitignore`.

## Notas / contexto extra

- Número de WhatsApp: placeholder en `PUBLIC_WHATSAPP_NUMBER` (`.env`).
- Imágenes de demo: placeholders generados con ImageMagick; las reales las sube Camila.
- n8n: este proyecto no tiene flujos.
- Supabase local usa los puertos 54321–54324; si se corre otro proyecto Supabase a la vez, cambiar los puertos en `supabase/config.toml`.
