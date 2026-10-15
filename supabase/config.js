// Proyecto Supabase de Race Connect Hub.
// La "publishable key" es PÚBLICA por diseño (va en la app del navegador/móvil);
// la seguridad la ponen las políticas RLS de schema.sql.
// ⚠️ La SECRET key (sb_secret_…) NUNCA debe ir aquí ni en el navegador.
// Se pueden sobrescribir en .env con SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY.
export const SUPABASE_DEFAULTS = {
  url: 'https://wfvxndczesgmfansgzym.supabase.co',
  publishableKey: 'sb_publishable_-nm3FHGbqlDzVCFcGn4gyw_O8RDQmOP',
};
