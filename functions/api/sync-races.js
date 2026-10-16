// Cloudflare Pages Function: POST /api/sync-races
// Solo administradores (is_admin = true en la tabla profiles) pueden lanzar la
// sincronización. Lanza el workflow "sync-races.yml" de GitHub con un token guardado
// como secreto en Cloudflare (GITHUB_PAT), que nunca llega al navegador.

const SUPABASE_URL = 'https://wfvxndczesgmfansgzym.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-nm3FHGbqlDzVCFcGn4gyw_O8RDQmOP';
const REPO = 'jobial24/race-connect-hub';
const WORKFLOW = 'sync-races.yml';
const BRANCH = 'main';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Inicia sesión para continuar.' }, 401);

  // 1) ¿Quién es el usuario?
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return json({ error: 'La sesión ha caducado. Vuelve a entrar.' }, 401);
  const user = await meRes.json();

  // 2) ¿Es administrador? (la política RLS deja leer tu propio perfil)
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=is_admin&id=eq.${user.id}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  const rows = profRes.ok ? await profRes.json() : [];
  if (!rows[0]?.is_admin) return json({ error: 'Solo los administradores pueden sincronizar.' }, 403);

  if (!env.GITHUB_PAT) return json({ error: 'Falta configurar GITHUB_PAT en Cloudflare.' }, 500);

  // 3) Lanzar el workflow
  const ghRes = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'race-connect-hub',
    },
    body: JSON.stringify({ ref: BRANCH }),
  });
  if (!ghRes.ok) return json({ error: `GitHub respondió ${ghRes.status}. Revisa el token GITHUB_PAT.` }, 502);

  return json({ ok: true });
}
