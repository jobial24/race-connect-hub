// Capa única de IA: el resto del servidor llama a callAI() y da igual si debajo
// hay Gemini, OpenAI o Claude. Todos admiten búsqueda web (para encontrar webs
// oficiales y carreras) y archivos (capturas/PDF de comprobantes).
import { callGemini } from './gemini.js';
import { getAiConfig, AI_PROVIDERS } from './settings.js';

const DEFAULT_MODELS = {
  gemini: 'gemini-flash-latest',
  openai: 'gpt-5-mini',
  anthropic: 'claude-haiku-4-5',
};

export const providerLabel = (p) => AI_PROVIDERS[p]?.label || p;

function parseJsonLoose(raw) {
  const clean = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('La IA no devolvió un JSON válido.');
  }
}

function friendlyError(provider, status, msg) {
  const name = providerLabel(provider);
  if (status === 401 || status === 403) return `${name}: la API key no es válida o no tiene permiso.`;
  if (status === 402 || /credit|billing|quota|insufficient/i.test(msg)) return `${name}: la cuenta no tiene saldo o se ha agotado la cuota. Revisa la facturación del proveedor.`;
  if (status === 429) return `${name}: demasiadas peticiones; prueba en unos minutos.`;
  if (status === 404) return `${name}: el modelo no existe o no está disponible para tu cuenta. Cambia el modelo en Asistente IA.`;
  return `${name}: ${msg}`;
}

const schemaHint = (schema) =>
  schema ? `\n\nResponde SOLO con un objeto JSON con estos campos: ${Object.keys(schema.properties || {}).join(', ')}.` : '';

// ---------- OpenAI (Responses API) ----------
async function callOpenAI({ apiKey, model, prompt, schema, search, files = [] }) {
  const content = [
    ...files.map((f) =>
      /^image\//.test(f.mimeType)
        ? { type: 'input_image', image_url: `data:${f.mimeType};base64,${f.data}` }
        : { type: 'input_file', filename: 'comprobante.pdf', file_data: `data:${f.mimeType};base64,${f.data}` }
    ),
    { type: 'input_text', text: prompt + schemaHint(schema) },
  ];
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content }],
      ...(search ? { tools: [{ type: 'web_search' }] } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(friendlyError('openai', res.status, json?.error?.message || `HTTP ${res.status}`));
    e.code = res.status;
    throw e;
  }
  const text =
    json.output_text ||
    (json.output || [])
      .flatMap((o) => o.content || [])
      .map((c) => c.text || '')
      .join('');
  const sources = (json.output || [])
    .flatMap((o) => o.content || [])
    .flatMap((c) => c.annotations || [])
    .filter((a) => a.url)
    .map((a) => ({ title: a.title || '', uri: a.url }));
  return { data: parseJsonLoose(text), sources, model };
}

// ---------- Anthropic (Messages API) ----------
async function callAnthropic({ apiKey, model, prompt, schema, search, files = [] }) {
  const content = [
    ...files.map((f) =>
      /^image\//.test(f.mimeType)
        ? { type: 'image', source: { type: 'base64', media_type: f.mimeType, data: f.data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
    ),
    { type: 'text', text: prompt + schemaHint(schema) },
  ];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
      ...(search ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(friendlyError('anthropic', res.status, json?.error?.message || `HTTP ${res.status}`));
    e.code = res.status;
    throw e;
  }
  const blocks = json.content || [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const sources = blocks
    .filter((b) => b.type === 'web_search_tool_result')
    .flatMap((b) => (Array.isArray(b.content) ? b.content : []))
    .filter((r) => r.url)
    .map((r) => ({ title: r.title || '', uri: r.url }));
  return { data: parseJsonLoose(text), sources, model };
}

/**
 * @param {{prompt:string, schema?:object, search?:boolean, files?:{mimeType,data}[], provider?, apiKey?, model?}} opts
 */
export async function callAI(opts) {
  const cfg = getAiConfig();
  const provider = opts.provider || cfg.provider || 'gemini';
  const apiKey = opts.apiKey || cfg.apiKey;
  if (!apiKey) throw new Error('Falta la API key de IA. Añádela en Admin → Asistente IA.');
  const model = opts.model || cfg.model || DEFAULT_MODELS[provider];

  if (provider === 'openai') return callOpenAI({ ...opts, apiKey, model });
  if (provider === 'anthropic') return callAnthropic({ ...opts, apiKey, model });
  return callGemini({ ...opts, apiKey, model });
}

export { DEFAULT_MODELS };
