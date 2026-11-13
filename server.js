import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { UPLOAD_DIR } from './src/db.js';
import { renderPage } from './src/pages.js';
import { router as publicApi } from './src/routes/public.js';
import { router as adminApi } from './src/routes/admin.js';

const PUBLIC_DIR = path.resolve('public');
const THREE_DIR = path.resolve('node_modules/three');

function detectSiteMode(req, forcedMode) {
  const mode = (forcedMode || process.env.SITE_MODE || req.headers['x-savory-site'] || '').toLowerCase().trim();
  if (mode === 'cakes' || mode === 'menu' || mode === 'admin') return mode;

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '').toLowerCase();
  if (host.includes('admin')) return 'admin';
  if (host.includes('menu')) return 'menu';
  return 'cakes';
}

function resolvePartnerUrls(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  if (host && (host.includes('admin') || host.includes('menu') || host.includes('cake'))) {
    const replaceRole = (role) => `${proto}://${host.replace(/admin|menu|cakes?/i, role)}`;
    return {
      cakesSiteUrl: process.env.CAKES_SITE_URL || replaceRole('cakes'),
      menuSiteUrl: process.env.MENU_SITE_URL || replaceRole('menu'),
      adminSiteUrl: process.env.ADMIN_SITE_URL || replaceRole('admin'),
    };
  }
  const cakesPort = Number(process.env.CAKES_PORT) || 3000;
  const menuPort = Number(process.env.MENU_PORT) || 3001;
  const adminPort = Number(process.env.ADMIN_PORT) || 3002;
  return {
    cakesSiteUrl: process.env.CAKES_SITE_URL || `http://localhost:${cakesPort}`,
    menuSiteUrl: process.env.MENU_SITE_URL || `http://localhost:${menuPort}`,
    adminSiteUrl: process.env.ADMIN_SITE_URL || `http://localhost:${adminPort}`,
  };
}

const CAKES_PAGES = {
  '/': 'home',
  '/cakes': 'cakes',
  '/gallery': 'gallery',
  '/about': 'about',
  '/faq': 'faq',
  '/contact': 'contact',
  '/track': 'track',
};

const MENU_PAGES = {
  '/': 'menu',
  '/about': 'about',
  '/faq': 'faq',
  '/contact': 'contact',
  '/track': 'track',
};

export function createApp(forcedSiteMode = '') {
  const app = express();
  app.disable('x-powered-by');

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

  const sendScreen = (req, res, screen, status = 200) => {
    const siteMode = detectSiteMode(req, forcedSiteMode);
    const urls = resolvePartnerUrls(req);
    res.status(status).type('html').send(renderPage(screen, { siteMode, ...urls }));
  };

  app.get(['/', '/cakes', '/menu', '/gallery', '/about', '/faq', '/contact', '/track', '/track/:code', '/admin'], (req, res) => {
    const siteMode = detectSiteMode(req, forcedSiteMode);
    const route = req.path.startsWith('/track/') ? '/track' : req.path;

    if (siteMode === 'admin') {
      if (route === '/admin') return res.redirect(301, '/');
      if (route === '/') return sendScreen(req, res, 'admin');
      return res.redirect(302, '/');
    }

    if (siteMode === 'menu') {
      if (route === '/menu') return res.redirect(301, '/');
      const page = MENU_PAGES[route];
      if (!page) return sendScreen(req, res, '404', 404);
      return sendScreen(req, res, page);
    }

    const page = CAKES_PAGES[route];
    if (!page) return sendScreen(req, res, '404', 404);
    return sendScreen(req, res, page);
  });

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
  app.use('/vendor/three/build', express.static(path.join(THREE_DIR, 'build'), { maxAge: '30d' }));
  app.use('/vendor/three/addons', express.static(path.join(THREE_DIR, 'examples/jsm'), { maxAge: '30d' }));
  app.use(express.static(PUBLIC_DIR));

  app.use((req, res) => {
    const siteMode = detectSiteMode(req, forcedSiteMode);
    if (siteMode === 'admin') return res.redirect(302, '/');
    return sendScreen(req, res, '404', 404);
  });

  app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    let message = err.message;
    if (err instanceof multer.MulterError) {
      status = 400;
      message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file is too large (max 8 MB for photos, 25 MB for onboarding media).'
        : 'Could not upload that file.';
    } else if (err.type === 'entity.parse.failed') {
      message = 'Request was not valid JSON.';
    } else if (status >= 500) {
      console.error(err);
      message = 'Something went wrong on our side. Please try again.';
    }
    res.status(status).json({ error: message });
  });

  return app;
}

if (process.env.PORT || process.env.SITE_MODE) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp(process.env.SITE_MODE || '');
  app.listen(port, () => {
    console.log(`SAVORY server listening on http://localhost:${port} (mode: ${process.env.SITE_MODE || 'host-based: cakes / menu / admin'})`);
  });
} else {
  const cakesPort = Number(process.env.CAKES_PORT) || 3000;
  const menuPort = Number(process.env.MENU_PORT) || 3001;
  const adminPort = Number(process.env.ADMIN_PORT) || 3002;

  createApp('cakes').listen(cakesPort, () => {
    console.log(`🍰 SAVORY Cake Studio Website:  http://localhost:${cakesPort}`);
  });
  createApp('menu').listen(menuPort, () => {
    console.log(`🍫 SAVORY Menu Website:         http://localhost:${menuPort}`);
  });
  createApp('admin').listen(adminPort, () => {
    console.log(`🔐 SAVORY Admin Website:        http://localhost:${adminPort}`);
  });
}
