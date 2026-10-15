// Cliente mínimo de la API de Gemini (Google AI Studio).
// `search: true` activa la búsqueda en Google ("grounding") para que el modelo
// consulte la web actual en lugar de su memoria.

// Alias que Google mantiene siempre apuntando al Flash vigente (los modelos con
// versión, como gemini-2.5-flash, se retiran para cuentas nuevas).
export const DEFAULT_MODEL = 'gemini-flash-latest';
export const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

function parseJsonLoose(raw) {
  const clean = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // con búsqueda activada el modelo a veces añade texto alrededor del JSON
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('La IA no devolvió un JSON válido.');
  }
}

/**
 * @returns {{ data: object, sources: {title:string, uri:string}[], model: string }}
 */
export async function callGemini(opts) {
  try {
    return await callGeminiOnce(opts);
  } catch (e) {
    // modelo retirado / inexistente → reintentar con el alias vigente
    if (e.code === 404 && !FALLBACK_MODELS.includes(opts.model || '')) {
      return callGeminiOnce({ ...opts, model: DEFAULT_MODEL });
    }
    throw e;
  }
}

async function callGeminiOnce({ apiKey, model, prompt, schema, search = false, files = [] }) {
  if (!apiKey) {
    throw new Error('Falta la API key de Gemini. Añade GEMINI_API_KEY en el archivo .env o pégala en Ajustes de IA.');
  }
  const modelName = model || process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const generationConfig = { temperature: 0.1 };
  // La salida JSON estructurada no se puede combinar con la herramienta de búsqueda:
  // en ese caso se pide el JSON en el prompt y se parsea a mano.
  if (schema && !search) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          // imágenes / PDF (p. ej. captura del comprobante de inscripción)
          ...files.map((f) => ({ inline_data: { mime_type: f.mimeType, data: f.data } })),
          { text: prompt },
        ],
      },
    ],
    generationConfig,
    ...(search ? { tools: [{ google_search: {} }] } : {}),
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    let text = `Gemini (${modelName}): ${msg}`;
    if (res.status === 402 || /prepayment|credits are depleted|billing/i.test(msg)) {
      text =
        'Gemini: tu proyecto de Google AI Studio no tiene saldo (créditos de prepago agotados). ' +
        'Recárgalo en https://aistudio.google.com/projects o crea una API key en un proyecto SIN facturación para usar la capa gratuita.';
    } else if (res.status === 429) {
      text = `Gemini: has llegado al límite de peticiones gratuitas por ahora. Prueba en unos minutos. (${msg})`;
    } else if (res.status === 401 || res.status === 403) {
      text = `Gemini: la API key no es válida o no tiene permiso (${msg}). Revisa la key en Ajustes de IA.`;
    } else if (res.status === 404) {
      text = `Gemini: el modelo "${modelName}" no está disponible para tu cuenta.`;
    }
    const err = new Error(text);
    err.code = res.status;
    throw err;
  }

  const cand = json?.candidates?.[0];
  const raw = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!raw) throw new Error('Gemini no devolvió respuesta.');

  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ title: w.title || '', uri: w.uri || '' }));

  return { data: parseJsonLoose(raw), sources, model: modelName };
}
