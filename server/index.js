import http from 'node:http';
import { createApp } from './app.js';
import { q } from './db.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME, ensureAdmin } from './seed/index.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

async function main() {
  // No demo data: an empty database gets exactly one administrator account.
  const profileCount = q.get('SELECT COUNT(*) AS c FROM profiles')?.c ?? 0;
  if (profileCount === 0) {
    ensureAdmin();
    console.log('[bootstrap] created the workspace administrator');
    console.log(`[bootstrap]   username: ${ADMIN_USERNAME}`);
    console.log(`[bootstrap]   email:    ${ADMIN_EMAIL}`);
    console.log(`[bootstrap]   password: ${ADMIN_PASSWORD}  (change it after signing in)`);
  }

  let vite = null;
  if (!isProduction) {
    const { createServer } = await import('vite');
    const httpServer = http.createServer();
    vite = await createServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    const app = await createApp({ vite });
    httpServer.on('request', app);
    httpServer.listen(PORT, HOST, () => {
      console.log(`[dev] Error Noting & Tracking System running at http://${HOST}:${PORT}`);
    });
    return;
  }

  const app = await createApp();
  app.listen(PORT, HOST, () => {
    console.log(`[prod] Error Noting & Tracking System running at http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
