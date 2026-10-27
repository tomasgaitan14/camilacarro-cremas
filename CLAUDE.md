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

- Fase 1 hecha: esquema + RLS + storage, seed de demo, capa de datos (`src/lib/`), carrito puro, link de WhatsApp, 229 tests (mutation-checked).
- Base compartida del front: `cart-store.ts` (persistencia), `cart-controller.ts` (DOM por atributos `data-*`, contrato en `docs/cart-dom-contract.md`), `/api/cart-catalog.json`, `routine.ts`, `filters.ts`.
- `src/pages/index.astro` es una página de prueba sin diseño; las dos versiones de diseño la reemplazan.

## Decisiones tomadas

- Solo se vende en Gualeguaychú: entrega **retiro o envío**; pago **efectivo o transferencia** (constantes en `src/lib/constants.ts`).
- Carrito en el navegador (localStorage), validado contra stock; un solo botón "Comprar" manda todo el pedido a WhatsApp (`wa.me`).
- Los productos los carga Camila desde un panel `/admin` (formulario + fotos) sobre Supabase. **Falta construirlo (fase 2).**
- Seguridad: solo la `anon key` en el navegador; la escritura depende de la RLS (`app_metadata.role = 'admin'`, que el usuario no puede editar). La `service_role` solo en `scripts/`.
- Registro público desactivado; el admin se crea con `npm run db:seed` (credenciales en `.env`, `SEED_ADMIN_*`).
- Dos versiones de diseño en paralelo, cada una en su rama/worktree, sobre la misma base: una con la skill `frontend-design` y otra con `design-taste-frontend`. Tipografía: la que elija cada skill (no la del logo). Tom elige cuál queda.
- Estilo: clínico y profesional, paleta del logo (rosa empolvado ~`#DB9C9C` + blanco).
- Producto: marcas y textos de demo genéricos; no se atribuyen beneficios inventados a marcas reales.

## Próximos pasos

1. Dos versiones de diseño de la tienda (home, listado con filtros, ficha educativa, carrito).
2. Panel `/admin` (login + formulario de producto + subida de fotos).
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
