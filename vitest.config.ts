import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/support/env.ts'],
    // los tests de integración usan la misma base local: cada archivo crea y borra sus propios datos
    testTimeout: 15_000,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/**/*.test.ts'], exclude: ['tests/**/*-http.test.ts'] },
      },
      {
        extends: true,
        // compilan el sitio una vez y lo levantan en modo producción (ver tests/support/global-build.ts)
        test: { name: 'http', include: ['tests/**/*-http.test.ts'], globalSetup: ['tests/support/global-build.ts'] },
      },
    ],
  },
});
