import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/support/env.ts'],
    // los tests de integración usan la misma base local: cada archivo crea y borra sus propios datos
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
