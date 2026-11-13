import { api, esc, money, storage, reveal, loadSettings } from '/js/common.js';
import { createCakeStage, renderCakeSnapshot, releaseSnapshots } from '/js/cake3d.js';
import { SIGNATURE_DESIGNS } from '/js/designs.js';
import { illustrationFor } from '/js/illustrations.js';

// The home page leads with photos. The first three gallery photos (in the admin's Gallery order)
// fill the hero and the two "ways to order" tiles. Until there are photos, the hero shows the live
// 3D cake and the tiles show a cake render and a chocolate illustration.

const HERO_CAKE = {
  name: 'Royal Ganache Crown',
  cake: {
    shape: 'round', tiers: 3, size: 1,
    tierColors: ['#efe0c9', '#f0c9c2', '#efe0c9'], drip: '#2b160d',
    toppings: ['berries', 'goldleaf'], extras: ['candles'],
  },
};

const MENU_URL = document.querySelector('#ways a.at-tile:last-child')?.getAttribute('href') || '/menu';
const STUDIO_CREATIONS = [
  { image: '/img/studio-cake-craft.jpg', caption: 'Celebration cake finished with chocolate drip and fresh berries' },
  { image: '/img/studio-chocolatier-bench.jpg', caption: 'Hand-tempered chocolate glaze from our patisserie bench' },
  { image: '/img/studio-atelier-table.jpg', caption: 'Keepsake gift box, warm crepe, and dark ganache slice' },
  { image: '/img/onboarding-box.jpg', caption: 'Hand-packed 16-piece artisan praline keepsake box' },
  { image: '/img/onboarding-kunafa.jpg', caption: 'Pistachio kunafa crunch milk chocolate bar' },
  { image: '/img/onboarding-crepe.jpg', caption: 'Warm Belgian chocolate signature crepe' },
];
const mediaSrc = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/') || /^https?:\/\//i.test(raw)) return raw;
  return `/uploads/${raw}`;
};
const photo = (g, { eager = false } = {}) => `<img src="${esc(mediaSrc(g.image))}" alt="${esc(g.caption || '')}"${eager ? '' : ' loading="lazy"'}>`;

// loadSettings also sets the shop's currency for money().
const [, gallery, menu, reviews] = await Promise.all([
  loadSettings().catch(() => ({})),
  api('/api/gallery').catch(() => []),
  api('/api/menu').catch(() => []),
  api('/api/reviews').catch(() => []),
]);

// ---------- Hero ----------

const heroMedia = document.getElementById('hero-media');
const heroCaption = document.getElementById('hero-caption');
if (gallery[0]) {
  heroMedia.innerHTML = photo(gallery[0], { eager: true });
  heroCaption.textContent = gallery[0].caption || '';
  heroCaption.hidden = !gallery[0].caption;
} else {
  const stage = createCakeStage(document.getElementById('hero-stage'), { float: true });
  stage?.setCake(HERO_CAKE.cake, { intro: true });
  if (!stage) heroCaption.querySelector('.at-drag')?.remove();
}

// ---------- Two ways to order ----------

const cakesTile = document.getElementById('tile-cakes-media');
const menuTile = document.getElementById('tile-menu-media');
const showcase = SIGNATURE_DESIGNS.find((d) => d.id === 'midnight') || SIGNATURE_DESIGNS[0];

cakesTile.innerHTML = photo(gallery[1] || STUDIO_CREATIONS[0], { eager: true });

// ---------- Most loved: one standout per category, items with photos first ----------

const picks = [];
const seen = new Set();
const ranked = [...menu].sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0) || b.price_cents - a.price_cents);
for (const item of ranked) {
  if (seen.has(item.category) || /drink/i.test(item.category)) continue;
  seen.add(item.category);
  picks.push(item);
  if (picks.length === 4) break;
}
if (picks.length) {
  document.getElementById('loved-grid').innerHTML = picks.map((item) => `
    <a class="at-product" href="${esc(MENU_URL)}" data-reveal>
      <div class="at-media at-media-dark at-product-media">${item.image
        ? `<img src="${esc(mediaSrc(item.image))}" alt="${esc(item.name)}" loading="lazy">`
        : `<div class="at-art">${illustrationFor(item)}</div>`}</div>
      <div class="at-product-row">
        <h3>${esc(item.name)}</h3>
        <span class="at-price">${money(item.price_cents)}</span>
      </div>
      ${item.description ? `<p>${esc(item.description)}</p>` : ''}
    </a>`).join('');
  document.getElementById('loved').hidden = false;
}

