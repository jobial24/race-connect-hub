// Ajustes persistentes del servidor (no se pierden al cambiar de navegador):
// el proveedor de IA y su API key se guardan desde Admin → Asistente IA en
// .cache/settings.json (ignorado por git). El .env sigue teniendo prioridad.
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), '.cache', 'settings.json');

export const AI_PROVIDERS = {
  gemini: { label: 'Google Gemini', envKey: 'GEMINI_API_KEY', keyHint: 'AIza… / AQ.…' },
  openai: { label: 'OpenAI (ChatGPT)', envKey: 'OPENAI_API_KEY', keyHint: 'sk-…' },
  anthropic: { label: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', keyHint: 'sk-ant-…' },
};

export function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null) delete next[k];
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

/** Detecta el proveedor por el formato de la key (por si el usuario no lo elige). */
export function guessProvider(key = '') {
  if (/^sk-ant-/.test(key)) return 'anthropic';
  if (/^sk-/.test(key)) return 'openai';
  if (/^(AIza|AQ\.)/.test(key)) return 'gemini';
  return '';
}

/**
 * Proveedor, key y modelo efectivos.
 * Prioridad: .env (AI_PROVIDER + su key) > ajustes guardados > key de Gemini antigua.
 */
export function getAiConfig(env = process.env) {
  const s = readSettings();
  // 1) .env
  const envProvider =
    env.AI_PROVIDER ||
    (env.AI_API_KEY && guessProvider(env.AI_API_KEY)) ||
    Object.keys(AI_PROVIDERS).find((p) => env[AI_PROVIDERS[p].envKey]);
  if (envProvider) {
    const key = env.AI_API_KEY || env[AI_PROVIDERS[envProvider]?.envKey] || '';
    if (key) return { provider: envProvider, apiKey: key, model: env.AI_MODEL || (envProvider === 'gemini' ? env.GEMINI_MODEL : '') || '', source: 'env' };
  }
  // 2) guardado desde Admin
  if (s.aiApiKey) {
    return { provider: s.aiProvider || guessProvider(s.aiApiKey) || 'gemini', apiKey: s.aiApiKey, model: s.aiModel || '', source: 'settings' };
  }
  // 3) compatibilidad: versiones anteriores solo guardaban Gemini
  if (s.geminiApiKey) return { provider: 'gemini', apiKey: s.geminiApiKey, model: s.geminiModel || '', source: 'settings' };
  return { provider: s.aiProvider || 'gemini', apiKey: '', model: s.aiModel || '', source: '' };
}

export const mask = (k = '') => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : '');
