// Mini-backend local montado dentro del servidor de Vite (dev y preview).
// Endpoints:
//   GET  /api/races/sync?force=1      → carreras de runnea (con caché y fallback)
//   POST /api/geocode  {locations:[]} → { [location]: {lat,lon} | null }
//   POST /api/ai/extract {url?, text?, query?, apiKey?, model?} → ficha normalizada
//   POST /api/ai/find-web {race, force?} → web oficial actual (Gemini + Google Search, verificada)
//   POST /api/ai/parse-receipt {text?, file?, candidates} → datos de un comprobante de inscripción
import { syncRaces } from './syncRaces.js';
import { geocodeMany } from './geocode.js';
import { extractRace } from './aiExtract.js';
import { findOfficialWeb } from './webFinder.js';
import { parseReceipt } from './receipt.js';
import { getAiConfig, readSettings, writeSettings, mask } from './settings.js';
import { callAI, providerLabel } from './ai.js';
import { AI_PROVIDERS, guessProvider } from './settings.js';
import { calendarFeed } from './calendarFeed.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 15e6) reject(new Error('Archivo demasiado grande (máx. ~10 MB)'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const AI_ENV = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

export function createMiddleware(env) {
  // las variables de IA del .env, disponibles para todo el servidor
  for (const k of AI_ENV) if (env[k] && !process.env[k]) process.env[k] = env[k];
  let syncInFlight = null;

  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next();
    // CORS: la app móvil (Capacitor) llama desde capacitor://localhost o http://localhost
    res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    const url = new URL(req.url, 'http://localhost');

    try {
      if (url.pathname === '/api/races/sync' && req.method === 'GET') {
        const force = url.searchParams.get('force') === '1';
        // evita dos scrapings simultáneos (StrictMode / varias pestañas)
        syncInFlight ||= syncRaces({ force, env }).finally(() => (syncInFlight = null));
        return sendJson(res, 200, await syncInFlight);
      }

      if (url.pathname === '/api/geocode' && req.method === 'POST') {
        const { locations = [] } = await readBody(req);
        return sendJson(res, 200, await geocodeMany(locations.slice(0, 200), 8));
      }

      if (url.pathname === '/api/ai/extract' && req.method === 'POST') {
        const body = await readBody(req);
        const race = await extractRace({
          url: body.url,
          text: body.text,
          query: body.query,
          apiKey: getAiConfig(env).apiKey,
          model: getAiConfig(env).model,
        });
        return sendJson(res, 200, { race });
      }

      if (url.pathname === '/api/ai/find-web' && req.method === 'POST') {
        const { race, apiKey, model, force } = await readBody(req);
        if (!race?.name) return sendJson(res, 400, { error: 'Falta la carrera' });
        const finding = await findOfficialWeb(race, {
          apiKey: getAiConfig(env).apiKey,
          model: getAiConfig(env).model,
          force: Boolean(force),
        });
        return sendJson(res, 200, { finding });
      }

      if (url.pathname === '/api/ai/parse-receipt' && req.method === 'POST') {
        const body = await readBody(req);
        const receipt = await parseReceipt({
          text: body.text,
          file: body.file,
          candidates: body.candidates,
          apiKey: getAiConfig(env).apiKey,
          model: getAiConfig(env).model,
        });
        return sendJson(res, 200, { receipt });
      }

      if (url.pathname === '/api/health') {
        const ai = getAiConfig(env);
        return sendJson(res, 200, { ok: true, ai: Boolean(ai.apiKey), aiProvider: ai.provider, aiSource: ai.source });
      }

      // Ajustes del asistente IA guardados en el servidor (persisten aunque cambies de navegador)
      const aiInfo = () => {
        const ai = getAiConfig(env);
        return {
          provider: ai.provider,
          providerLabel: providerLabel(ai.provider),
          key: mask(ai.apiKey),
          source: ai.source,
          model: ai.model,
          providers: Object.entries(AI_PROVIDERS).map(([id, p]) => ({ id, label: p.label, keyHint: p.keyHint })),
        };
      };
      if (url.pathname === '/api/settings' && req.method === 'GET') return sendJson(res, 200, aiInfo());
      if (url.pathname === '/api/settings' && req.method === 'POST') {
        const ip = req.socket?.remoteAddress || '';
        if (!/^(::1|127\.|::ffff:127\.)/.test(ip) && !env.ALLOW_REMOTE_SETTINGS) {
          return sendJson(res, 403, { error: 'Los ajustes solo se pueden cambiar desde el propio ordenador.' });
        }
        const body = await readBody(req);
        const patch = {};
        if (body.provider) patch.aiProvider = String(body.provider);
        if (body.apiKey) {
          patch.aiApiKey = String(body.apiKey).trim();
          if (!body.provider) patch.aiProvider = guessProvider(patch.aiApiKey) || undefined;
          patch.geminiApiKey = ''; // la key antigua deja de usarse
        }
        if ('model' in body) patch.aiModel = String(body.model || '').trim();
        writeSettings(patch);
        return sendJson(res, 200, aiInfo());
      }

      // Probar la conexión con la IA configurada (mensaje claro si falla: saldo, key, modelo…)
      if (url.pathname === '/api/ai/test' && req.method === 'POST') {
        const body = await readBody(req);
        const ai = getAiConfig(env);
        const provider = body.provider || (body.apiKey && guessProvider(body.apiKey)) || ai.provider;
        try {
          const { data, model } = await callAI({
            provider,
            apiKey: body.apiKey || ai.apiKey,
            model: body.model || (provider === ai.provider ? ai.model : ''),
            prompt: 'Responde SOLO con este JSON: {"ok":true}',
            schema: { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } } },
          });
          return sendJson(res, 200, { ok: Boolean(data?.ok), model, provider: providerLabel(provider) });
        } catch (e) {
          return sendJson(res, 200, { ok: false, error: e.message });
        }
      }

      // Calendario suscribible (Google/Apple/Outlook): /api/calendar/<token>.ics
      const cal = /^\/api\/calendar\/([0-9a-f-]{20,})\.ics$/i.exec(url.pathname);
      if (cal && req.method === 'GET') {
        const ics = await calendarFeed(cal[1], env);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.end(ics);
      }

      return sendJson(res, 404, { error: 'Endpoint no encontrado' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || String(err) });
    }
  };
}

export default function raceApiPlugin(env = {}) {
  return {
    name: 'race-connect-api',
    configureServer(server) {
      server.middlewares.use(createMiddleware(env));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(env));
    },
  };
}
