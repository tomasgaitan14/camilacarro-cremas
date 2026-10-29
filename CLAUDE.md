# camilacarro-cremas

## Descripción

Tienda online de cremas para **Camila Carro · Estética y cuidado personal** (Gualeguaychú, Entre Ríos). Camila revende varias marcas (Liderma, entre otras). Además de vender, la página tiene que **educar**: línea → pasos de rutina → ficha con ingredientes, beneficios y modo de uso (estilo de la presentación en `referencias/Skin1004-Presentacion.pdf`). El botón **Comprar** no cobra: arma el pedido y abre WhatsApp.

## Contexto

Personal (cliente chico, sin restricciones de cliente). Ver `../CLAUDE.md`.

## Stack usado en este proyecto

- Astro 7 (SSR con `@astrojs/node`) + Tailwind 4. Node 24 (`nvm use`).
- Supabase **local** (CLI + Docker) para desarrollo y los tests. En la nube hay un proyecto de **demo** (ver «Demo en línea»).
- Vitest 5 con dos proyectos: `unit` (unitarios + integración contra el Supabase local) y `http` (compilan el sitio una sola vez en un `globalSetup` y lo levantan en modo producción).
- Hosting del demo: Vercel (adaptador `@astrojs/vercel`, que `astro.config.ts` usa solo cuando existe `VERCEL`; en local y en los tests, `@astrojs/node`). El hosting definitivo sigue sin definir.

## Proyectos relacionados

- `camila-carro-estetica` (app de turnos de la misma clienta): **separada**, no se enlaza ni comparte datos.

## Estado actual

- Tienda pública terminada en local (rama `design/design-taste`): portada de 7 secciones, catálogo con filtros y búsqueda, ficha educativa, `/rutinas`, carrito + pedido por WhatsApp, 404/500 con diseño. Probada en móvil (320 a 768 px) y con auditoría de contraste, títulos, nombres de enlaces y teclado. Tests con pruebas de mutación.
- Accesibilidad: contraste AA en textos y controles, foco visible, diálogo del pedido con fondo inerte y foco devuelto, región en vivo para avisos, `prefers-reduced-motion` respetado.
- Base: esquema + RLS + storage, seed de demo, capa de datos (`src/lib/`), `cart-store.ts`, `cart-controller.ts` (DOM por atributos `data-*`, contrato en `docs/cart-dom-contract.md`), `/api/cart-catalog.json`, `routine.ts`, `filters.ts`.
- Panel `/admin` hecho en local (rama `feat/admin-panel`): login solo con Google, inicio con tres acciones, asistente de producto en 5 pasos (cada paso queda guardado como borrador), lista de precio y unidades (los botones − / + solo cambian el número en pantalla, sin recargar; recién «Guardar» guarda precio y unidades juntos), ocultar o mostrar, eliminar (archiva) y recuperar. Tests de integración y de HTTP sobre el sitio compilado, con pruebas de mutación.
- Sin hacer todavía: publicación (hosting, Supabase en la nube, dominio).

## Decisiones tomadas

