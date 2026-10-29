# Sistema de diseño y receta para un cliente nuevo

Referencia del estilo de la tienda de Camila Carro (versión B, hecha con la skill `design-taste-frontend`), para repetirlo con otra marca cambiando solo el branding. Todo lo de acá está implementado en este repo: los nombres de archivo son reales.

> Este documento no lleva datos de cuentas ni de clientes: el repo es público.

## 1. Cuándo usarlo

Un cliente nuevo pide «una página como la de Camila». El camino es:

1. Clonar este repo como base (ver §10).
2. Cambiar el branding (§3 a §5) y los textos (§10).
3. Dejar sin tocar la estructura, el movimiento, la accesibilidad y el panel (§6 a §9).

## 2. La sensación en una frase

Premium, natural y contemporáneo, no frío ni clínico en exceso. Base cálida, **un solo color de acento** de saturación baja, superficies muy redondeadas, sombras difusas teñidas, mucho aire y movimiento sutil. Nada de aspecto de marketplace ni de ecommerce genérico.

Dials de la skill con los que se hizo: variación de diseño 8 (asimétrico), movimiento 6 (en el panel de administración, más calmo), densidad 4 (con aire).

Evitar siempre: filas de 3 tarjetas iguales, héroes centrados, negro puro, blanco puro como fondo de página, colores saturados, degradados en texto, emojis en la interfaz, fotos de stock, la fuente Inter.

## 3. Tokens (todo sale de `src/styles/global.css`, bloque `@theme`)

| Token | Valor actual | Para qué sirve |
|-------|--------------|----------------|
| `canvas` | `#fbf8f3` | fondo de la página (marfil cálido) |
| `surface` | `#ffffff` | tarjetas y campos |
| `ink` | `#2a2326` | texto (nunca negro puro) |
| `muted` | `#6b6064` | texto secundario |
| `rose` | `#b4566b` | **el** acento: botones principales, foco, enlaces. Lo bastante oscuro para llevar texto blanco |
| `rose-deep` | `#96445a` | hover del acento y textos de acento sobre fondo claro |
| `blush` | `#f6e4e4` | superficies suaves del acento, estados «agregado» y avisos |
| `brand` | `#db9c9c` | el rosa del logo: detalles, subrayados, selección de texto |
| `edge` | `#eee5dd` | bordes y separadores |
| `control` | `#948780` | borde de campos: 3:1 contra el fondo (WCAG 1.4.11) |

- **Tipografías:** Outfit (títulos, `font-display`) y Geist (texto), ambas variables por `@fontsource-variable`. Títulos con `tracking-tighter` y `leading` ajustado; escalas habituales `text-3xl sm:text-4xl` para secciones y `text-[2.5rem] sm:text-5xl lg:text-6xl` para el título del héroe (sin gritar).
- **Sombras:** `--shadow-diffuse` (tarjetas) y `--shadow-glass` (vidrio). Siempre teñidas con el tono de la base, nunca `rgb(0 0 0 / …)`.
- **Radios:** tarjetas `2.5rem`; paneles flotantes `2.25rem`; elementos chicos `rounded-full` o `rounded-3xl`.
- **Íconos:** Phosphor, peso `light`, un solo grosor, importados como SVG en línea desde `src/components/Icon.astro` (solo los que se usan).

## 4. Piezas reutilizables

Clases en `src/styles/global.css` (capa `components`):

- `.tile`: tarjeta blanca de borde fino, `2.5rem`, sombra difusa.
- `.glass`: vidrio con desenfoque, borde interior claro y sombra con brillo en el borde superior.
- `.btn` + `.btn-solid` (acento) / `.btn-ghost` (secundario) / `.btn-sm`. Alto mínimo 3rem (2.5rem en `-sm`), pulsación con leve escala.
- `.chip`: filtros y etiquetas (`a.chip` mide al menos 2.5rem de alto).
- `.field` y `.field-area`: campos con borde `control`; `aria-invalid` los pasa a borde de acento oscuro.
- `.shimmer`, `.breathe`, `.float-slow`, `.reveal`, `.step-cycle`: movimiento (ver §6).
- `.island` y `[data-cart-*]`: el pedido como isla inferior que se abre en panel.

Componentes (`src/components/`): `Header` (pastilla de vidrio fija), `Footer`, `ProductTile`, `FichaSection` (bloques de la ficha), `RoutineRail` y `RoutineSchedule` (rutinas), `ConsultButton` y `ConsultCta` (consulta por WhatsApp), `CartIsland` (pedido), `Icon`.

## 5. Composición de las páginas

