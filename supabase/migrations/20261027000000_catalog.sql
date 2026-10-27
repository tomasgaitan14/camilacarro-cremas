-- Catálogo de cremas: marcas, categorías, líneas, productos e imágenes.
-- Lectura pública solo de productos publicados; escritura solo del admin (app_metadata.role = 'admin').

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- app_metadata solo se puede escribir con la service_role: un usuario no puede darse el rol a sí mismo.
create function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Línea de una marca (ej. "Línea Calmante"): agrupa productos y ordena la rutina por pasos.
create table public.product_lines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  created_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  brand_id uuid not null references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  line_id uuid references public.product_lines (id) on delete set null,
  -- paso de la rutina dentro de la línea (1 = limpieza, 2 = tratamiento, ...)
  routine_step smallint check (routine_step between 1 and 20),
  summary text not null default '' check (char_length(summary) <= 400),
  price_ars integer not null check (price_ars >= 0),
  volume text not null default '' check (char_length(volume) <= 40),
  key_ingredients text not null default '' check (char_length(key_ingredients) <= 600),
  benefits text[] not null default '{}' check (cardinality(benefits) <= 12),
  usage_steps text[] not null default '{}' check (cardinality(usage_steps) <= 12),
  skin_types text[] not null default '{}' check (cardinality(skin_types) <= 8),
  warnings text not null default '' check (char_length(warnings) <= 600),
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- el paso de rutina solo tiene sentido dentro de una línea
  check (routine_step is null or line_id is not null),
  -- no se publica un producto sin precio
  check (status <> 'published' or price_ars > 0)
);

create index products_status_idx on public.products (status);
create index products_brand_idx on public.products (brand_id);
create index products_category_idx on public.products (category_id);
create index products_line_idx on public.products (line_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- ruta dentro del bucket product-images
  path text not null check (char_length(path) between 1 and 300),
  alt text not null default '' check (char_length(alt) <= 200),
  position smallint not null default 0 check (position >= 0),
  kind text not null default 'detail' check (kind in ('main', 'texture', 'usage', 'detail')),
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

-- una sola imagen principal por producto
create unique index product_images_one_main_idx on public.product_images (product_id) where kind = 'main';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.product_lines enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- Lectura pública de datos de referencia
create policy brands_read on public.brands for select using (true);
create policy categories_read on public.categories for select using (true);
create policy product_lines_read on public.product_lines for select using (true);

create policy brands_admin_write on public.brands for all using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_write on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy product_lines_admin_write on public.product_lines for all using (public.is_admin()) with check (public.is_admin());

-- Productos: el público solo ve los publicados; el admin ve todo
create policy products_read on public.products for select
  using (status = 'published' or public.is_admin());
create policy products_admin_write on public.products for all
  using (public.is_admin()) with check (public.is_admin());

create policy product_images_read on public.product_images for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'published'
    )
  );
create policy product_images_admin_write on public.product_images for all
  using (public.is_admin()) with check (public.is_admin());

-- Permisos de tabla: la RLS decide qué filas; anon nunca escribe.
revoke all on public.brands, public.categories, public.product_lines, public.products, public.product_images from anon, authenticated;
grant select on public.brands, public.categories, public.product_lines, public.products, public.product_images to anon, authenticated;
grant insert, update, delete on public.brands, public.categories, public.product_lines, public.products, public.product_images to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket público de lectura, escritura solo admin
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
