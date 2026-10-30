import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const isDev = mode === 'development' || command === 'serve';
  const hasLocalEnv = fs.existsSync('.env.local') || fs.existsSync('.env.development.local');

  // Verify that no privileged service-role credentials are leaked into VITE_ variables
  const clientEnv = loadEnv(mode, process.cwd(), 'VITE_');
  for (const key of Object.keys(clientEnv)) {
    const upper = key.toUpperCase();
    if (upper.includes('SERVICE_ROLE') || upper.includes('SERVICE_KEY') || upper.includes('SECRET_KEY')) {
      throw new Error(
        `\n[Security Fatal] Privileged credential detected in client variable ${key}.\n` +
        'Service-role keys must NEVER be exposed to frontend code or prefixed with VITE_.\n'
      );
    }
  }

  // In development, if .env.local does not exist, explicitly blank out production Supabase credentials
  // to prevent accidental writes to the production cloud database.
  const defineOverrides = {};
  if (isDev && !hasLocalEnv) {
    console.warn(
      '\n[FindAI Dev Notice] .env.local is not configured yet.\n' +
      'Development mode requires an isolated local Supabase configuration.\n' +
      'To prevent accidental production writes, production credentials from .env are blanked out.\n' +
      'Copy .env.local.example to .env.local to activate local/dev database services.\n'
    );
    defineOverrides['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify('');
    defineOverrides['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'] = JSON.stringify('');
    defineOverrides['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify('');
  }

  return {
    plugins: [react()],
    define: defineOverrides,
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          onError(err, req, res) {
            console.warn('[Vite Proxy] Backend not reachable for', req.url, '-', err.message);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'text/plain' });
            }
            res.end('Backend service unavailable');
          },
        },
      },
    },
  };
});
