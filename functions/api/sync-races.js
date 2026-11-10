// functions/api/sync-races.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Email, X-Admin-User',
  'Content-Type': 'application/json;charset=UTF-8',
};

const ADMIN_ACCOUNTS = ['joel.botana@gmail.com', 'jobial24'];

function verifyAdminAccess(request, env, body = {}) {
  const authHeader = request.headers.get('Authorization') || '';
  const headerEmail = (request.headers.get('X-Admin-Email') || '').toLowerCase().trim();
  const headerUser = (request.headers.get('X-Admin-User') || '').toLowerCase().trim();
  const bodyAdmin = (body.adminEmail || body.adminUser || '').toLowerCase().trim();

  const isJoelAdmin =
    ADMIN_ACCOUNTS.includes(headerEmail) ||
    ADMIN_ACCOUNTS.includes(headerUser) ||
    ADMIN_ACCOUNTS.includes(bodyAdmin);

  const hasValidSecret = env.SYNC_SECRET && authHeader === `Bearer ${env.SYNC_SECRET}`;

  return {
    isAuthorized: isJoelAdmin || hasValidSecret,
    isAdminUser: isJoelAdmin || hasValidSecret,
    adminIdentifier: headerEmail || headerUser || bodyAdmin || 'user'
  };
}

// Solo carreras futuras verificadas (cuando tú pulsas "Importar Catálogo Oficial")
function getOfficialUpcomingCatalog() {
  return [
    {
      id: 'jean-bouin-2026',
      name: '103ª Allianz Jean Bouin Barcelona',
      date: '2026-11-29',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 10,
      elevation_m: 140,
      price_eur: 19,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.jeanbouin.mundodeportivo.com',
      image_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
      source: 'official-catalog'
    },
    {
      id: 'nassos-bcn-2026',
      name: 'Cursa dels Nassos Barcelona',
      date: '2026-12-31',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 10,
      elevation_m: 45,
      price_eur: 18,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.cursadenassos.barcelona',
      image_url: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?auto=format&fit=crop&w=800&q=80',
      source: 'official-catalog'
    },
    {
      id: 'mitja-terrassa-2027',
      name: 'Mitja Marató Internacional de Terrassa',
      date: '2027-01-24',
      location: 'Terrassa, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.097,
      elevation_m: 260,
      price_eur: 24,
      status: 'Inscripciones Abiertas',
      website_url: 'https://mitjaterrassa.org',
      image_url: 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80',
      source: 'official-catalog'
    },
    {
      id: 'mitja-barcelona-2027',
      name: 'eDreams Mitja Marató Barcelona by Brooks',
      date: '2027-02-14',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.097,
      elevation_m: 85,
      price_eur: 36,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.edreamsmitjabarcelona.com',
      image_url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
      source: 'official-catalog'
    }
  ];
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/sync-races -> Solo lee lo que hay en D1 (sin reinsertar lo que hayas borrado)
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Binding D1 (env.DB) no encontrado.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const url = new URL(request.url);
    const queryUser = (url.searchParams.get('user') || url.searchParams.get('email') || '').toLowerCase().trim();
    const authInfo = verifyAdminAccess(request, env, { adminEmail: queryUser });

    const { results: races } = await env.DB.prepare(
      `SELECT * FROM races ORDER BY date ASC`
    ).all();

    const lastSync = await env.DB.prepare(
      `SELECT run_at, races_upserted, status, details FROM sync_logs ORDER BY id DESC LIMIT 1`
    ).first();

    return new Response(
      JSON.stringify({
        ok: true,
        isAdmin: authInfo.isAdminUser,
        count: races.length,
        lastSync: lastSync || null,
        races: races || []
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/sync-races -> Añade una carrera o importa el catálogo bajo tu control
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Binding D1 no configurado.' }), { status: 500, headers: corsHeaders });
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const auth = verifyAdminAccess(request, env, body);
  if (!auth.isAuthorized) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Solo un administrador (joel.botana@gmail.com / jobial24) puede modificar el catálogo.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    let racesToSync = [];
    if (body.race && typeof body.race === 'object') {
      racesToSync = [body.race];
    } else if (Array.isArray(body.races) && body.races.length > 0) {
      racesToSync = body.races;
    } else {
      racesToSync = getOfficialUpcomingCatalog();
    }

    const upsertStmt = env.DB.prepare(`
      INSERT INTO races (
        id, name, date, location, province, country, discipline,
        distance_km, elevation_m, price_eur, status,
        website_url, image_url, source, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        date = excluded.date,
        location = excluded.location,
        province = excluded.province,
        country = excluded.country,
        discipline = excluded.discipline,
        distance_km = excluded.distance_km,
        elevation_m = excluded.elevation_m,
        price_eur = excluded.price_eur,
        status = excluded.status,
        website_url = excluded.website_url,
        image_url = excluded.image_url,
        source = excluded.source,
        updated_at = datetime('now')
    `);

    const batchOperations = racesToSync.map((r) => {
      const generatedId =
        r.id ||
        `${String(r.name || 'race').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(r.date || '2026').slice(0, 4)}`;

      return upsertStmt.bind(
        generatedId,
        r.name,
        r.date,
        r.location,
        r.province || 'España',
        r.country || 'España',
        r.discipline || 'Running',
        Number(r.distance_km ?? r.distanceKm ?? 10),
        Number(r.elevation_m ?? 0),
        Number(r.price_eur ?? 0),
        r.status || 'Inscripciones Abiertas',
        r.website_url || r.url || '',
        r.image_url || r.image || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
        `admin:${auth.adminIdentifier}`
      );
    });

    await env.DB.batch(batchOperations);

    const { results: updatedRaces } = await env.DB.prepare(`SELECT * FROM races ORDER BY date ASC`).all();

    return new Response(
      JSON.stringify({
        ok: true,
        upserted: racesToSync.length,
        races: updatedRaces
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/sync-races?id=xxx (o ?id=ALL para limpiar toda la tabla)
export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Binding D1 no configurado.' }), { status: 500, headers: corsHeaders });
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const auth = verifyAdminAccess(request, env, body);
  if (!auth.isAdminUser) {
    return new Response(JSON.stringify({ ok: false, error: 'Solo el Admin puede borrar carreras.' }), { status: 403, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const raceId = url.searchParams.get('id') || body.id;

  if (raceId === 'ALL') {
    await env.DB.prepare(`DELETE FROM races`).run();
    return new Response(JSON.stringify({ ok: true, clearedAll: true }), { status: 200, headers: corsHeaders });
  }

  await env.DB.prepare(`DELETE FROM races WHERE id = ?1`).bind(raceId).run();
  return new Response(JSON.stringify({ ok: true, deletedId: raceId }), { status: 200, headers: corsHeaders });
}