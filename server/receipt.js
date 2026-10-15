// Lee un comprobante de inscripción (email pegado, captura o PDF) con Gemini y
// devuelve los datos útiles para "Mis inscripciones". No se guardan datos
// personales sensibles (DNI, fecha de nacimiento, dirección…).
import { callAI as callGemini } from './ai.js';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    raceName: { type: 'STRING' },
    date: { type: 'STRING', description: 'YYYY-MM-DD o ""' },
    location: { type: 'STRING' },
    distance: { type: 'STRING', description: 'Modalidad/distancia inscrita, ej. "10K", "Media maratón"' },
    bib: { type: 'STRING', description: 'Dorsal si aparece' },
    price: { type: 'NUMBER', nullable: true, description: 'Importe pagado en euros' },
    confirmationCode: { type: 'STRING', description: 'Código / localizador / nº de inscripción' },
    startTime: { type: 'STRING', description: 'Hora de salida HH:MM si aparece' },
    pickup: { type: 'STRING', description: 'Recogida de dorsal: lugar y horario, una frase' },
    platform: { type: 'STRING', description: 'Plataforma de inscripción (xipgroc, rockthesport…)' },
    matchedRaceId: { type: 'STRING', description: 'id del catálogo que corresponde, o ""' },
  },
  required: ['raceName'],
};

export async function parseReceipt({ text, file, candidates = [], apiKey, model }) {
  if (!text?.trim() && !file?.data) throw new Error('Pega el texto del email o adjunta una captura/PDF del comprobante.');
  const catalog = candidates
    .slice(0, 300)
    .map((c) => `${c.id} | ${c.name} | ${c.date} | ${c.location || ''}`)
    .join('\n');

  const prompt = `Eres un asistente que lee comprobantes de inscripción a carreras populares (emails de confirmación, justificantes de pago, capturas).
Extrae SOLO los datos de la inscripción. NO incluyas datos personales sensibles (DNI, fecha de nacimiento, dirección, teléfono, email).
- "date" en formato YYYY-MM-DD.
- "matchedRaceId": elige el id del CATÁLOGO que sea la misma carrera (mismo evento y fecha cercana). Si ninguna encaja, "".

CATÁLOGO (id | nombre | fecha | lugar):
${catalog || '(vacío)'}

${text?.trim() ? `COMPROBANTE:\n${text.trim().slice(0, 12000)}` : 'El comprobante va adjunto como archivo.'}`;

  const { data, model: used } = await callGemini({
    apiKey,
    model,
    prompt,
    schema: SCHEMA,
    files: file?.data ? [file] : [],
  });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) data.date = '';
  if (data.matchedRaceId && !candidates.some((c) => c.id === data.matchedRaceId)) data.matchedRaceId = '';
  if (data.startTime && !/^\d{1,2}:\d{2}$/.test(data.startTime)) data.startTime = '';
  return { ...data, model: used };
}
