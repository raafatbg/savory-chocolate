import { api, esc, storage, loadSettings, reveal, splitHeadline } from '/js/common.js';
import { createCakeStage, renderCakeSnapshot, releaseSnapshots } from '/js/cake3d.js';
import { SIGNATURE_DESIGNS } from '/js/designs.js';

const HERO_SHOWCASE = [
  {
    name: 'Royal Ganache Crown',
    cake: {
      shape: 'round',
      tiers: 3,
      size: 1,
      tierColors: ['#efe0c9', '#f0c9c2', '#efe0c9'],
      drip: '#2b160d',
      toppings: ['berries', 'goldleaf'],
      extras: ['candles'],
    },
  },
  ...SIGNATURE_DESIGNS.slice(0, 3).map((d) => ({ name: d.name, cake: d.cake })),
];

let heroIndex = 0;

splitHeadline(document.getElementById('hero-title'), { accent: 1 });

const stage = createCakeStage(document.getElementById('hero-stage'), { sparkles: true, float: true, scrollSpin: true });
stage?.setCake(HERO_SHOWCASE[0].cake, { intro: true });

function stepHeroCake(delta) {
  heroIndex = (heroIndex + delta + HERO_SHOWCASE.length) % HERO_SHOWCASE.length;
  const pick = HERO_SHOWCASE[heroIndex];
  stage?.setCake(pick.cake);
  const label = document.getElementById('hero-cake-name');
  if (label) label.textContent = pick.name;
}

document.getElementById('hero-prev')?.addEventListener('click', () => stepHeroCake(-1));
document.getElementById('hero-next')?.addEventListener('click', () => stepHeroCake(1));

// Signature designs: styled with the chocolatier showcase frame, top-right price badge, dark cocoa title bar & BUY/CUSTOMIZE action.
const designsEl = document.getElementById('designs');
const SAMPLE_PRICES = ['$45', '$55', '$65', '$50', '$60', '$75'];
designsEl.innerHTML = SIGNATURE_DESIGNS.map((d, i) => `
  <a class="choco-showcase-card design-card" href="/cakes?design=${d.id}" data-reveal style="--delay: ${i * 0.08}s">
    <div class="choco-frame">
      <span class="choco-price-badge">FROM<br><strong>${SAMPLE_PRICES[i % SAMPLE_PRICES.length]}</strong></span>
      <div class="render loading" data-render="${d.id}"></div>
      <p class="choco-frame-desc">${esc(d.description)}</p>
    </div>
    <div class="choco-title-bar">${esc(d.name)}</div>
    <span class="choco-buy-link">CUSTOMIZE NOW</span>
  </a>`).join('');
reveal(designsEl);

// Renders are cached in the browser, so returning visitors don't pay for them again.
const RENDER_CACHE = 'sc_design_render_v2_';
const renderDesigns = async () => {
  let rendered = false;
  for (const d of SIGNATURE_DESIGNS) {
    const slot = designsEl.querySelector(`[data-render="${d.id}"]`);
    let url = storage.get(RENDER_CACHE + d.id, null);
    if (!url) {
      try {
        url = await renderCakeSnapshot(d.cake, { width: 560, height: 560, type: 'image/webp', quality: 0.86 });
        rendered = true;
        if (url) storage.set(RENDER_CACHE + d.id, url);
      } catch { /* falls back to the illustration below */ }
      await new Promise((r) => setTimeout(r, 30));
    }
    slot.classList.remove('loading');
    slot.innerHTML = `<img src="${url || '/img/cake.svg'}" alt="${esc(d.name)}: ${esc(d.description)}" width="560" height="560">`;
  }
  if (rendered) releaseSnapshots();
};
new IntersectionObserver((entries, observer) => {
  if (entries.some((e) => e.isIntersecting)) {
    observer.disconnect();
    (window.requestIdleCallback || setTimeout)(renderDesigns);
  }
}, { rootMargin: '400px 0px' }).observe(designsEl);

const settings = await loadSettings();
const days = Number(settings.cake_lead_days) || 0;
if (days > 0) {
  document.getElementById('lead-note').textContent = `Please order at least ${days} day${days === 1 ? '' : 's'} ahead.`;
}

const [cake, reviews, gallery] = await Promise.all([
  api('/api/cake-options').catch(() => ({ groups: [] })),
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

if (reviews.length) {
  document.getElementById('reviews').innerHTML = reviews.slice(0, 6).map((r, i) => `
    <figure class="card spotlight review" data-reveal style="--delay: ${(i % 3) * 0.1}s; margin: 0;">
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
