// Builds 3 standalone static websites for Firebase Hosting:
//   dist/cakes -> SAVORY Cake Studio (root / is Cake Studio)
//   dist/menu  -> SAVORY Menu & Chocolatier (root / is Menu)
//   dist/admin -> SAVORY Admin Dashboard (root / is Admin)
import fs from 'node:fs';
import path from 'node:path';
import { db, getSettings, UPLOAD_DIR } from '../src/db.js';
import { CAKE_GROUPS } from '../src/cake-groups.js';
import { renderPage } from '../src/pages.js';

const ROOT = path.resolve('.');
const DIST = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');

const URLS = {
  cakesSiteUrl: process.env.CAKES_SITE_URL || 'https://savory-lb-cakes.web.app',
  menuSiteUrl: process.env.MENU_SITE_URL || 'https://savory-lb-menu.web.app',
  adminSiteUrl: process.env.ADMIN_SITE_URL || 'https://savory-lb-admin.web.app',
};

const BUILD_ID = Date.now().toString(36);

// seed.json is a public file, so it only holds what the shop shows to everyone.
// Orders, contact messages and admin accounts (customer names, phones, addresses) never go in it.
function buildSeed() {
  return {
    settings: getSettings(),
    branches: db.prepare('SELECT * FROM branches ORDER BY sort_order, id').all(),
    menu_items: db.prepare('SELECT * FROM menu_items ORDER BY sort_order, name').all(),
    cake_groups: CAKE_GROUPS,
    cake_options: db.prepare('SELECT * FROM cake_options ORDER BY sort_order, id').all(),
    gallery_images: db.prepare('SELECT * FROM gallery_images ORDER BY sort_order, id DESC').all(),
    reviews: db.prepare('SELECT * FROM reviews ORDER BY sort_order, id DESC').all(),
    faqs: db.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all(),
    orders: [],
    messages: [],
    admins: [],
  };
}

const seedJson = JSON.stringify(buildSeed());

function prepareSiteDir(targetName) {
  const dir = path.join(DIST, targetName);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // Copy public assets
  fs.cpSync(PUBLIC_DIR, dir, { recursive: true });

  // Copy Three.js vendor bundles
  const vendorBuild = path.join(dir, 'vendor', 'three', 'build');
  const vendorAddons = path.join(dir, 'vendor', 'three', 'addons');
  fs.mkdirSync(vendorBuild, { recursive: true });
  fs.mkdirSync(vendorAddons, { recursive: true });
  fs.cpSync(path.join(THREE_DIR, 'build'), vendorBuild, { recursive: true });
  fs.cpSync(path.join(THREE_DIR, 'examples', 'jsm'), vendorAddons, { recursive: true });

  // Copy any local uploaded images
  if (fs.existsSync(UPLOAD_DIR)) {
    fs.cpSync(UPLOAD_DIR, path.join(dir, 'uploads'), { recursive: true });
  }

  // Write seed.json
  fs.writeFileSync(path.join(dir, 'seed.json'), seedJson);

  // Give the service worker cache a per-build name, so each deploy replaces the old cached files.
  const swPath = path.join(dir, 'sw.js');
  const sw = fs.readFileSync(swPath, 'utf8');
  const stamped = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'savory-pwa-${BUILD_ID}';`);
  if (stamped === sw) throw new Error('Could not find CACHE_NAME in public/sw.js.');
  fs.writeFileSync(swPath, stamped);
  return dir;
}

// 1. Build Cake Studio site (dist/cakes)
{
  const dir = prepareSiteDir('cakes');
  const opts = { siteMode: 'cakes', ...URLS };
  fs.writeFileSync(path.join(dir, 'index.html'), renderPage('home', opts));
  for (const page of ['cakes', 'gallery', 'about', 'faq', 'contact', 'track', '404']) {
    fs.writeFileSync(path.join(dir, `${page}.html`), renderPage(page, opts));
  }
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify({
    name: 'SAVORY · 3D Custom Cake Studio',
    short_name: 'SAVORY Cakes',
    description: 'Design custom celebration cakes in interactive 3D and order ahead for pickup or delivery.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F7D3',
    theme_color: '#4C2007',
    orientation: 'portrait-primary',
    icons: [{ src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }, null, 2));
}

// 2. Build Menu & Chocolatier site (dist/menu) — Menu is at root index.html!
{
  const dir = prepareSiteDir('menu');
  const opts = { siteMode: 'menu', ...URLS };
  fs.writeFileSync(path.join(dir, 'index.html'), renderPage('menu', opts));
  for (const page of ['about', 'faq', 'contact', 'track', '404']) {
    fs.writeFileSync(path.join(dir, `${page}.html`), renderPage(page, opts));
  }
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify({
    name: 'SAVORY · Chocolatier & Cafe',
    short_name: 'SAVORY Menu',
    description: 'Order fine Belgian chocolates, luxury gift boxes, crepes, Savory Flurry and bakes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F7D3',
    theme_color: '#4C2007',
    orientation: 'portrait-primary',
    icons: [{ src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }, null, 2));
}

// 3. Build Admin Dashboard site (dist/admin) — Admin is at root index.html!
{
  const dir = prepareSiteDir('admin');
  const opts = { siteMode: 'admin', ...URLS };
  const adminHtml = renderPage('admin', opts);
  fs.writeFileSync(path.join(dir, 'index.html'), adminHtml);
  fs.writeFileSync(path.join(dir, '404.html'), adminHtml);
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify({
    name: 'SAVORY · Kitchen Admin & Order Hub',
    short_name: 'SAVORY Admin',
    description: 'Real-time kitchen order queue, kitchen prep sheets, WhatsApp messaging and menu management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F7D3',
    theme_color: '#3B1704',
    orientation: 'portrait-primary',
    icons: [{ src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }, null, 2));
}

console.log('Built dist/cakes, dist/menu, and dist/admin for Firebase Hosting.');