- Solo se vende en Gualeguaychú: entrega **retiro o envío**; pago **efectivo o transferencia** (constantes en `src/lib/constants.ts`).
- Carrito en el navegador (localStorage), validado contra stock; un solo botón "Comprar" manda todo el pedido a WhatsApp (`wa.me`).
- Los productos los carga Camila desde el panel `/admin` sobre Supabase.
- Seguridad: solo la `anon key` en el navegador; la escritura depende de la RLS (`app_metadata.role = 'admin'`, que el usuario no puede editar). La `service_role` solo en `scripts/`.
- **Login del panel: solo Google (OAuth)**, para que Camila entre con su correo. Registro desactivado (`enable_signup = false`): entran solo las cuentas que crea `npm run admins:create` con los emails de `ADMIN_EMAILS` (`.env`, no va al repo). Verificado con un ingreso real: Supabase deja entrar por Google a una cuenta ya creada aunque el registro esté apagado. El login con contraseña del admin de `db:seed` es solo para desarrollo local y los tests: **apagarlo en producción**.
- Sesión por cookie en el servidor (`@supabase/ssr`): httpOnly, SameSite=Lax, Secure en producción. El middleware (`src/middleware.ts`) revisa cada pedido a `/admin/*` contra Supabase (`getUser()`), relee el rol en cada pedido y marca las respuestas del panel `no-store` y `noindex`.
- Cada paso del asistente guarda con un POST dentro de su propia página `/admin/...` (sin Astro actions: viven en `/_actions/*`, fuera del middleware). El CSRF lo cubre `security.checkOrigin` de Astro.
- Astro **ignora el header `Host` si no hay `security.allowedDomains`**: arma la URL como `http://localhost:PUERTO` y rechaza con 403 los formularios. `astro.config.ts` permite `localhost` y `127.0.0.1`; el dominio real va en `ALLOWED_HOSTS` (se lee al compilar). **Cargarlo al publicar.**
- Orden del asistente: qué producto es (nombre, marca, tipo) → foto → precio y unidades → detalles opcionales → revisar y publicar. La foto no va primero porque el borrador necesita marca y categoría para existir. Obligatorios para publicar: foto y precio. Las preguntas frecuentes no se editan desde el panel (las existentes no se tocan).
- Marcas, tipos y líneas se crean al vuelo («+ Agregar nueva…»); si el slug ya existe se reutiliza. Renombrarlas queda fuera de esta versión.
- La dirección (slug) de un producto no cambia al renombrarlo. «Eliminar» archiva (recuperable); «Ocultar» lo deja como borrador. Al cambiar la marca de un producto se le quita la línea (pertenece a otra marca).
- Fotos: se reducen a 1200 px y pasan a WebP con `sharp` (orientación corregida, sin metadatos ni GPS), nombre único por archivo y `Cache-Control` de un año, máximo 5 por producto. El admin necesita una política de **lectura** en `storage.objects` para poder borrar archivos: sin ella Storage responde bien y no borra nada (migración `20261029000000`).
- Diseño elegido: la versión B (skill `design-taste-frontend`, rama `design/design-taste`). La A (`frontend-design`) se descarta.
- **Camila se pierde si se le piden muchas cosas**: todo lo que cargue ella (panel `/admin`, datos de producto) debe ser mínimo y super guiado. Pocos campos obligatorios (nombre, marca, categoría, precio, foto), el resto opcional y con ayuda; derivar lo que se pueda; los bloques de la web se ocultan solos si falta el dato.
- Se quitó el apartado de guías «Aprendé con Camila» (menos contenido para mantener). Lo educativo vive en las fichas («Cómo incorporarlo a tu rutina», preguntas frecuentes) y en `/rutinas`.
- Estilo: clínico y profesional, paleta del logo (rosa empolvado ~`#DB9C9C` + blanco).
- Productos de demo: salen de la presentación de SKIN1004 (`referencias/`: textos y fotos de la marca, solo para mostrar el sitio a Camila en local). Precios y stock son inventados. **No publicar ni commitear esas fotos** (`supabase/seed-assets/skin1004/` está en `.gitignore`). Antes de publicar: reemplazar por los productos y fotos de Camila y revisar los claims de cada marca (ANMAT).

## Demo en línea (28/10/2026)

- URL: **https://camilacarro-cremas.vercel.app**. Solo la tienda, para que Camila la vea: `/admin` apagado (404) y todo lleva `noindex`. Sin dominio propio todavía. Los IDs de cuentas, proyectos y comandos de deploy están en `~/projects-claude/personal/camilacarro-cremas-privado/` (fuera de git: el repo es público).
- Datos: un proyecto Supabase en la nube (São Paulo, plan free) con las migraciones y el `seed.sql`. Las 8 fotos de demo (SKIN1004, de terceros) están subidas al bucket: **retirarlas antes de publicar de verdad**. No hay usuarios: el admin temporal que se usó para subir las fotos se borró.
- Variables en Vercel (solo Production): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (clave pública), `PUBLIC_WHATSAPP_NUMBER`, `SITE_NOINDEX=true`, `ALLOWED_HOSTS`. Nunca cargar la `service_role` en Vercel. Las `PUBLIC_*` se fijan al compilar: cambiarlas exige un deploy nuevo.
- Interruptores de servidor (`src/lib/site-flags.ts`, leídos en cada pedido): `ADMIN_ENABLED=true` enciende `/admin` (apagado por defecto; en local y en los tests va en true) y `SITE_NOINDEX=true` agrega `x-robots-tag: noindex, nofollow`. En producción se leen solo de `process.env`, nunca de `import.meta.env` (Astro lo fija al compilar y un `.env` presente en ese momento dejaría el panel encendido).
- Deploy: cada push a `main` deploya solo (Vercel conectado al repo). `.vercelignore` deja afuera `.env*`, `supabase/` (incluye las fotos de terceros), `scripts/`, `tests/` y `docs/` en los deploys por CLI; con el deploy desde git alcanza con el `.gitignore`.
- La función corre en São Paulo (`gru1`, ver `vercel.json`), cerca de la base.
- El catálogo se refresca solo en 60 s.

