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
const photo = (g, { eager = false } = {}) => `<img src="/uploads/${esc(g.image)}" alt="${esc(g.caption || '')}"${eager ? '' : ' loading="lazy"'}>`;

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

if (gallery[1]) cakesTile.innerHTML = photo(gallery[1]);

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
        ? `<img src="/uploads/${esc(item.image)}" alt="" loading="lazy">`
        : `<div class="at-art">${illustrationFor(item)}</div>`}</div>
      <div class="at-product-row">
        <h3>${esc(item.name)}</h3>
        <span class="at-price">${money(item.price_cents)}</span>
      </div>
      ${item.description ? `<p>${esc(item.description)}</p>` : ''}
    </a>`).join('');
  document.getElementById('loved').hidden = false;
}

// Without a photo, the chocolates tile shows an illustration the "Most loved" cards don't already use.
if (gallery[2]) menuTile.innerHTML = photo(gallery[2]);
else {
  const used = new Set(picks.filter((p) => !p.image).map((p) => illustrationFor(p)));
  const pick = menu.find((m) => !used.has(illustrationFor(m)) && /chocolate|bark|bar|kunafa|truffle/i.test(`${m.name} ${m.category}`))
    || menu.find((m) => !used.has(illustrationFor(m)));
  menuTile.innerHTML = `<div class="at-art">${illustrationFor(pick || { name: 'Chocolate' })}</div>`;
}

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
    if (d.id === showcase.id && !gallery[1]) cakesTile.innerHTML = `<div class="at-render">${img}</div>`;
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

if (reviews.length) {
  let index = 0;
  const show = () => {
    const r = reviews[index];
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

// ---------- Recent creations (photos after the three used above) ----------

const recent = gallery.length > 3 ? gallery.slice(3, 9) : [];
if (recent.length) {
  document.getElementById('gallery-strip').innerHTML = recent.map((g) => `
    <a href="/gallery" data-reveal>${photo(g)}</a>`).join('');
  document.getElementById('gallery-section').hidden = false;
}

reveal();
