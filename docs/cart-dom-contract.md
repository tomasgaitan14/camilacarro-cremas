# Contrato HTML del carrito

`src/lib/cart-controller.ts` conecta el carrito con el HTML mediante atributos `data-*`. No pone estilos ni estructura:
cada versión de diseño escribe su propio marcado y lo estiliza como quiera. Se arranca con
`bootCart()` (`src/lib/cart-boot.ts`) desde un `<script>` del layout.

El catálogo para el carrito (precio, stock, imagen y número de WhatsApp) se pide a `/api/cart-catalog.json`.
El carrito guarda solo `productId` y cantidad en `localStorage`; precios y stock siempre salen del catálogo actual.

## Panel

| Atributo | Dónde | Qué hace |
|---|---|---|
| `data-cart-root` | contenedor del panel y el fondo | recibe `data-open="true" \| "false"` (estilizar con `[data-open=true]`) |
| `data-cart-panel` | el panel | queda `inert` mientras está cerrado |
| `data-cart-overlay` | el fondo oscuro, **hermano** del panel (no ancestro) | un clic directo cierra |
| `data-cart-open` | botón(es) que abren | guarda el foco para devolverlo al cerrar |
| `data-cart-close` | botón(es) que cierran | recibe el foco al abrir. Escape también cierra |

Mientras el panel está abierto, `<html>` lleva `data-cart-locked="true"` (por ejemplo para bloquear el scroll).

## Estados y contenido

- `[data-cart-count]`: número de unidades. Lleva `data-empty="true|false"`.
- `[data-cart-when="empty|loading|error|ready"]`: se muestran (`hidden` se quita) solo en el estado actual.
  - `empty`: no hay productos. `loading`: hay productos guardados y el catálogo aún no llegó.
  - `error`: el catálogo no cargó. `ready`: se puede editar y enviar.
- `[data-cart-retry]`: reintenta cargar el catálogo (dentro de la vista `error`).
- `[data-cart-items]` + `<template data-cart-item-template>`: la plantilla tiene un único elemento raíz con
  `data-cart-item`. Dentro se rellenan los `[data-slot]`: `name`, `brand`, `quantity`, `unitPrice`, `subtotal` y
  `image` (un `<img>`: queda `hidden` si no hay imagen válida). Los botones `[data-cart-inc]`, `[data-cart-dec]` y
  `[data-cart-remove]` actúan sobre su ítem. `[data-cart-inc]` se deshabilita al llegar al máximo.
- `[data-cart-total]`: total formateado.
- `[data-cart-clear]`: vacía el pedido.
- `[data-cart-toast]`: aviso breve de un error de acción (por ejemplo, pedir más que el stock) para mostrarlo fuera del panel; se borra solo a los 5 s y al siguiente éxito.
- `[data-cart-error]`: mensaje de error (`hidden` cuando no hay). `[data-cart-status]`: `aria-live` con confirmaciones.

## Opciones y envío

- Radios `name="cart-delivery"` (`pickup` | `delivery`) y `name="cart-payment"` (`transfer` | `cash`).
  Sin radio marcado se usa retiro y transferencia.
- `a[data-cart-checkout]`: el controlador le pone el `href` de `wa.me` con el pedido. Sin productos listos queda
  con `aria-disabled="true"` y no navega. Conviene `target="_blank" rel="noopener"`.

## Agregar productos

- `[data-add-to-cart][data-product-id="<id>"]`: agrega. Mientras confirma lleva `data-state="added"` (1,6 s).
- `input[data-qty-for="<id>"]` (opcional): cantidad a agregar; si no existe, 1. Solo enteros de 1 en adelante.
