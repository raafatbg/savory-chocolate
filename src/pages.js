// Tiny page renderer for the HTML files in views/:
//   {{> name}}             inserts views/partials/name.html
//   {{key}}                inserts a shop setting (or a computed value below), HTML-escaped
//   {{{key}}}              inserts a computed HTML block built (and escaped) below
//   {{#key}}...{{/key}}    keeps the block only when that value is non-empty
// The nav link whose data-page matches the page gets aria-current="page".
import fs from 'node:fs';
import path from 'node:path';
import { db, getSettings } from './db.js';
import { OMVI } from './omvi.js';

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

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
const waHref = (number, shop) => `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${shop}!`)}`;
const mapsHref = (b) => b.maps_link
  || (b.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name ? `${b.shop} ` : ''}${b.address.replace(/\n/g, ', ')}`)}` : '');
const WA_ICON = () => read('partials/whatsapp-icon.html');

export function pageExists(name) {
  return fs.existsSync(path.join(VIEWS, 'screens', `${name}.html`));
}

// Where to find the shop: its branches, or (if none are set up) the address and numbers from Settings.
function locations(s) {
  const branches = db.prepare('SELECT * FROM branches WHERE available = 1 ORDER BY sort_order, id').all();
  if (branches.length) return branches.map((b) => ({ ...b, shop: s.shop_name }));
  if (!s.address && !s.phone && !s.whatsapp) return [];
  return [{ name: '', address: s.address, phone: s.phone, whatsapp: s.whatsapp, maps_link: s.maps_link, shop: s.shop_name }];
}

// <dl class="info-list"> rows, one per branch.
function visitRows(list) {
  return list.map((b) => {
    const links = [
      b.phone && `<a href="${esc(telHref(b.phone))}">Call ${esc(b.phone)}</a>`,
      b.whatsapp && `<a href="${esc(waHref(b.whatsapp, b.shop))}" target="_blank" rel="noopener">WhatsApp</a>`,
      mapsHref(b) && `<a href="${esc(mapsHref(b))}" target="_blank" rel="noopener">Directions →</a>`,
    ].filter(Boolean).join(' <span class="sep">·</span> ');
    return `<div><dt>${esc(b.name ? `${b.name} branch` : 'Address')}</dt>${b.address ? `<dd>${esc(b.address)}</dd>` : ''}${links ? `<dd class="branch-links">${links}</dd>` : ''}</div>`;
  }).join('');
}

// Footer "Visit" links, one group per branch.
function footerVisit(list) {
  return list.map((b) => `
        <div class="footer-branch">
          ${b.name ? `<strong>${esc(b.name)}</strong>` : ''}
          ${b.address ? `<p class="pre-line">${esc(b.address)}</p>` : ''}
          ${mapsHref(b) ? `<a href="${esc(mapsHref(b))}" target="_blank" rel="noopener">Get directions →</a>` : ''}
          ${b.phone ? `<a href="${esc(telHref(b.phone))}">Call ${esc(b.phone)}</a>` : ''}
          ${b.whatsapp ? `<a href="${esc(waHref(b.whatsapp, b.shop))}" target="_blank" rel="noopener">WhatsApp ${esc(b.whatsapp)}</a>` : ''}
        </div>`).join('');
}

// Home page "Visit us" columns, one per branch.
function visitCards(list) {
  return list.map((b) => `
        <div class="at-branch">
          <h3>${esc(b.name || b.shop)}</h3>
          ${b.address ? `<p class="pre-line">${esc(b.address)}</p>` : ''}
          ${b.phone ? `<a href="${esc(telHref(b.phone))}">${esc(b.phone)}</a>` : ''}
          ${b.whatsapp ? `<a href="${esc(waHref(b.whatsapp, b.shop))}" target="_blank" rel="noopener">WhatsApp ${esc(b.whatsapp)}</a>` : ''}
          ${mapsHref(b) ? `<a href="${esc(mapsHref(b))}" target="_blank" rel="noopener">Directions</a>` : ''}
        </div>`).join('');
}

// Floating WhatsApp button; with several branches it opens a small menu to pick one.
function whatsappFloat(list, s) {
  const chats = list.filter((b) => b.whatsapp);
  if (!chats.length) return '';
  if (chats.length === 1) {
    return `<a class="wa-float" href="${esc(waHref(chats[0].whatsapp, s.shop_name))}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">${WA_ICON()}</a>`;
  }
  return `<div class="wa-float-wrap" data-wa-menu>
  <div class="wa-menu" id="wa-menu" hidden>
    <span class="wa-menu-title">Chat with a branch</span>
    ${chats.map((b) => `<a href="${esc(waHref(b.whatsapp, s.shop_name))}" target="_blank" rel="noopener">${WA_ICON()}<span>${esc(b.name)}<small>${esc(b.whatsapp)}</small></span></a>`).join('')}
  </div>
  <button type="button" class="wa-float" aria-expanded="false" aria-controls="wa-menu" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">${WA_ICON()}</button>
