import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import raceApiPlugin from './server/vitePlugin.js';
import { SUPABASE_DEFAULTS } from './supabase/config.js';

export default defineConfig(({ mode }) => {
  // Carga TODAS las variables de .env (también las que no empiezan por VITE_),
  // solo en el servidor: GEMINI_API_KEY nunca llega al bundle del navegador.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  // Supabase: solo la URL y la clave PUBLICABLE llegan al navegador (nunca la secreta)
  env.SUPABASE_URL ||= env.VITE_SUPABASE_URL || SUPABASE_DEFAULTS.url;
  env.SUPABASE_PUBLISHABLE_KEY ||= env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || SUPABASE_DEFAULTS.publishableKey;

  return {
    plugins: [react(), raceApiPlugin(env)],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      watch: {
        // la caché y el snapshot se reescriben al sincronizar: no recargar la app por ello
        ignored: ['**/.cache/**', '**/public/races.json', '**/node_modules/**'],
        // En Windows algunos cambios de archivo no llegan al vigilante → sondeo
        usePolling: process.platform === 'win32',
        interval: 400,
      },
    },
  };
});
