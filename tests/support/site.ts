import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
// Vitest deja estas variables en process.env y Vite las usa para inlinar import.meta.env: heredadas, la compilación
// sale en modo desarrollo (PROD vacío) y las cookies saldrían sin Secure aunque el código esté bien.
const VITEST_ENV_KEYS = ['PROD', 'DEV', 'MODE', 'SSR', 'BASE_URL', 'NODE_ENV', 'VITEST', 'VITEST_MODE', 'VITEST_POOL_ID', 'VITEST_WORKER_ID', 'TEST'];
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 200;

async function freePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as net.AddressInfo;
  server.close();
  await once(server, 'close');
  return port;
}

async function waitUntilReady(origin: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El servidor del sitio se cerró antes de estar listo (código ${child.exitCode})`);
    try {
      const response = await fetch(`${origin}/api/cart-catalog.json`);
      if (response.status === 200) return;
    } catch {
      // todavía no escucha
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, POLL_INTERVAL_MS));
  }
  throw new Error('El servidor del sitio no respondió a tiempo');
}

// Compila el sitio y lo levanta en modo producción en un puerto libre, para probar el middleware y los endpoints reales
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of VITEST_ENV_KEYS) delete env[key];
  return env;
}

export async function startSite(): Promise<{ origin: string; stop: () => Promise<void> }> {
  const build = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { cwd: ROOT, encoding: 'utf8', env: cleanEnv() });
  if (build.status !== 0) throw new Error(`Falló la compilación del sitio:\n${build.stdout}\n${build.stderr}`);

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: ROOT,
    env: { ...cleanEnv(), HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
  await waitUntilReady(origin, child);
  return {
    origin,
    stop: async () => {
      child.kill();
      if (child.exitCode === null) await once(child, 'exit');
    },
  };
}
