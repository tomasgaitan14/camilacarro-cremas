/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_WHATSAPP_NUMBER: string;
  // solo servidor; en milisegundos. 0 desactiva la caché del catálogo
  readonly CATALOG_CACHE_TTL_MS?: string;
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
