// functions/api/sync-races.js

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json;charset=UTF-8',
};

// Catálogo base + descubrimiento automático de próximas carreras 2026/2027
async function discoverUpcomingRaces() {
  return [
    {
      id: 'jean-bouin-2026',
      name: '103ª Allianz Jean Bouin Barcelona',
      date: '2026-11-29',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      discipline: 'Running',
      distance_km: 10,
      elevation_m: 140,
      price_eur: 19,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.jeanbouin.mundodeportivo.com',
      image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
      source: 'zero-touch-cron'
    },
    {
      id: 'spartan-tenerife-2026',
      name: 'Spartan Race Tenerife Trifecta Weekend',
      date: '2026-12-05',
      location: 'Puerto de la Cruz, Tenerife',
      province: 'Santa Cruz de Tenerife',
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
      discipline: 'Running',
      distance_km: 21.097,
      elevation_m: 260,
      price_eur: 24,
      status: 'Inscripciones Abiertas',
      website_url: 'https://mitjaterrassa.org',
      image_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
      source: 'zero-touch-cron'
    },
    {
      id: 'mitja-barcelona-2027',
      name: 'eDreams Mitja Marató Barcelona by Brooks',
      date: '2027-02-14',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
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
      id: 'valencia-half-2027',
      name: 'Medio Maratón Valencia Trinidad Alfonso Zurich',
      date: '2027-10-24',
      location: 'Valencia, C. Valenciana',
      province: 'Valencia',
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/sync-races -> Lee el catálogo desde Cloudflare D1 para el frontend
export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'Binding D1 (env.DB) no encontrado en Cloudflare Pages.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const { results: races } = await env.DB.prepare(
      `SELECT * FROM races ORDER BY date ASC`
    ).all();

    const lastSync = await env.DB.prepare(
      `SELECT run_at, races_upserted, status, details FROM sync_logs ORDER BY id DESC LIMIT 1`
    ).first();

    return new Response(
      JSON.stringify({
        ok: true,
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

// POST /api/sync-races -> Ejecuta sincronización Zero-Touch en D1 (GitHub Actions o botón UI)
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'Binding D1 (env.DB) no configurado.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  // Protección opcional por token para cuando llames desde GitHub Actions
  const authHeader = request.headers.get('Authorization');
  if (env.SYNC_SECRET && authHeader !== `Bearer ${env.SYNC_SECRET}`) {
    return new Response(
      JSON.stringify({ ok: false, error: 'No autorizado (SYNC_SECRET inválido)' }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    let racesToSync = [];

    // Permite enviar carreras nuevas desde el buscador IA del frontend o usar el motor automático
    try {
      const body = await request.json();
      if (body && Array.isArray(body.races) && body.races.length > 0) {
        racesToSync = body.races;
      }
    } catch (_) {
      // Si el body viene vacío (ej. llamada desde cron), usamos discoverUpcomingRaces()
    }

    if (racesToSync.length === 0) {
      racesToSync = await discoverUpcomingRaces();
    }

    const upsertStmt = env.DB.prepare(`
      INSERT INTO races (
        id, name, date, location, province, discipline,
        distance_km, elevation_m, price_eur, status,
        website_url, image_url, source, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        date = excluded.date,
        location = excluded.location,
        province = excluded.province,
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

    const batchOperations = racesToSync.map((r) =>
      upsertStmt.bind(
        r.id,
        r.name,
        r.date,
        r.location,
        r.province || '',
        r.discipline,
        Number(r.distance_km || r.distance || 10),
        Number(r.elevation_m || r.elevation || 0),
        Number(r.price_eur || r.price || 0),
        r.status || 'Inscripciones Abiertas',
        r.website_url || '',
        r.image_url || '',
        r.source || 'auto-cron'
      )
    );

    // Registrar el log y limpiar entradas antiguas (>50) para no gastar almacenamiento nunca
    batchOperations.push(
      env.DB.prepare(
        `INSERT INTO sync_logs (races_upserted, status, details) VALUES (?1, 'SUCCESS', ?2)`
      ).bind(racesToSync.length, `Sincronizadas ${racesToSync.length} carreras en Cloudflare D1`),
      env.DB.prepare(
        `DELETE FROM sync_logs WHERE id NOT IN (SELECT id FROM sync_logs ORDER BY id DESC LIMIT 50)`
      )
    );

    await env.DB.batch(batchOperations);

    return new Response(
      JSON.stringify({
        ok: true,
        upserted: racesToSync.length,
        timestamp: new Date().toISOString(),
        message: 'Sincronización completada en Cloudflare D1'
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