## Rendimiento y caché

- El servidor guarda el catálogo (productos publicados, marcas y categorías) en memoria 60 s (`src/lib/catalog-cache.ts`, `ttl-cache.ts`): una sola carga para todo el sitio, renovación en segundo plano y, si Supabase falla, sigue sirviendo lo último que cargó. Búsquedas y filtros se resuelven en memoria (`catalog-filter.ts`), sin consultar la base.
- Un cambio de Camila tarda hasta 60 s en verse. `CATALOG_CACHE_TTL_MS` lo cambia (0 desactiva la caché). El panel de administración tiene que llamar a `invalidateCatalog()` después de guardar para que se vea al instante.
- `/api/cart-catalog.json` va con `Cache-Control` corto y ETag (304 sin cuerpo). Los errores nunca se cachean.
- Pendiente según el hosting: compresión y caché de páginas completas en la CDN. Las fotos del panel ya llevan nombre único y un año de caché.
- La caché es por proceso: `invalidateCatalog()` solo avisa al proceso que escribe. Con varias instancias del servidor, las demás se enteran al vencer el TTL (60 s).

## Próximos pasos

1. Ya hay un demo en Vercel. Cuando se decida publicar de verdad: proyecto Supabase en la nube (**verificar el límite de 2 por cuenta**), hosting, `ALLOWED_HOSTS`, cliente OAuth de Google para producción (el actual es el local), pasar la app de Google a «Producción», apagar el login con contraseña, número real de WhatsApp, dominio, SEO/analítica.
2. Cargar los productos reales de Camila (fotos, textos, revisión de claims ANMAT) y reemplazar los de demo.

## Archivos clave

- `supabase/migrations/20261027000000_catalog.sql`: tablas, RLS, bucket `product-images`.
- `supabase/seed.sql` y `supabase/seed-assets/`: demo. `scripts/seed.ts`: admin + imágenes (solo contra local).
- `src/lib/catalog.ts` (lectura), `cart.ts` (carrito puro), `whatsapp.ts` (mensaje y URL), `constants.ts`.
- Panel: `admin-auth.ts` (reglas de acceso, puras), `supabase-server.ts` (sesión por cookie), `src/middleware.ts`, `admin-product-input.ts` (validación de formularios), `admin-products.ts` / `admin-product-images.ts` / `admin-reference.ts` (escritura), `image-processing.ts` (sharp), `admin-wizard.ts` (pasos), `admin-notices.ts`, `admin-page.ts`. Páginas en `src/pages/admin/`, componentes de formulario en `src/components/admin/`, layouts `AdminLayout` y `WizardLayout`.
- `tests/`: `cart`, `whatsapp`, `slug`, `image-processing`, `admin-*` (unitarios); `rls`, `catalog`, `admin-products`, `admin-session` (integración, requieren `npm run db:start`); `admin-http` y `admin-panel-http` compilan el sitio y lo levantan en un puerto libre (`tests/support/site.ts`).
- `referencias/`: PDF de estilo. El `.env` es local y está en `.gitignore`.

## Notas / contexto extra

- Número de WhatsApp: placeholder en `PUBLIC_WHATSAPP_NUMBER` (`.env`).
- Imágenes de demo: placeholders generados con ImageMagick; las reales las sube Camila.
- n8n: este proyecto no tiene flujos.
- Google login local: credenciales en `supabase/.env` (ignorado por git; ver `supabase/.env.example`), URI de redirección `http://127.0.0.1:54321/auth/v1/callback`. La app de Google está en «Prueba»: solo entran los usuarios de prueba cargados en Google Cloud.
- Los tests HTTP compilan una sola vez en el `globalSetup` (`tests/support/global-build.ts`): Vitest deja `PROD=''` en `process.env` y la compilación lo hereda (cookies sin `Secure`), así que se limpian esas variables. Varios archivos compilando a la vez pisan `dist/` y los tests se vuelven inestables.
- Supabase local usa los puertos 54321–54324; si se corre otro proyecto Supabase a la vez, cambiar los puertos en `supabase/config.toml`.
