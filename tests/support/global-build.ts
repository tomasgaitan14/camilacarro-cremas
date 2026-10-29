import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

// Vitest deja estas variables en process.env y Vite las usa para inlinar import.meta.env: heredadas, la compilación
// sale en modo desarrollo (PROD vacío) y las cookies saldrían sin Secure aunque el código esté bien.
const VITEST_ENV_KEYS = ['PROD', 'DEV', 'MODE', 'SSR', 'BASE_URL', 'NODE_ENV', 'VITEST', 'VITEST_MODE', 'VITEST_POOL_ID', 'VITEST_WORKER_ID', 'TEST'];

export function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of VITEST_ENV_KEYS) delete env[key];
  return env;
}

// Una sola compilación para todos los archivos HTTP: si cada uno compilara por su cuenta pisarían la misma carpeta dist/
// mientras otro servidor ya la está usando. Los interruptores (panel, noindex) se leen al arrancar, no al compilar.
export function setup(): void {
  const build = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { cwd: ROOT, encoding: 'utf8', env: cleanEnv() });
  if (build.status !== 0) throw new Error(`Falló la compilación del sitio:\n${build.stdout}\n${build.stderr}`);
}