menuTile.innerHTML = photo(gallery[2] || STUDIO_CREATIONS[2], { eager: true });

// ---------- Signature designs (rendered once, then cached in the browser) ----------

const designsEl = document.getElementById('designs');
const DESIGNS = SIGNATURE_DESIGNS.slice(0, 3);
designsEl.innerHTML = DESIGNS.map((d) => `
  <a class="at-design" href="/cakes?design=${esc(d.id)}" data-reveal>
    <div class="at-design-render" data-render="${esc(d.id)}"></div>
    <span>${esc(d.name)}</span>
  </a>`).join('');

const RENDER_CACHE = 'sc_design_render_v2_';
async function renderOne(design) {
  let url = storage.get(RENDER_CACHE + design.id, null);
  let fresh = false;
  if (!url) {
    try {
      url = await renderCakeSnapshot(design.cake, { width: 560, height: 560, type: 'image/webp', quality: 0.86 });
      if (url) { storage.set(RENDER_CACHE + design.id, url); fresh = true; }
    } catch { /* the illustration below stands in */ }
  }
  return { url: url || '/img/cake.svg', fresh };
}

async function renderDesigns() {
  let rendered = false;
  for (const d of [showcase, ...DESIGNS.filter((x) => x.id !== showcase.id)]) {
    const { url, fresh } = await renderOne(d);
    rendered ||= fresh;
    const img = `<img src="${url}" alt="${esc(d.name)}: ${esc(d.description)}" width="560" height="560">`;
    const slot = designsEl.querySelector(`[data-render="${d.id}"]`);
    if (slot) slot.innerHTML = img;
    await new Promise((r) => setTimeout(r, 30));
  }
  if (rendered) releaseSnapshots();
}
// Render once the tiles or the designs come near the screen (either may be in view first,
// e.g. when the browser restores a scrolled position on reload).
const renderWatch = new IntersectionObserver((entries, observer) => {
  if (entries.some((e) => e.isIntersecting)) {
    observer.disconnect();
    (window.requestIdleCallback || setTimeout)(renderDesigns);
  }
}, { rootMargin: '300px 0px' });
renderWatch.observe(document.getElementById('ways'));
renderWatch.observe(designsEl);

// ---------- One review at a time ----------

const STAR_SVG = '<svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M10 1.6l2.45 5.18 5.65.72-4.14 3.92 1.05 5.6L10 14.3l-5.01 2.72 1.05-5.6L1.9 7.5l5.65-.72L10 1.6z"/></svg>';

if (reviews.length) {
  let index = 0;
  const starsEl = document.getElementById('review-stars');
  const show = () => {
    const r = reviews[index];
    const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
    if (starsEl) {
      starsEl.innerHTML = STAR_SVG.repeat(rating);
      starsEl.hidden = false;
    }
    document.getElementById('review-text').textContent = `“${r.text}”`;
    document.getElementById('review-name').textContent = r.name;
    document.getElementById('review-count').textContent = `${index + 1} / ${reviews.length}`;
  };
  const step = (d) => { index = (index + d + reviews.length) % reviews.length; show(); };
  document.getElementById('review-prev').addEventListener('click', () => step(-1));
  document.getElementById('review-next').addEventListener('click', () => step(1));
  document.getElementById('review-nav').hidden = reviews.length < 2;
  show();
  document.getElementById('review-section').hidden = false;
}

// ---------- Recent creations (admin gallery photos after hero/tiles, or studio patisserie set) ----------

const recent = gallery.length > 3 ? gallery.slice(3, 9) : STUDIO_CREATIONS;
if (recent.length) {
  document.getElementById('gallery-strip').innerHTML = recent.map((g) => `
    <a href="/gallery" data-reveal>${photo(g)}</a>`).join('');
  document.getElementById('gallery-section').hidden = false;
}

reveal();
