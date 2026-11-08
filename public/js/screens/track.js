import { api, esc, money, friendlyDate } from '/js/common.js';

const STAGES = [
  { key: 'new', label: 'Order received', desc: 'Your order is in our queue and awaiting confirmation from the branch.' },
  { key: 'confirmed', label: 'Confirmed', desc: 'Our pastry team has confirmed your order and scheduled your bake.' },
  { key: 'baking', label: 'In the kitchen', desc: 'Your order is being freshly baked, layered, and decorated right now.' },
  { key: 'ready', label: 'Ready!', desc: 'Freshly boxed and ready for pickup (or on its way to your door).' },
  { key: 'completed', label: 'Completed', desc: 'Picked up & delivered — thank you for celebrating with SAVORY!' },
];

const form = document.getElementById('track-form');
const input = document.getElementById('track-input');
const errorBox = document.getElementById('track-error');
const resultCard = document.getElementById('track-result');
let pollTimer = 0;

function friendlyTime(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

async function lookup(code, { quiet = false } = {}) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return;
  if (!quiet) errorBox.hidden = true;
  try {
    const order = await api(`/api/orders/track/${encodeURIComponent(clean)}`);
    renderOrder(order);
    const url = new URL(location.href);
    url.searchParams.set('code', order.code);
    history.replaceState(null, '', url);
  } catch (err) {
    if (!quiet) {
      resultCard.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  }
}

function renderOrder(order) {
  resultCard.hidden = false;
  document.getElementById('t-code').textContent = order.code;
  document.getElementById('t-type').textContent = order.type === 'cake' ? '3D Custom Cake Order' : 'Patisserie Menu Order';
  document.getElementById('t-greeting').textContent = `${order.customer_first_name}’s Order`;

  const mode = order.fulfillment === 'delivery' ? 'Delivery' : `Pickup${order.branch ? ` (${order.branch})` : ''}`;
  document.getElementById('t-schedule').textContent = `${mode} · ${friendlyDate(order.pickup_date)} at ${friendlyTime(order.pickup_time)}`;

  const stepsEl = document.getElementById('t-steps');
  const bannerEl = document.getElementById('t-banner');

  if (order.status === 'cancelled') {
    stepsEl.innerHTML = '';
    bannerEl.className = 'alert alert-error';
    bannerEl.textContent = 'This order was cancelled. Please contact our branch on WhatsApp if you need help.';
  } else {
    const activeIdx = Math.max(0, STAGES.findIndex((s) => s.key === order.status));
    stepsEl.innerHTML = STAGES.slice(0, 4).map((s, idx) => {
      const done = idx < activeIdx || order.status === 'completed';
      const current = idx === activeIdx && order.status !== 'completed';
      return `
        <div class="track-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
          <span class="track-dot">${done ? '✓' : idx + 1}</span>
          <span class="track-label">${esc(s.label)}</span>
        </div>`;
    }).join('');
    const currentStage = STAGES[activeIdx] || STAGES[0];
    bannerEl.className = 'track-status-banner';
    bannerEl.innerHTML = `<strong>${esc(currentStage.label)}:</strong> ${esc(currentStage.desc)}`;
  }

  document.getElementById('t-items').innerHTML = (order.items || []).map((it) => {
    const details = Object.entries(it.details || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    return `
      <li>
        <div>
          <span class="k"><strong>${it.quantity} × ${esc(it.name)}</strong></span>
          ${details ? `<div class="muted small">${esc(details)}</div>` : ''}
        </div>
        <span class="v">${money(it.unit_price_cents * it.quantity)}</span>
      </li>`;
  }).join('');

  document.getElementById('t-total').textContent = money(order.total_cents);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearInterval(pollTimer);
  const code = input.value.trim();
  lookup(code);
  pollTimer = setInterval(() => lookup(code, { quiet: true }), 20000);
});

const pathMatch = location.pathname.match(/^\/track\/([^/]+)$/);
const initialCode = pathMatch?.[1] || new URLSearchParams(location.search).get('code');
if (initialCode) {
  input.value = decodeURIComponent(initialCode).toUpperCase();
  lookup(input.value);
  pollTimer = setInterval(() => lookup(input.value, { quiet: true }), 20000);
}


// Keep Menu Website customers inside the Menu navigation experience when tracking their order
function applyMenuSiteChrome() {
  const nav = document.getElementById('site-nav');
  if (nav) {
    nav.innerHTML = `
      <a href="/" data-i18n="nav_menu">Menu</a>
      <a href="/#box-banner" data-i18n="nav_boxes">Gift Boxes</a>
      <a href="/#what-we-make" data-i18n="nav_specialties">Specialties</a>
      <a href="/track" aria-current="page" data-i18n="nav_track">Track Order</a>
      <a href="/#visit-section" data-i18n="foot_visit">Visit Us</a>
    `;
  }
  const cta = document.querySelector('.header-cta');
  if (cta) {
    cta.href = '/';
    cta.textContent = 'Back to menu';
  }
  document.querySelectorAll('.brand').forEach((b) => { b.href = '/'; });
}

if (new URLSearchParams(location.search).get('site') === 'menu') {
  applyMenuSiteChrome();
}
