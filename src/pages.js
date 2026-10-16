// Tiny page renderer for the HTML files in views/:
//   {{> name}}             inserts views/partials/name.html
//   {{key}}                inserts a shop setting (or a computed value below), HTML-escaped
//   {{#key}}...{{/key}}    keeps the block only when that value is non-empty
// The nav link whose data-page matches the page gets aria-current="page".
import fs from 'node:fs';
import path from 'node:path';
import { getSettings } from './db.js';

const VIEWS = path.resolve('views');
const cache = new Map();
const caching = process.env.NODE_ENV === 'production';

function read(file) {
  if (caching && cache.has(file)) return cache.get(file);
  const content = fs.readFileSync(path.join(VIEWS, file), 'utf8');
  if (caching) cache.set(file, content);
  return content;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export function pageExists(name) {
  return fs.existsSync(path.join(VIEWS, `${name}.html`));
}

export function renderPage(name) {
  const s = getSettings();
  const values = {
    ...s,
    year: String(new Date().getFullYear()),
    phone_href: s.phone ? `tel:${s.phone.replace(/[^\d+]/g, '')}` : '',
    maps_url: s.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address.replace(/\n/g, ', '))}` : '',
    has_social: s.instagram || s.facebook ? '1' : '',
    has_contact: s.phone || s.email || s.address ? '1' : '',
  };

  let html = read(`${name}.html`);
  // Partials can contain other partials, so expand a few levels deep.
  for (let i = 0; i < 3 && html.includes('{{>'); i++) {
    html = html.replace(/{{>\s*([\w-]+)\s*}}/g, (_, partial) => read(`partials/${partial}.html`));
  }

  // Blocks can be nested, so keep resolving until none are left.
  for (let i = 0; i < 4 && html.includes('{{#'); i++) {
    html = html.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (_, key, block) => (values[key] ? block : ''));
  }
  html = html
    .replace(/{{\s*(\w+)\s*}}/g, (_, key) => esc(values[key]))
    .replaceAll(`data-page="${name}"`, `data-page="${name}" aria-current="page"`);
  return html;
}
