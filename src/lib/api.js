// URL base del backend. En el navegador (npm run dev / npm start) es el mismo
// origen. En la app móvil (Capacitor) apunta al servidor publicado:
//   VITE_API_BASE=https://tu-servidor.com  npm run build
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export const api = (path) => `${API_BASE}${path}`;
