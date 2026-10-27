import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// SSR: en local el catálogo se lee en vivo, así lo que Camila carga desde /admin se ve al instante.
// La forma de publicar (servidor o estático con rebuild) se decide junto con el hosting.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',
  vite: {
    plugins: [tailwindcss()],
  },
});
