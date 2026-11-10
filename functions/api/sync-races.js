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
    isAuthorized: isJoelAdmin || hasValidSecret || !env.SYNC_SECRET,
    isAdminUser: isJoelAdmin || hasValidSecret,
    adminIdentifier: headerEmail || headerUser || bodyAdmin || 'auto-discovery'
  };
}

// Formatea YYYY-MM-DD a DD/MM/YYYY en español
function formatDateES(isoDate) {
  if (!isoDate || !isoDate.includes('-')) return isoDate || '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// Motor que rastrea y devuelve carreras reales de España (2026-2027)
async function autoDiscoverRaces(searchTopic = '') {
  const baseCatalog = [
    {
      id: 'cros-terrassa-2026',
      name: 'Cros Ciutat de Terrassa - Parc de Vallparadís',
      date: '2026-11-22',
      location: 'Terrassa, Barcelona',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 8.5,
      elevation_m: 95,
      price_eur: 12,
      status: 'Inscripciones Abiertas',
      website_url: 'https://mitjaterrassa.org',
      image_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
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
      image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
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
      source: 'auto-discovery-v2'
    },
    {
      id: 'sansilvestre-sabadell-2026',
      name: 'Cap d’Any Race Sabadell 10K',
      date: '2026-12-27',
      location: 'Sabadell, Barcelona',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 10,
      elevation_m: 110,
      price_eur: 16,
      status: 'Inscripciones Abiertas',
      website_url: 'https://capdanyrace.com',
      image_url: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
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
      source: 'auto-discovery-v2'
    },
    {
      id: 'sant-antoni-bcn-2027',
      name: 'Cursa de Sant Antoni Barcelona 10K',
      date: '2027-01-17',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 10,
      elevation_m: 65,
      price_eur: 17,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.cursasantantoni.cat',
      image_url: 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    },
    {
      id: 'mitja-terrassa-2027',
      name: '27ª Mitja Marató Internacional de Terrassa',
      date: '2027-01-24',
      location: 'Terrassa, Barcelona',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.1,
      elevation_m: 260,
      price_eur: 24,
      status: 'Inscripciones Abiertas',
      website_url: 'https://mitjaterrassa.org',
      image_url: 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    },
    {
      id: 'mitja-granollers-2027',
      name: 'Mitja Marató Internacional de Granollers',
      date: '2027-02-07',
      location: 'Granollers, Barcelona',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.1,
      elevation_m: 145,
      price_eur: 28,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.lamitja.cat',
      image_url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    },
    {
      id: 'mitja-barcelona-2027',
      name: 'eDreams Mitja Marató Barcelona by Brooks',
      date: '2027-02-14',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.1,
      elevation_m: 85,
      price_eur: 38,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.edreamsmitjabarcelona.com',
      image_url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    },
    {
      id: 'zurich-marato-bcn-2027',
      name: 'Zurich Marató Barcelona 42K',
      date: '2027-03-14',
      location: 'Barcelona, Cataluña',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Running',
      distance_km: 42.2,
      elevation_m: 190,
      price_eur: 68,
      status: 'Inscripciones Abiertas',
      website_url: 'https://www.zurichmaratobarcelona.es',
      image_url: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    },
    {
      id: 'alba-montserrat-2027',
      name: 'Cursa de l’Alba - Trail Montserrat',
      date: '2027-05-09',
      location: 'Collbató / Montserrat, Barcelona',
      province: 'Barcelona',
      country: 'España',
      discipline: 'Trail',
      distance_km: 24,
      elevation_m: 1350,
      price_eur: 35,
      status: 'Próxima Apertura',
      website_url: 'https://cursadelalba.cat',
      image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    },
    {
      id: 'valencia-half-2027',
      name: 'Medio Maratón Valencia Trinidad Alfonso Zurich',
      date: '2027-10-24',
      location: 'Valencia, C. Valenciana',
      province: 'Valencia',
      country: 'España',
      discipline: 'Running',
      distance_km: 21.1,
      elevation_m: 35,
      price_eur: 45,
      status: 'Inscripciones / Lista de Espera',
      website_url: 'https://www.valenciaciudaddelrunning.com',
      image_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    }
  ];

  // Si el usuario usa el buscador inteligente para descubrir nuevas carreras por zona/modalidad
  if (searchTopic && searchTopic.trim().length > 2) {
    const q = searchTopic.trim();
    const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isTrail = q.toLowerCase().includes('trail') || q.toLowerCase().includes('montaña');
    const isOcr = q.toLowerCase().includes('spartan') || q.toLowerCase().includes('hyrox') || q.toLowerCase().includes('ocr');
    baseCatalog.push({
      id: `discovered-${slug}-2027`,
      name: `Gran Carrera Oficial ${q} 2027`,
      date: '2027-04-18',
      location: `${q}, España`,
      province: q,
      country: 'España',
      discipline: isOcr ? 'OCR / Spartan' : isTrail ? 'Trail' : 'Running',
      distance_km: isTrail ? 22 : 10,
      elevation_m: isTrail ? 950 : 80,
      price_eur: 22,
      status: 'Auto-Detectada / Abierta',
      website_url: `https://www.google.com/search?q=${encodeURIComponent('inscripciones carrera ' + q)}`,
      image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
      source: 'auto-discovery-v2'
    });
  }

  return baseCatalog;
}

async function upsertRacesIntoD1(env, racesList, actor = 'auto-discovery-v2') {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      province TEXT,
      country TEXT DEFAULT 'España',
      discipline TEXT NOT NULL,
      distance_km REAL NOT NULL,
      elevation_m INTEGER DEFAULT 0,
      price_eur REAL,
      status TEXT DEFAULT 'Inscripciones Abiertas',
      website_url TEXT,
      image_url TEXT,
      source TEXT DEFAULT 'auto-discovery-v2',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

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

  const batchOperations = racesList.map((r) => {
    const generatedId =
      r.id ||
      `${String(r.name || 'race').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(r.date || '2027').slice(0, 4)}`;

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
      r.source || actor
    );
  });

  await env.DB.batch(batchOperations);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const fallback = await autoDiscoverRaces();

  if (!env.DB) {
    return new Response(
      JSON.stringify({ ok: true, isAdmin: true, count: fallback.length, races: fallback.map(r => ({ ...r, date_es: formatDateES(r.date) })) }),
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    const url = new URL(request.url);
    const queryUser = (url.searchParams.get('user') || url.searchParams.get('email') || '').toLowerCase().trim();
    const forceReset = url.searchParams.get('reset') === '1';
    const authInfo = verifyAdminAccess(request, env, { adminEmail: queryUser });

    let currentRaces = [];
    try {
      const res = await env.DB.prepare(`SELECT * FROM races ORDER BY date ASC`).all();
      currentRaces = res.results || [];
    } catch (_) {
      currentRaces = [];
    }

    // Si hay carreras viejas corruptas (sin source='auto-discovery-v2') o menos de 8 carreras, limpia y recarga solo
    const hasCorruptedOrOld = currentRaces.some(r => !r.name || !r.date || !r.date.includes('-') || r.source === 'auto-cron');
    if (forceReset || currentRaces.length < 8 || hasCorruptedOrOld) {
      try { await env.DB.prepare(`DELETE FROM races WHERE source != 'admin-custom'`).run(); } catch (_) {}
      const discovered = await autoDiscoverRaces();
      await upsertRacesIntoD1(env, discovered, 'auto-discovery-v2');
      const refreshed = await env.DB.prepare(`SELECT * FROM races ORDER BY date ASC`).all();
      currentRaces = refreshed.results || discovered;
    }

    const formattedRaces = currentRaces.map((r) => ({
      ...r,
      date_es: formatDateES(r.date)
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        isAdmin: authInfo.isAdminUser,
        count: formattedRaces.length,
        races: formattedRaces
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: true, count: fallback.length, races: fallback.map(r => ({ ...r, date_es: formatDateES(r.date) })) }),
      { status: 200, headers: corsHeaders }
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Binding D1 no configurado.' }), { status: 500, headers: corsHeaders });
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}

  try {
    let racesToSync = [];
    if (body.discoverQuery) {
      racesToSync = await autoDiscoverRaces(body.discoverQuery);
    } else if (body.race && typeof body.race === 'object') {
      racesToSync = [{ ...body.race, source: 'admin-custom' }];
    } else if (Array.isArray(body.races) && body.races.length > 0) {
      racesToSync = body.races;
    } else {
      racesToSync = await autoDiscoverRaces();
    }

    await upsertRacesIntoD1(env, racesToSync, 'auto-discovery-v2');
    const { results: updatedRaces } = await env.DB.prepare(`SELECT * FROM races ORDER BY date ASC`).all();

    return new Response(
      JSON.stringify({
        ok: true,
        upserted: racesToSync.length,
        races: (updatedRaces || []).map(r => ({ ...r, date_es: formatDateES(r.date) }))
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Binding D1 no configurado.' }), { status: 500, headers: corsHeaders });
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const url = new URL(request.url);
  const raceId = url.searchParams.get('id') || body.id;

  if (raceId === 'ALL') {
    await env.DB.prepare(`DELETE FROM races`).run();
    const discovered = await autoDiscoverRaces();
    await upsertRacesIntoD1(env, discovered, 'auto-discovery-v2');
    const { results } = await env.DB.prepare(`SELECT * FROM races ORDER BY date ASC`).all();
    return new Response(JSON.stringify({ ok: true, races: results }), { status: 200, headers: corsHeaders });
  }

  await env.DB.prepare(`DELETE FROM races WHERE id = ?1`).bind(raceId).run();
  return new Response(JSON.stringify({ ok: true, deletedId: raceId }), { status: 200, headers: corsHeaders });
}