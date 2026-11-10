// functions/api/auth.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=UTF-8',
};

const ADMINS = ['joel.botana@gmail.com', 'jobial24'];

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function ensureAuthTables(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        strava_athlete_id TEXT,
        strava_username TEXT,
        strava_avatar TEXT,
        strava_access_token TEXT,
        strava_refresh_token TEXT,
        strava_expires_at INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_registrations (
        user_id TEXT NOT NULL,
        race_id TEXT NOT NULL,
        bib_number TEXT DEFAULT 'S/D',
        target_time TEXT DEFAULT '--:--',
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, race_id)
      )
    `)
  ]);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Falta binding DB' }), { status: 500, headers: corsHeaders });
  }
  await ensureAuthTables(env.DB);
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: 'Falta userId' }), { status: 400, headers: corsHeaders });
  }

  const { results } = await env.DB.prepare(
    `SELECT race_id as raceId, bib_number as bib, target_time as targetTime FROM user_registrations WHERE user_id = ?1`
  ).bind(userId).all();

  return new Response(JSON.stringify({ ok: true, registrations: results || [] }), { status: 200, headers: corsHeaders });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Binding DB no configurado en Cloudflare' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    await ensureAuthTables(env.DB);
    const body = await request.json();
    const { action } = body;

    if (action === 'toggle_race') {
      const { userId, raceId, bib, targetTime } = body;
      const existing = await env.DB.prepare(
        `SELECT 1 FROM user_registrations WHERE user_id = ?1 AND race_id = ?2`
      ).bind(userId, raceId).first();

      if (existing) {
        await env.DB.prepare(
          `DELETE FROM user_registrations WHERE user_id = ?1 AND race_id = ?2`
        ).bind(userId, raceId).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO user_registrations (user_id, race_id, bib_number, target_time) VALUES (?1, ?2, ?3, ?4)`
        ).bind(userId, raceId, bib || 'S/D', targetTime || '--:--').run();
      }

      const { results } = await env.DB.prepare(
        `SELECT race_id as raceId, bib_number as bib, target_time as targetTime FROM user_registrations WHERE user_id = ?1`
      ).bind(userId).all();

      return new Response(JSON.stringify({ ok: true, registrations: results || [] }), { status: 200, headers: corsHeaders });
    }

    const cleanEmail = (body.email || '').toLowerCase().trim();
    const cleanUser = (body.username || cleanEmail.split('@')[0]).trim();
    const passHash = await hashPassword(body.password || '');
    const role = (ADMINS.includes(cleanEmail) || ADMINS.includes(cleanUser.toLowerCase())) ? 'admin' : 'user';

    if (action === 'register') {
      const exists = await env.DB.prepare(`SELECT id FROM users WHERE email = ?1`).bind(cleanEmail).first();
      if (exists) {
        return new Response(JSON.stringify({ ok: false, error: 'Este email ya está registrado. Pulsa en "Ya tengo cuenta".' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO users (id, username, email, password_hash, role) VALUES (?1, ?2, ?3, ?4, ?5)`
      ).bind(id, cleanUser, cleanEmail, passHash, role).run();

      return new Response(
        JSON.stringify({
          ok: true,
          user: { id, username: cleanUser, email: cleanEmail, role, stravaConnected: false }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const user = await env.DB.prepare(
      `SELECT id, username, email, password_hash, role, strava_athlete_id, strava_username, strava_avatar FROM users WHERE email = ?1`
    ).bind(cleanEmail).first();

    if (!user || user.password_hash !== passHash) {
      return new Response(JSON.stringify({ ok: false, error: 'Email o contraseña incorrectos.' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: ADMINS.includes(user.email) ? 'admin' : user.role,
          stravaConnected: Boolean(user.strava_athlete_id),
          stravaAthlete: user.strava_athlete_id
            ? { id: user.strava_athlete_id, username: user.strava_username, avatar: user.strava_avatar }
            : null
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}