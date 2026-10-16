import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { UPLOAD_DIR } from './src/db.js';
import { renderPage } from './src/pages.js';
import { router as publicApi } from './src/routes/public.js';
import { router as adminApi } from './src/routes/admin.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.resolve('public');
const THREE_DIR = path.resolve('node_modules/three');

app.disable('x-powered-by');
// Behind a hosting proxy (Render, Railway, nginx…) set TRUST_PROXY=1 so rate limiting sees real visitor IPs.
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy === undefined ? 'loopback' : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

app.use(express.json({ limit: '200kb' }));

app.use('/api', publicApi);
app.use('/api/admin', adminApi);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Pages are rendered from views/ so the header, footer and shop details are filled in on the server.
const PAGES = {
  '/': 'home',
  '/cakes': 'cakes',
  '/menu': 'menu',
  '/gallery': 'gallery',
  '/about': 'about',
  '/faq': 'faq',
  '/contact': 'contact',
  '/admin': 'admin',
};
for (const [route, page] of Object.entries(PAGES)) {
  app.get(route, (req, res) => res.type('html').send(renderPage(page)));
}

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/vendor/three/build', express.static(path.join(THREE_DIR, 'build'), { maxAge: '30d' }));
app.use('/vendor/three/addons', express.static(path.join(THREE_DIR, 'examples/jsm'), { maxAge: '30d' }));
app.use(express.static(PUBLIC_DIR));

app.use((req, res) => res.status(404).type('html').send(renderPage('404')));

app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 8 MB or smaller.' : 'Could not upload that image.';
  } else if (err.type === 'entity.parse.failed') {
    message = 'Request was not valid JSON.';
  } else if (status >= 500) {
    console.error(err);
    message = 'Something went wrong on our side. Please try again.';
  }
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Savory Chocolate is running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
