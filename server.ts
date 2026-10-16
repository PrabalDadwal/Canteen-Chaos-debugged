import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load backend logic and routing from Canteen Chaos backend
const backend = require('./backend/server.js');
const { app, startKitchen } = backend;

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);

  // Start background kitchen order processing
  startKitchen();

  // Serve static assets from frontend and public
  app.use('/img', express.static(path.join(__dirname, 'frontend/img')));
  app.use('/js', express.static(path.join(__dirname, 'frontend/js')));
  app.use('/style.css', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'frontend/style.css'));
  });

  // Serve markdown files for previewing
  app.get('/api/log-md', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'LOG.md'));
  });
  app.get('/api/bugs-log-md', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'BUGS_LOG.md'));
  });

  // Mount Vite in development for HMR and modern bundling
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'frontend')));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Canteen Chaos running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Canteen Chaos server:', err);
  process.exit(1);
});
