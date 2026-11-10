// functions/api/strava-auth.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=UTF-8',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost({ request, env }) {
  try {
    const { code, clientId, clientSecret } = await request.json();

    const finalClientId = clientId || env.STRAVA_CLIENT_ID;
    const finalClientSecret = clientSecret || env.STRAVA_CLIENT_SECRET;

    if (!code || !finalClientId || !finalClientSecret) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Faltan credenciales de Strava (Client ID / Client Secret) o el código OAuth.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Intercambiar el code de OAuth por el access_token real de Strava
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: finalClientId,
        client_secret: finalClientSecret,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(
        JSON.stringify({ ok: false, error: tokenData.message || 'Error al validar con Strava OAuth' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Guardar el token en Cloudflare D1 si está vinculado
    if (env.DB && tokenData.athlete) {
      await env.DB.prepare(`
        INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, datetime('now'))
        ON CONFLICT(athlete_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          expires_at = excluded.expires_at,
          updated_at = datetime('now')
      `)
        .bind(
          String(tokenData.athlete.id),
          tokenData.access_token,
          tokenData.refresh_token,
          Number(tokenData.expires_at)
        )
        .run();
    }

    // 3. Descargar las últimas 15 actividades reales del atleta desde Strava
    const actRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=15', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const rawActivities = actRes.ok ? await actRes.json() : [];

    const activities = Array.isArray(rawActivities)
      ? rawActivities.map((a) => {
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
            heartRate: a.average_heartrate ? Math.round(a.average_heartrate) : null
          };
        })
      : [];

    return new Response(
      JSON.stringify({
        ok: true,
        athlete: {
          id: tokenData.athlete.id,
          username: tokenData.athlete.username || `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
          firstname: tokenData.athlete.firstname,
          lastname: tokenData.athlete.lastname,
          avatar: tokenData.athlete.profile
        },
        activities
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}