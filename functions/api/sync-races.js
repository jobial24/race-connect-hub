// functions/api/sync-races.js
// Cloudflare Pages Function + D1 SQLite (env.DB) + Control de Admin

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Email, X-Admin-User',
  'Content-Type': 'application/json;charset=UTF-8',
};

// Lista blanca de cuentas Administradoras
const ADMIN_ACCOUNTS = [
  'joel.botana@gmail.com',
  'jobial24'
];

// Verifica si la petición viene del Admin (Joel) o del Cron automático
function verifyAdminAccess(request, env, body = {}) {
  const authHeader = request.headers.get('Authorization') || '';
  const headerEmail = (request.headers.get('X-Admin-Email') || '').toLowerCase().trim();
  const headerUser = (request.headers.get('X-Admin-User') || '').toLowerCase().trim();
  const bodyAdmin = (body.adminEmail || body.adminUser || '').toLowerCase().trim();

  // 1. Verificar si es la cuenta de Joel por cabecera o body
  const isJoelAdmin =
    ADMIN_ACCOUNTS.includes(headerEmail) ||
    ADMIN_ACCOUNTS.includes(headerUser) ||
    ADMIN_ACCOUNTS.includes(bodyAdmin);

  // 2. Verificar si viene con el token secreto (GitHub Actions / Cron)
  const hasValidSecret =
    env.SYNC_SECRET && authHeader === `Bearer ${env.SYNC_SECRET}`;

  // 3. Si es una sincronización estándar automática y no hay SYNC_SECRET forzado en Cloudflare
  const isDefaultAutoCron = !env.SYNC_SECRET && (!body.action || body.action === 'sync');

  return {
    isAuthorized: isJoelAdmin || hasValidSecret || isDefaultAutoCron,
    isAdminUser: isJoelAdmin || hasValidSecret,
    adminIdentifier: headerEmail || headerUser || bodyAdmin || 'system-cron'
  };
}

// Catálogo base + autodescubrimiento de carreras 2026 / 2027
async function discoverUpcomingRaces() {
  return [
    {
      id: 'behobia-ss-2026',
      name: '59ª Behobia - San Sebastián',
      date: '2026-11-08',
      location: 'Donostia / San Sebastián, País Vasco',
      province: 'Gipuzkoa',
      country: 'España',
      discipline: 'Running',
      distance_km: 20,
      elevation_m: 192,
      price_eur: 50,
      status: 'Finalizada / Resultados Oficiales',
      website_url: 'https://www.behobia-sansebastian.com',
      image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
      source: 'zero-touch-cron'
    },
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
      source: 'zero-touch-cron'
    },
    {
      id: 'spartan-tenerife-2026',
      name: 'Spartan Race Tenerife Trifecta Weekend',
      date: '2026-12-05',
      location: 'Puerto de la Cruz, Tenerife',
      province: 'Santa Cruz de Tenerife',
      country: 'España',
      discipline: 'OCR / Spartan',
      distance_km: 21,
      elevation_m: 1150,
      price_eur: 105,
      status: 'Últimos Dorsales',
      website_url: 'https://es.spartan.com',
      image_url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
      source: 'zero-touch-cron'
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
      source: 'zero-touch-cron'
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
      source: 'zero-touch-cron'
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
      source: 'zero-touch-cron'
    },
    {
      id: 'zurich-marato-bcn-2027',
      name: 'Zurich Marató Barcelona',
      date: '2027-03-14',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 42.195,
      elevation_m: 190,
      price_eur: 65,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.zurichmaratobarcelona.es',
      image_url: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=800&q=80',
      source: 'zero-touch-cron'
    },
    {
      id: 'valencia-half-2027',
      name: 'Medio Maratón Valencia Trinidad Alfonso Zurich',
      date: '2027-10-24',
      location: 'Valencia, C. Valenciana',
      province: 'Valencia',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.097,
      elevation_m: 35,
      price_eur: 45,
      status: 'Lista de Espera / Transferencia',
      website_url: 'https://www.valenciaciudaddelrunning.com',
      image_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
      source: 'zero-touch-cron'
    }
  ];
}

