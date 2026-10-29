import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import net from 'node:net';
import { resolve } from 'node:path';
import { cleanEnv } from './global-build.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const SERVER_ENTRY = resolve(ROOT, 'dist/server/entry.mjs');
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

function omitUndefined(env: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

// Levanta en modo producción, en un puerto libre, el sitio que compiló el globalSetup (ver global-build.ts).
// extraEnv: variables del servidor para esa corrida (undefined la quita). Por defecto el panel va encendido.
export async function startSite(extraEnv: Record<string, string | undefined> = {}): Promise<{ origin: string; stop: () => Promise<void> }> {
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error('Falta dist/server/entry.mjs: los tests HTTP se corren con vitest (proyecto "http"), que compila antes de empezar');
  }
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    env: omitUndefined({ ...cleanEnv(), ADMIN_ENABLED: 'true', SITE_NOINDEX: undefined, ...extraEnv, HOST: '127.0.0.1', PORT: String(port) }),
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
