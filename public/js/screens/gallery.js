import { api, esc, reveal } from '/js/common.js';
import { SIGNATURE_DESIGNS } from '/js/designs.js';
import { renderCakeSnapshot, releaseSnapshots } from '/js/cake3d.js';

const grid3d = document.getElementById('gallery-3d-grid');
const gridPhotos = document.getElementById('gallery');
const photosHead = document.getElementById('gallery-photos-head');
const box = document.getElementById('lightbox');

const FALLBACK_PHOTOS = [
  { src: '/img/studio-cake-craft.jpg', caption: 'Multi-layered celebration sponge finished with glossy dark drip & wild berries' },
  { src: '/img/studio-chocolatier-bench.jpg', caption: 'Tempering dark couverture and hand-glazing in our pastry kitchen' },
  { src: '/img/studio-atelier-table.jpg', caption: 'Keepsake linen gift box paired with warm crepes and ganache gateau' },
  { src: '/img/onboarding-box.jpg', caption: 'Assorted artisanal pralines in our satin-tied keepsake gift box' },
  { src: '/img/onboarding-kunafa.jpg', caption: 'Handcrafted Pistachio Kunafa Crunch bar roasted daily' },
  { src: '/img/onboarding-crepe.jpg', caption: 'Warm Belgian chocolate crepe drizzled to order' },
];

let photos = [];
try {
  photos = await api('/api/gallery');
} catch {
  photos = [];
}

let activeFilter = 'all';
const snapCache = new Map();

function getDisplayPhotos() {
  if (photos.length) {
    return photos.map((p) => ({
      src: `/uploads/${p.image}`,
      caption: p.caption || 'Fresh from the SAVORY kitchen',
    }));
  }
  return FALLBACK_PHOTOS;
}

function filterDesigns() {
  if (activeFilter === 'all') return SIGNATURE_DESIGNS;
  if (activeFilter === 'romance') return SIGNATURE_DESIGNS.filter((d) => d.category === 'romance' || d.category === 'celebration');
  return SIGNATURE_DESIGNS.filter((d) => d.category === activeFilter);
}

async function renderLookbook() {
  const list = filterDesigns();
  grid3d.innerHTML = list.map((d, i) => `
    <article class="card design-card choco-product-card" data-reveal style="--delay: ${(i % 3) * 0.06}s">
      <div class="design-stage choco-product-frame" data-lb-design="${esc(d.id)}" role="button" tabindex="0" aria-label="Inspect ${esc(d.name)}">
        <span class="choco-price-badge">${d.cake.tiers} TIER${d.cake.tiers > 1 ? 'S' : ''}<br><strong>3D STUDIO</strong></span>
        <span class="quickview-hint">Zoom 3D</span>
        <img data-snap="${esc(d.id)}" src="${esc(snapCache.get(d.id) || '/img/cake.svg')}" alt="${esc(d.name)}">
      </div>
      <div class="choco-title-bar">${esc(d.name)}</div>
      <p class="muted choco-card-desc">${esc(d.description)}</p>
      <div style="display:flex;gap:12px;justify-content:center;align-items:center;">
        <a class="choco-buy-link" href="/cakes?design=${encodeURIComponent(d.id)}">CUSTOMIZE IN 3D →</a>
      </div>
    </article>
  `).join('');
  reveal(grid3d);

  for (const d of list) {
    if (!snapCache.has(d.id)) {
      const url = await renderCakeSnapshot(d.cake, { width: 520, height: 420 });
      if (url) snapCache.set(d.id, url);
    }
    const img = grid3d.querySelector(`[data-snap="${d.id}"]`);
    if (img && snapCache.has(d.id)) img.src = snapCache.get(d.id);
  }
  releaseSnapshots();
}

await renderLookbook();

const displayPhotos = getDisplayPhotos();
if (displayPhotos.length) {
  if (photosHead) photosHead.hidden = false;
  gridPhotos.hidden = false;
  gridPhotos.innerHTML = displayPhotos.map((p, i) => `
    <figure tabindex="0" data-index="${i}" data-reveal style="--delay: ${(i % 3) * 0.08}s">
      <img src="${esc(p.src)}" alt="${esc(p.caption)}" loading="lazy">
      ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
    </figure>`).join('');
  reveal(gridPhotos);
} else {
  gridPhotos.hidden = true;
}

document.getElementById('gallery-filters')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-gfilter]');
  if (!btn) return;
  activeFilter = btn.dataset.gfilter;
  document.querySelectorAll('[data-gfilter]').forEach((b) => b.classList.toggle('active', b === btn));
  renderLookbook();
});

// Unified Lightbox for both 3D Signature Creations and Kitchen Photos
let lbItems = [];
let lbIndex = 0;

function rebuildLightboxList() {
  const designItems = filterDesigns().map((d) => ({
    src: snapCache.get(d.id) || '/img/cake.svg',
    caption: `${d.name} — ${d.description}`,
    cta: `/cakes?design=${encodeURIComponent(d.id)}`,
  }));
  const photoItems = getDisplayPhotos().map((p) => ({
    src: p.src,
    caption: p.caption,
    cta: '/cakes',
  }));
  lbItems = [...designItems, ...photoItems];
}

function showLightbox(i) {
  rebuildLightboxList();
  if (!lbItems.length) return;
  lbIndex = (i + lbItems.length) % lbItems.length;
  const item = lbItems[lbIndex];
  const lbImg = document.getElementById('lb-img');
  lbImg.src = item.src;
  lbImg.alt = item.caption;
  lbImg.hidden = false;
  document.getElementById('lb-caption').textContent = item.caption;
  const act = document.getElementById('lb-actions');
  if (act) {
    act.innerHTML = `<a class="btn btn-gold btn-sm" href="${esc(item.cta)}">Customize this design in 3D →</a>`;
  }
  box.querySelectorAll('.nav').forEach((b) => { b.hidden = lbItems.length < 2; });
}

grid3d.addEventListener('click', (e) => {
  const stage = e.target.closest('[data-lb-design]');
  if (!stage) return;
  const list = filterDesigns();
  const idx = list.findIndex((d) => d.id === stage.dataset.lbDesign);
  if (idx >= 0) {
    showLightbox(idx);
    box.showModal();
  }
});

gridPhotos.addEventListener('click', (e) => {
  const fig = e.target.closest('figure');
  if (fig) {
    showLightbox(filterDesigns().length + Number(fig.dataset.index));
    box.showModal();
  }
});

gridPhotos.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const fig = e.target.closest('figure');
  if (fig) {
    e.preventDefault();
    showLightbox(filterDesigns().length + Number(fig.dataset.index));
    box.showModal();
  }
});

box.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || e.target === box) box.close();
  const step = e.target.closest('[data-step]');
  if (step) showLightbox(lbIndex + Number(step.dataset.step));
});

box.addEventListener('close', () => {
  const lbImg = document.getElementById('lb-img');
  if (lbImg) lbImg.hidden = true;
});

box.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
  if (e.key === 'ArrowLeft') showLightbox(lbIndex - 1);
});