</div>`;
}

// OMVI's contact links, only the ones filled in (src/omvi.js).
function omviContacts() {
  const handle = (link) => `@${link.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').split(/[/?#]/)[0]}`;
  const links = [
    OMVI.whatsapp && ['WhatsApp', waHref(OMVI.whatsapp, OMVI.name), OMVI.whatsapp],
    OMVI.phone && ['Call', telHref(OMVI.phone), OMVI.phone],
    OMVI.email && ['Email', `mailto:${OMVI.email}`, OMVI.email],
    OMVI.instagram && ['Instagram', OMVI.instagram, handle(OMVI.instagram)],
    OMVI.website && ['Website', OMVI.website, OMVI.website.replace(/^https?:\/\//, '').replace(/\/$/, '')],
  ].filter(Boolean);
  return links.map(([label, href, text]) => {
    const external = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `<a class="omvi-link" href="${esc(href)}"${external}><span>${esc(label)}</span>${esc(text)}</a>`;
  }).join('');
}

function leadNotice(value) {
  const days = Number(value) || 0;
  if (days <= 0) return 'Order cakes the same day';
  return `Custom cakes need ${days} day${days === 1 ? '' : 's'}' notice`;
}

export function renderPage(name, options = {}) {
  const siteMode = options.siteMode || 'cakes';
  const s = getSettings();
  const places = locations(s);
  const values = {
    ...s,
    year: String(new Date().getFullYear()),
    brand_script: (s.shop_name || '').trim().split(/\s+/)[0] || '',
    brand_caps: (s.shop_name || '').trim().split(/\s+/).slice(1).join(' '),
    instagram_handle: (s.instagram || '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').split(/[/?#]/)[0],
    phone_href: s.phone ? telHref(s.phone) : '',
    whatsapp_href: s.whatsapp ? waHref(s.whatsapp, s.shop_name) : '',
    has_social: s.instagram || s.facebook || s.whatsapp ? '1' : '',
    has_places: places.length ? '1' : '',
    lead_notice: leadNotice(s.cake_lead_days),
    omvi_name: OMVI.name,
    omvi_tagline: OMVI.tagline,
    omvi_about: OMVI.about,
    has_omvi_contact: OMVI.email || OMVI.phone || OMVI.whatsapp || OMVI.instagram || OMVI.website ? '1' : '',
    no_omvi_contact: OMVI.email || OMVI.phone || OMVI.whatsapp || OMVI.instagram || OMVI.website ? '' : '1',
    cakes_site_url: options.cakesSiteUrl || process.env.CAKES_SITE_URL || 'http://localhost:3000',
    menu_site_url: options.menuSiteUrl || process.env.MENU_SITE_URL || 'http://localhost:3001',
    admin_site_url: options.adminSiteUrl || process.env.ADMIN_SITE_URL || 'http://localhost:3002',
  };
  const blocks = {
    visit_rows: visitRows(places),
    visit_cards: visitCards(places),
    footer_visit: footerVisit(places),
    whatsapp_float: whatsappFloat(places, s),
    omvi_services: OMVI.services.map((x) => `<span class="chip">${esc(x)}</span>`).join(''),
    omvi_contacts: omviContacts(),
    contact_buttons: places.filter((b) => b.whatsapp).map((b) => `<a class="btn btn-gold btn-block wa-btn" href="${esc(waHref(b.whatsapp, s.shop_name))}" target="_blank" rel="noopener">${WA_ICON()} WhatsApp ${esc(b.name || s.shop_name)}</a>`).join(''),
  };

  let html = read(`screens/${name}.html`);
  // Partials can contain other partials, so expand a few levels deep.
  for (let i = 0; i < 3 && html.includes('{{>'); i++) {
    html = html.replace(/{{>\s*([\w-]+)\s*}}/g, (_, partial) => {
      if (siteMode === 'menu') {
        if (partial === 'header') return read('partials/header-menu.html');
        if (partial === 'footer') return read('partials/footer-menu.html');
      }
      return read(`partials/${partial}.html`);
    });
  }

  // Blocks can be nested, so keep resolving until none are left.
  for (let i = 0; i < 4 && html.includes('{{#'); i++) {
    html = html.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (_, key, block) => (values[key] ? block : ''));
  }
  html = html
    .replace(/{{{\s*(\w+)\s*}}}/g, (_, key) => blocks[key] ?? '')
    .replace(/{{\s*(\w+)\s*}}/g, (_, key) => esc(values[key]))
    .replaceAll(`data-page="${name}"`, `data-page="${name}" aria-current="page"`);
  return html;
}
