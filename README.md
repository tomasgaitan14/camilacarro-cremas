# camilacarro-cremas

Tienda de cremas de Camila Carro Estética. El botón **Comprar** arma el pedido y abre WhatsApp.

## Requisitos

- Node 24 (`nvm use`)
- Docker (para Supabase local)

## Puesta en marcha (local)

```bash
nvm use
npm install
cp .env.example .env        # completar con `npx supabase status -o env` después del paso siguiente
npm run db:start            # levanta Supabase local, aplica migraciones y supabase/seed.sql
npm run db:seed             # crea el usuario admin y sube las imágenes de demo
npm run dev                 # http://localhost:4321
```

## Tests

Requieren `npm run db:start` (los de integración usan la RLS real del Supabase local).

```bash
npm test
```

## Base de datos

- `npm run db:reset`: recrea la base desde las migraciones y el seed (después, `npm run db:seed`).
- `npm run db:stop`: baja Supabase local.
- Studio: http://127.0.0.1:54323

## Variables de entorno

Ver `.env.example`. Las `PUBLIC_*` terminan en el navegador; la `SUPABASE_SERVICE_ROLE_KEY` nunca.
