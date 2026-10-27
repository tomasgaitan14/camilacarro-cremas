import { resolve } from 'node:path';

// Los tests leen el mismo .env que la app (Supabase local); no hay valores de prueba aparte.
// Se arma la ruta con dirname (y no con new URL) porque en el entorno jsdom `URL` es la de jsdom.
process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
