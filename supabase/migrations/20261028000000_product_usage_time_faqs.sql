-- Ficha educativa: momento de uso y preguntas frecuentes. Ambos son opcionales:
-- la web solo muestra el bloque cuando hay un dato verificado, y nunca lo inventa.

alter table public.products
  -- null = sin dato verificado (se muestra "según las indicaciones del fabricante" o nada)
  add column usage_time text check (usage_time in ('morning', 'night', 'both')),
  -- lista de { "q": "...", "a": "..." }; la forma de cada ítem se valida al leer (src/lib/faqs.ts)
  add column faqs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 10);