// Preflight CORS
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/sync-races -> Devuelve todas las carreras, logs y comprueba si el usuario es Admin
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Binding D1 (env.DB) no encontrado en Cloudflare Pages.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const url = new URL(request.url);
    const queryUser = (url.searchParams.get('user') || url.searchParams.get('email') || '').toLowerCase().trim();
    const authInfo = verifyAdminAccess(request, env, { adminEmail: queryUser });

    // Si la tabla está vacía en la primera carga, la poblamos sola (Zero-Touch Init)
    let { results: races } = await env.DB.prepare(
      `SELECT * FROM races ORDER BY date ASC`
    ).all();

    if (!races || races.length === 0) {
      const initialRaces = await discoverUpcomingRaces();
      const initStmt = env.DB.prepare(`
        INSERT OR IGNORE INTO races (
          id, name, date, location, province, country, discipline,
          distance_km, elevation_m, price_eur, status,
          website_url, image_url, source, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))
      `);

      await env.DB.batch(
        initialRaces.map((r) =>
          initStmt.bind(
            r.id, r.name, r.date, r.location, r.province, r.country || 'España',
            r.discipline, r.distance_km, r.elevation_m, r.price_eur, r.status,
            r.website_url, r.image_url, r.source
          )
        )
      );

      constseeded = await env.DB.prepare(`SELECT * FROM races ORDER BY date ASC`).all();
      races = constseeded.results;
    }

    const lastSync = await env.DB.prepare(
      `SELECT run_at, races_upserted, status, details FROM sync_logs ORDER BY id DESC LIMIT 1`
    ).first();

    return new Response(
      JSON.stringify({
        ok: true,
        isAdmin: authInfo.isAdminUser,
        admins: ADMIN_ACCOUNTS,
        count: races.length,
        lastSync: lastSync || null,
        races
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

// POST /api/sync-races -> Sincroniza catálogo o añade/edita carreras como Admin (Joel)
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Binding D1 (env.DB) no configurado.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const auth = verifyAdminAccess(request, env, body);
  if (!auth.isAuthorized) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Acceso denegado: Se requiere cuenta de administrador (joel.botana@gmail.com / jobial24).'
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    let racesToSync = [];

    // Si el Admin envía una carrera individual o una lista personalizada
    if (body.race && typeof body.race === 'object') {
      racesToSync = [body.race];
    } else if (Array.isArray(body.races) && body.races.length > 0) {
      racesToSync = body.races;
    } else {
      racesToSync = await discoverUpcomingRaces();
    }

    const upsertStmt = env.DB.prepare(`
      INSERT INTO races (
        id, name, date, location, province, country, discipline,
        distance_km, elevation_m, price_eur, status,
        website_url, image_url, source, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))
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
        `${String(r.name || 'race')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}-${String(r.date || '2026').slice(0, 4)}`;

      return upsertStmt.bind(
        generatedId,
        r.name,
        r.date,
        r.location,
        r.province || 'España',
        r.country || 'España',
        r.discipline || 'Running',
        Number(r.distance_km ?? r.distanceKm ?? String(r.distance || '10').replace(/[^0-9.]/g, '') ?? 10),
        Number(r.elevation_m ?? String(r.elevation || '0').replace(/[^0-9]/g, '') ?? 0),
        Number(r.price_eur ?? String(r.price || '0').replace(/[^0-9.]/g, '') ?? 0),
        r.status || 'Inscripciones Abiertas',
        r.website_url || r.url || '',
        r.image_url || r.image || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
        auth.isAdminUser ? `admin:${auth.adminIdentifier}` : (r.source || 'auto-cron')
      );
    });

    // Guardar registro en sync_logs y mantener solo los últimos 50 registros
    batchOperations.push(
      env.DB.prepare(
        `INSERT INTO sync_logs (races_upserted, status, details) VALUES (?1, 'SUCCESS', ?2)`
      ).bind(
        racesToSync.length,
        `[${auth.adminIdentifier}] Sincronizadas ${racesToSync.length} carreras en Cloudflare D1`
      ),
      env.DB.prepare(
        `DELETE FROM sync_logs WHERE id NOT IN (SELECT id FROM sync_logs ORDER BY id DESC LIMIT 50)`
      )
    );

    await env.DB.batch(batchOperations);

    return new Response(
      JSON.stringify({
        ok: true,
        admin: auth.adminIdentifier,
        upserted: racesToSync.length,
        timestamp: new Date().toISOString(),
        message: 'Catálogo actualizado correctamente en Cloudflare D1'
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

// DELETE /api/sync-races?id=xxx -> Exclusivo para Admin (joel.botana@gmail.com / jobial24)
export async function onRequestDelete(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Binding D1 (env.DB) no configurado.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const auth = verifyAdminAccess(request, env, body);
  if (!auth.isAdminUser) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Permiso denegado: Solo joel.botana@gmail.com (jobial24) puede eliminar carreras.'
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  const url = new URL(request.url);
  const raceId = url.searchParams.get('id') || body.id;

  if (!raceId) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Falta el parámetro id de la carrera a eliminar.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM races WHERE id = ?1`).bind(raceId),
      env.DB.prepare(
        `INSERT INTO sync_logs (races_upserted, status, details) VALUES (0, 'ADMIN_DELETE', ?1)`
      ).bind(`[${auth.adminIdentifier}] Eliminada carrera ID: ${raceId}`)
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        deletedId: raceId,
        admin: auth.adminIdentifier,
        message: `Carrera ${raceId} eliminada por Admin.`
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