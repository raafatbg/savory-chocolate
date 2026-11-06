import { api, esc, reveal } from '/js/common.js';

const grid = document.getElementById('gallery');
let photos = [];
try {
  photos = await api('/api/gallery');
} catch (err) {
  grid.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
}

if (!photos.length && !grid.querySelector('.alert')) {
  grid.hidden = true;
  document.getElementById('gallery-empty').hidden = false;
} else if (photos.length) {
  grid.innerHTML = photos.map((p, i) => `
    <figure tabindex="0" data-index="${i}" data-reveal style="--delay: ${(i % 3) * 0.08}s">
      <img src="/uploads/${esc(p.image)}" alt="${esc(p.caption || 'Cake from our kitchen')}" loading="lazy">
      ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
    </figure>`).join('');
  reveal(grid);
}

const box = document.getElementById('lightbox');
let index = 0;
function show(i) {
  index = (i + photos.length) % photos.length;
  const p = photos[index];
  document.getElementById('lb-img').src = `/uploads/${p.image}`;
  document.getElementById('lb-img').alt = p.caption || 'Cake from our kitchen';
  document.getElementById('lb-caption').textContent = p.caption;
  box.querySelectorAll('.nav').forEach((b) => { b.hidden = photos.length < 2; });
}
grid.addEventListener('click', (e) => {
  const fig = e.target.closest('figure');
  if (fig) { show(Number(fig.dataset.index)); box.showModal(); }
});
grid.addEventListener('keydown', (e) => {
  const fig = e.target.closest('figure');
  if (fig && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(Number(fig.dataset.index)); box.showModal(); }
});
box.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || e.target === box) box.close();
  const step = e.target.closest('[data-step]');
  if (step) show(index + Number(step.dataset.step));
});
box.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') show(index + 1);
  if (e.key === 'ArrowLeft') show(index - 1);
});
