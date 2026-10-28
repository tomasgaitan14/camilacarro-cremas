import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Hosts en los que se sirve el sitio. Sin esta lista Astro ignora el header Host y arma la URL como
// http://localhost:PUERTO: rechazaría con 403 los formularios del panel y armaría mal el retorno de Google.
// Local siempre; el dominio real se suma con ALLOWED_HOSTS (separado por comas) al compilar.
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
const allowedHosts = [...LOCAL_HOSTS, ...(process.env.ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim()).filter(Boolean)];

// SSR: en local el catálogo se lee en vivo, así lo que Camila carga desde /admin se ve al instante.
// La forma de publicar (servidor o estático con rebuild) se decide junto con el hosting.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',
  security: { allowedDomains: allowedHosts.map((hostname) => ({ hostname })) },
  vite: {
    plugins: [tailwindcss()],
  },
});