- **Contenedor:** `max-w-[1280px]` con `px-5 sm:px-8`; secciones con `py-20`.
- **Héroe asimétrico** (`src/pages/index.astro`): rejilla de 12 columnas, texto a la izquierda (≈6) y una imagen grande a la derecha con una tarjeta de vidrio flotante superpuesta. Una etiqueta de vidrio arriba con un punto que «respira». Altura `min-h-[min(88dvh,54rem)]` (nunca `h-screen`).
- **Bento:** rejillas de 12 columnas con anchos y proporciones desiguales (`lg:col-span-7/5`, `4/4/4`; fotos `aspect-[4/5]` y `aspect-square` alternadas). Títulos y textos **debajo** de las imágenes. En móvil todo cae a una columna.
- **Ficha de producto:** foto grande a la izquierda (7 columnas) y datos fijos con `lg:sticky` a la derecha (5); bloques educativos plegables debajo (cómo usarlo, beneficios, ingredientes, preguntas frecuentes, posición en la rutina).
- **Catálogo:** filtros con chips, búsqueda, y los mismos tiles en ritmo desigual.
- **Pedido:** isla flotante abajo que se expande en panel; diálogo modal con el fondo `inert`, foco atrapado y devuelto, aviso en región en vivo. El botón «Comprar» no cobra: arma el mensaje y abre WhatsApp.
- **404 y 500** con el mismo estilo.

## 6. Movimiento

- Solo `transform` y `opacity`; curva `cubic-bezier(0.16, 1, 0.3, 1)`.
- Entrada escalonada con `.reveal` y la variable `--i` (`animation-delay: calc(var(--i) * 90ms + 60ms)`).
- Perpetuo y suave: punto que respira, tarjeta del héroe que flota (7 s) y, en la ficha, un resaltado que recorre los pasos de uso de a uno (`.step-cycle`).
- **Todo** va dentro de `@media (prefers-reduced-motion: no-preference)`. Sin eso, no hay animación.
- En el panel de administración el movimiento es mínimo: lo que importa es leer y tocar bien.

## 7. Mobile y accesibilidad (medidos, no supuestos)

- Probar siempre de 320 a 768 px: sin desbordes, objetivos táctiles de **40 a 44 px** como mínimo, campos con **letra de 16 px** (si no, iOS hace zoom).
- Contraste AA: 4,5:1 en textos, 3:1 en bordes y controles. El acento tiene que llevar texto blanco con 4,5:1 o más.
- Foco visible: contorno de 2 px del acento con separación.
- Un `h1` por página, sin saltos de nivel; enlaces con nombres distintos (no «ver más» repetido).
- Diálogos con fondo `inert`; avisos en una región en vivo **fuera** de lo que se vuelve inerte.
- Truco para ver el ancho de celular con Claude in Chrome: un HTML temporal con `<iframe width="375">` servido por el mismo servidor (la ventana maximizada no se achica con `resize_window`). Borrarlo al terminar.

## 8. Rendimiento

- Fuentes: solo el subconjunto latino, precargado en `Layout.astro`.
- Catálogo en memoria del servidor 60 s (`catalog-cache.ts`), filtros y búsqueda en memoria, `ETag` y `Cache-Control` cortos en la API del carrito. Detalle en el `CLAUDE.md`.
- Fotos del panel: WebP de hasta 1200 px, nombre único y un año de caché.

## 9. Voz y contenido

- Español rioplatense con voseo («Aprendé», «Elegí»), frases cortas, sin jerga.
- **No inventar** precios, stock, claims ni testimonios. Lo que viene del fabricante se dice «según el fabricante». El contenido de demo va marcado como demo.
- Sin emojis en la interfaz (los íconos son Phosphor).

### Panel de administración (el cliente se pierde con muchos pedidos)

- Un asistente de **5 pasos**, una cosa por pantalla, cada paso guardado como borrador: qué producto es → foto → precio y unidades → detalles opcionales → revisar y publicar.
- Solo lo imprescindible es obligatorio (foto y precio para publicar); lo demás es opcional y, si falta, **no se muestra** en la web.
- Datos derivados en vez de preguntados (por ejemplo, la dirección de la ficha sale del nombre).
- Marca, tipo y línea se crean al vuelo («+ Agregar nueva…»).
- «Eliminar» archiva y se puede recuperar; «Ocultar» deja el producto como borrador.
- Precio y unidades: los botones − y + solo cambian el número; **Guardar** manda todo junto, avisa si hay cambios sin guardar y confirma «Guardado» en la misma fila.
- Etiqueta arriba, ayuda debajo, error debajo del campo, mensajes simples (nunca códigos de error).
- Piezas en `src/components/admin/` (`TextField`, `AreaField`, `ChoiceField`, `CheckChips`, `FieldShell`, `ProductRow`, `AdminNotice`) y layouts `AdminLayout` y `WizardLayout`.

## 10. Receta para un cliente nuevo

### 10.1 Arrancar

1. Crear el repo nuevo a partir de este (idealmente, activar «Template repository» en GitHub y usar «Use this template»).
2. Verificar la cuenta antes de crear nada (GitHub, Vercel, Supabase) y **el límite de 2 proyectos por cuenta de Supabase**.
3. Crear la carpeta privada `<proyecto>-privado/` fuera de git con IDs de cuentas y bitácora.

