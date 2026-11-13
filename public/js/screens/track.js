import { api, esc, money, friendlyDate, getRecentOrders, rememberOrderCode, loadSettings } from '/js/common.js';

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
const helpWrap = document.getElementById('t-help-wrap');
let pollTimer = 0;
let cachedSettings = null;
loadSettings().then((s) => { cachedSettings = s; }).catch(() => {});

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

function renderRecentOrders(activeCode = '') {
  const box = document.getElementById('recent-orders');
  if (!box) return;
  const list = getRecentOrders();
  if (!list.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <span class="recent-orders-label">Recent orders on this device:</span>
    <div class="recent-orders-pills">
      ${list.map((o) => `
        <button type="button" class="recent-order-chip ${o.code === activeCode ? 'active' : ''}" data-recent-code="${esc(o.code)}">
          <strong>${esc(o.code)}</strong>
        </button>`).join('')}
    </div>`;
}

document.getElementById('recent-orders')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-recent-code]');
  if (!btn) return;
  const code = btn.dataset.recentCode;
  input.value = code;
  clearInterval(pollTimer);
  lookup(code);
  pollTimer = setInterval(() => lookup(code, { quiet: true }), 20000);
});

function renderOrder(order) {
  rememberOrderCode(order.code, order.type === 'cake' ? '3D Cake' : 'Menu Order');
  renderRecentOrders(order.code);
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

  if (helpWrap) {
    const waRaw = cachedSettings?.whatsapp || document.querySelector('.wa-menu a')?.getAttribute('href') || document.querySelector('.wa-float')?.getAttribute('href') || '';
    const waUrl = waRaw.startsWith('http')
      ? waRaw
      : waRaw
        ? `https://wa.me/${waRaw.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello SAVORY! Checking on my order ${order.code}.`)}`
        : '';
    if (waUrl) {
      helpWrap.hidden = false;
      helpWrap.innerHTML = `
        <span class="muted small">Need to adjust pickup timing or gift notes?</span>
        <a class="btn btn-outline btn-sm" href="${esc(waUrl)}" target="_blank" rel="noopener">WhatsApp branch desk</a>`;
    } else {
      helpWrap.hidden = true;
    }
  }
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
renderRecentOrders(initialCode ? decodeURIComponent(initialCode).toUpperCase() : '');
if (initialCode) {
  input.value = decodeURIComponent(initialCode).toUpperCase();
  lookup(input.value);
  pollTimer = setInterval(() => lookup(input.value, { quiet: true }), 20000);
} else {
  const latest = getRecentOrders()[0];
  if (latest?.code) {
    input.value = latest.code;
    lookup(latest.code, { quiet: true });
  }
}


// Keep Menu Website customers inside the Menu navigation experience when tracking their order
function applyMenuSiteChrome() {
  const navLinks = document.querySelector('#site-nav .site-nav-links') || document.getElementById('site-nav');
  if (navLinks) {
    navLinks.innerHTML = `
      <a href="/#menu" data-i18n="nav_menu"><span class="nav-num">01</span><span class="nav-text">Menu</span><span class="nav-desc">Featured offers &amp; categories</span></a>
      <a href="/#gift-box" data-i18n="nav_boxes"><span class="nav-num">02</span><span class="nav-text">Gift Boxes</span><span class="nav-desc">9, 16 or 25-piece luxury boxes</span></a>
      <a href="/#cart" data-i18n="nav_cart"><span class="nav-num">03</span><span class="nav-text">Cart</span><span class="nav-desc">Review items &amp; checkout</span></a>
      <a href="/track?site=menu" aria-current="page" data-i18n="nav_track"><span class="nav-num">04</span><span class="nav-text">Track Order</span><span class="nav-desc">Live kitchen preparation status</span></a>
      <a href="/#visit" data-i18n="foot_visit"><span class="nav-num">05</span><span class="nav-text">Branches</span><span class="nav-desc">Aramoun &amp; Aley locations</span></a>
    `;
  }
  const cta = document.querySelector('.header-cta') || document.getElementById('header-cart-btn');
  if (cta) {
    cta.href = '/#menu';
    cta.textContent = 'Back to Menu';
  }
  document.querySelectorAll('.brand').forEach((b) => { b.href = '/#welcome'; });
}

if (new URLSearchParams(location.search).get('site') === 'menu') {
  applyMenuSiteChrome();
}
