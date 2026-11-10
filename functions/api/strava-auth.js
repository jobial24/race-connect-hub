// functions/api/strava-auth.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=UTF-8',
};

// Tu Client ID público por defecto (283188)
const DEFAULT_STRAVA_CLIENT_ID = '283188';

function formatActivities(rawActivities) {
  if (!Array.isArray(rawActivities)) return [];
  return rawActivities.map((a) => {
    const distKm = Number((a.distance / 1000).toFixed(2));
    const mins = Math.floor(a.moving_time / 60);
    const secs = String(a.moving_time % 60).padStart(2, '0');
    const paceSeconds = distKm > 0 ? Math.round(a.moving_time / distKm) : 0;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = String(paceSeconds % 60).padStart(2, '0');

    return {
      id: String(a.id),
      name: a.name,
      date: (a.start_date_local || '').slice(0, 10),
      type: a.sport_type || a.type || 'Run',
      distanceKm: distKm,
      movingTime: `${mins}:${secs}`,
      pace: distKm > 0 ? `${paceMin}:${paceSec} /km` : '--',
      elevation: Math.round(a.total_elevation_gain || 0),
    };
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/strava-auth?userId=xxx -> Carga las actividades de Strava de ESE usuario concreto
export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Falta binding DB' }), { status: 500, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: 'Falta userId' }), { status: 400, headers: corsHeaders });
  }

  const user = await env.DB.prepare(
    `SELECT strava_athlete_id, strava_username, strava_avatar, strava_access_token, strava_refresh_token, strava_expires_at FROM users WHERE id = ?1`
  ).bind(userId).first();

  if (!user || !user.strava_access_token) {
    return new Response(JSON.stringify({ ok: true, connected: false, activities: [] }), { status: 200, headers: corsHeaders });
  }

  let accessToken = user.strava_access_token;
  const nowSec = Math.floor(Date.now() / 1000);

  // Si el token del usuario ha caducado y tenemos STRAVA_CLIENT_SECRET en Cloudflare, lo refresca solo
  if (user.strava_expires_at && nowSec >= user.strava_expires_at && env.STRAVA_CLIENT_SECRET) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID || DEFAULT_STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: user.strava_refresh_token,
      }),
    });
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      accessToken = refreshData.access_token;
      await env.DB.prepare(
        `UPDATE users SET strava_access_token = ?1, strava_refresh_token = ?2, strava_expires_at = ?3 WHERE id = ?4`
      ).bind(refreshData.access_token, refreshData.refresh_token, refreshData.expires_at, userId).run();
    }
  }

  const actRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=15', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const raw = actRes.ok ? await actRes.json() : [];

  return new Response(
    JSON.stringify({
      ok: true,
      connected: true,
      athlete: {
        id: user.strava_athlete_id,
        username: user.strava_username,
        avatar: user.strava_avatar,
      },
      activities: formatActivities(raw),
    }),
    { status: 200, headers: corsHeaders }
  );
}

// POST /api/strava-auth -> Vincula el OAuth de Strava al userId que inició sesión
export async function onRequestPost({ request, env }) {
  try {
    const { code, userId, clientSecret } = await request.json();
    const finalClientId = env.STRAVA_CLIENT_ID || DEFAULT_STRAVA_CLIENT_ID;
    const finalClientSecret = env.STRAVA_CLIENT_SECRET || clientSecret;

    if (!code || !userId || !finalClientSecret) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Falta configurar STRAVA_CLIENT_SECRET en las variables de entorno de Cloudflare Pages.',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: finalClientId,
        client_secret: finalClientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(
        JSON.stringify({ ok: false, error: tokenData.message || 'Error en OAuth de Strava' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const athleteName =
      tokenData.athlete.username ||
      `${tokenData.athlete.firstname || ''} ${tokenData.athlete.lastname || ''}`.trim();

    if (env.DB) {
      await env.DB.prepare(`
        UPDATE users SET
          strava_athlete_id = ?1,
          strava_username = ?2,
          strava_avatar = ?3,
          strava_access_token = ?4,
          strava_refresh_token = ?5,
          strava_expires_at = ?6
        WHERE id = ?7
      `)
        .bind(
          String(tokenData.athlete.id),
          athleteName,
          tokenData.athlete.profile || '',
          tokenData.access_token,
          tokenData.refresh_token,
          Number(tokenData.expires_at),
          userId
        )
        .run();
    }

    const actRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=15', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const rawActivities = actRes.ok ? await actRes.json() : [];

    return new Response(
      JSON.stringify({
        ok: true,
        athlete: {
          id: String(tokenData.athlete.id),
          username: athleteName,
          avatar: tokenData.athlete.profile || '',
        },
        activities: formatActivities(rawActivities),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/strava-auth?userId=xxx -> Desvincula el Strava de ese usuario
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (env.DB && userId) {
    await env.DB.prepare(`
      UPDATE users SET
        strava_athlete_id = NULL,
        strava_username = NULL,
        strava_avatar = NULL,
        strava_access_token = NULL,
        strava_refresh_token = NULL,
        strava_expires_at = NULL
      WHERE id = ?1
    `).bind(userId).run();
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
}