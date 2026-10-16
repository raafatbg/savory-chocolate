import { api, esc, money, loadSettings, reveal } from '/js/common.js';
import { createCakeStage } from '/js/cake3d.js';

const HERO_CAKE = {
  shape: 'round',
  tiers: 3,
  size: 1,
  tierColors: ['#efe0c9', '#f0c9c2', '#efe0c9'],
  drip: '#2b160d',
  toppings: ['berries', 'goldleaf'],
  extras: ['candles'],
};

const stage = createCakeStage(document.getElementById('hero-stage'), { sparkles: true, float: true });
stage?.setCake(HERO_CAKE);

const settings = await loadSettings();
const days = Number(settings.cake_lead_days) || 0;
if (days > 0) {
  document.getElementById('lead-note').textContent = `Please order at least ${days} day${days === 1 ? '' : 's'} ahead.`;
}

const [cake, menu, reviews, gallery] = await Promise.all([
  api('/api/cake-options').catch(() => ({ groups: [] })),
  api('/api/menu').catch(() => []),
  api('/api/reviews').catch(() => []),
  api('/api/gallery').catch(() => []),
]);

// A taste of the builder's real options.
const groups = Object.fromEntries(cake.groups.map((g) => [g.key, g.options]));
const cloud = [];
const chipGroup = (label, options, render) => {
  if (options?.length) cloud.push(`<div><div class="group-label">${label}</div><div class="chips">${options.map(render).join('')}</div></div>`);
};
chipGroup('Shapes', groups.shape, (o) => `<span class="chip">${esc(o.name)}</span>`);
chipGroup('Frosting colors', groups.color, (o) => `<span class="chip"><span class="swatch-dot" style="background:${esc(o.color || '#888')}"></span>${esc(o.name)}</span>`);
chipGroup('Drips', groups.drip?.filter((o) => o.color), (o) => `<span class="chip"><span class="swatch-dot" style="background:${o.visual === 'metallic' ? 'var(--gold-grad)' : esc(o.color)}"></span>${esc(o.name)}</span>`);
chipGroup('Toppings', groups.toppings, (o) => `<span class="chip">${esc(o.name)}</span>`);
chipGroup('Flavors', groups.flavor, (o) => `<span class="chip">${esc(o.name)}</span>`);
document.getElementById('option-cloud').innerHTML = cloud.join('') || '<p class="muted">Design your own cake, layer by layer.</p>';

if (menu.length) {
  document.getElementById('favorites-grid').innerHTML = menu.slice(0, 4).map((item, i) => `
    <a class="card menu-card" href="/menu" style="text-decoration: none; color: inherit; --delay: ${i * 0.08}s" data-reveal>
      <div class="thumb">${item.image
        ? `<img src="/uploads/${esc(item.image)}" alt="" loading="lazy">`
        : `<span class="initial" aria-hidden="true">${esc(item.name.charAt(0))}</span>`}</div>
      <div class="body">
        <h3>${esc(item.name)}</h3>
        <p class="desc">${esc(item.description)}</p>
        <span class="price">${money(item.price_cents)}</span>
      </div>
    </a>`).join('');
  document.getElementById('favorites').hidden = false;
}

if (reviews.length) {
  document.getElementById('reviews').innerHTML = reviews.slice(0, 6).map((r, i) => `
    <figure class="card review" data-reveal style="--delay: ${(i % 3) * 0.1}s; margin: 0;">
      <span class="stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
      <blockquote>“${esc(r.text)}”</blockquote>
      <cite>${esc(r.name)}</cite>
    </figure>`).join('');
  document.getElementById('reviews-section').hidden = false;
}

if (gallery.length) {
  document.getElementById('gallery-strip').innerHTML = gallery.slice(0, 6).map((g) => `
    <a href="/gallery" data-reveal><img src="/uploads/${esc(g.image)}" alt="${esc(g.caption)}" loading="lazy"></a>`).join('');
  document.getElementById('gallery-section').hidden = false;
}

reveal();
