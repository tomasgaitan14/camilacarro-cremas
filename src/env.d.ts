/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_WHATSAPP_NUMBER: string;
  // solo servidor; en milisegundos. 0 desactiva la caché del catálogo
  readonly CATALOG_CACHE_TTL_MS?: string;
  // solo servidor; «true» enciende el panel /admin (apagado por defecto)
  readonly ADMIN_ENABLED?: string;
  // solo servidor; «true» pide a los buscadores que no indexen el sitio (demo)
  readonly SITE_NOINDEX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  // Los completa el middleware solo en las páginas del panel y solo cuando entró un admin
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient;
    adminUser: import('@supabase/supabase-js').User;
  }
}
