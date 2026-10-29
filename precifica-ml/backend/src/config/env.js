import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(srcRoot, '..');

dotenv.config({ path: path.resolve(backendRoot, '.env') });

export default {
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Relativo a backend/src: o padrão grava em backend/src/data/db.json
  dataFile: path.resolve(srcRoot, process.env.DATA_FILE || './data/db.json'),
  serveFrontend: (process.env.SERVE_FRONTEND || 'true') === 'true',
  frontendDir: path.resolve(backendRoot, '../frontend'),
};
