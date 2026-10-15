// Sincronización desatendida (sin abrir el navegador).
//   npm run sync
// Programable con el Programador de tareas de Windows (ver README-SYNC.md).
// Escribe .cache/runnea.json y public/races.json; la app los usa al arrancar.
import fs from 'node:fs';
import path from 'node:path';
import { syncRaces } from '../server/syncRaces.js';

// Carga mínima de .env sin dependencias
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const started = Date.now();
const result = await syncRaces({
  force: true,
  geocodeBudget: 80,
  detailBudget: 500,
  aiBudget: Number(process.env.AI_WEB_BUDGET || 15), // carreras a revisar con Gemini por ejecución
});
const withCoords = result.races.filter((r) => r.lat != null).length;
const withWeb = result.races.filter((r) => r.link).length;

console.log(`[sync] fuente=${result.source} carreras=${result.races.length} con-web-oficial=${withWeb} revisadas-con-IA=${result.aiChecked || 0} con-coordenadas=${withCoords} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
if (result.errors.length) console.warn('[sync] avisos:\n  ' + result.errors.join('\n  '));
process.exit(result.races.length ? 0 : 1);