### 10.2 Branding

1. **Logo:** reemplazar `public/brand/logo-camila-carro.webp` (y `STORE.logoUrl`). Se usa en el header, el footer y el ícono de la pestaña.
2. **Paleta:** editar los valores de `@theme` en `global.css` y el `theme-color` de `Layout.astro` (es el único color escrito fuera del CSS; lo demás sale de los tokens). Reglas: un solo acento de saturación baja, base cálida o neutra, texto que nunca sea negro puro, y el acento con texto blanco al menos 4,5:1. **Revisar contrastes** después de cambiar.
3. **Tipografías:** cambiar los paquetes `@fontsource-variable/*`, los `@import` de `global.css`, las dos variables `--font-*` y los `?url` de precarga en `Layout.astro`. Mantener la regla: sans moderna para títulos y texto; nada de Inter ni serif en el panel.
4. **Nombres de tokens:** `rose`, `rose-deep`, `blush` y `brand` están nombrados por el color. Si la marca nueva es azul, quedan engañosos. Hay unas 180 apariciones en 27 archivos: conviene renombrarlos de una vez a `accent`, `accent-deep`, `soft` y `mark` (buscar y reemplazar, y correr los tests).

### 10.3 Textos y datos de la marca

- `src/lib/site.ts`: `STORE` (nombre, lema, ciudad, Instagram, logo), `NAV_ITEMS` y `ROUTINE_SCHEDULE`.
- `src/layouts/Layout.astro`: descripción por defecto.
- `src/pages/index.astro`: héroe, secciones, pasos de «Cómo comprar» y cierre.
- `src/components/Footer.astro`, `src/pages/404.astro`, `src/pages/500.astro`.
- `src/lib/consult.ts` y `src/lib/whatsapp.ts`: mensajes prearmados (hoy dicen «Hola Camila»), y los datos de entrega y pago en `src/lib/constants.ts`.
- `PUBLIC_WHATSAPP_NUMBER` (solo dígitos, con código de país).

### 10.4 Qué es de cosmética y qué es genérico

El esquema (`supabase/migrations/`) tiene campos pensados para cuidado de la piel. Para otro rubro, decidir qué se queda:

- **Genérico, se queda:** marcas, categorías, productos (nombre, precio, stock, estado), fotos, carrito, pedido por WhatsApp, panel, caché.
- **De cosmética:** líneas y pasos de rutina (`product_lines`, `routine_step`, `/rutinas`, `RoutineRail`, `RoutineSchedule`), `skin_types`, `usage_time`, ingredientes. Se quitan (con sus tests) o se renombran al rubro nuevo.
- **Datos de demo:** nunca usar fotos o textos de una marca de terceros en algo público. Hacer un seed propio con fotos del cliente o de relleno.

### 10.5 Infraestructura

Seguir el `CLAUDE.md` del proyecto («Demo en línea») y `personal/CLAUDE.md`:

- Supabase en la nube (región São Paulo), migraciones y seed.
- Vercel: adaptador `@astrojs/vercel` ya configurado (se usa solo si existe `VERCEL`), `vercel.json` con región `gru1`, `.vercelignore`.
- Variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_WHATSAPP_NUMBER`, `ALLOWED_HOSTS` (el dominio real: si falta, Astro rechaza los formularios del panel), `SITE_NOINDEX=true` mientras haya contenido de prueba, `ADMIN_ENABLED=true` solo cuando el login esté listo.
- Panel: cliente OAuth de Google de producción, Supabase con solo Google activo y el registro cerrado, cuentas creadas con `npm run admins:create`. Nunca la `service_role` en Vercel ni en el navegador.

### 10.6 Verificar antes de mostrarlo

1. `npm test` completo (con `nvm use` y Supabase local arriba), `tsc --noEmit` y `astro build`.
2. Pruebas de mutación de lo que se cambió (meter el bug a propósito y ver que un test falle).
3. Recorrido en Chrome de 320 a 1280 px, contraste y foco.
4. Revisar la lista de seguridad antes de publicar (acceso sin sesión, claves en el navegador, escritura, datos personales, repo público).

## 11. Trampas que ya nos pasaron

- Un color llamado `base` chocaba con `text-base` de Tailwind: no nombrar tokens como utilidades existentes (se llama `canvas`).
- Una utilidad `inline-flex` en el mismo elemento que una regla de ocultar anulaba el ocultar: poner el `display` en un elemento interno.
- Astro fija `import.meta.env` al compilar: los interruptores de servidor se leen de `process.env`.
- Astro ignora el header `Host` sin `security.allowedDomains`: los formularios dan 403.
- Storage necesita una política de **lectura** para poder borrar archivos.
- Varios archivos de tests compilando a la vez sobre `dist/` los vuelven inestables: se compila una vez en el `globalSetup`.
