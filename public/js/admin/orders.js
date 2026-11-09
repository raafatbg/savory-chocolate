import { $, esc, money, isoDate, friendlyTime, adminApi, toast, errorBlock, emptyCard } from './core.js';

const FILTERS = [
  ['active', 'Active'], ['new', 'New'], ['confirmed', 'Confirmed'], ['baking', 'In kitchen'], ['ready', 'Ready'],
  ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All'],
];
const STATUS_LABELS = {
  new: 'New', confirmed: 'Confirmed', baking: 'In kitchen', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
};
const NEXT_STEP = {
  new: ['confirmed', 'Confirm order'],
  confirmed: ['baking', 'Start baking'],
  baking: ['ready', 'Mark ready'],
  ready: ['completed', 'Mark completed'],
};
const DETAIL_LABELS = {
  shape: 'Shape', size: 'Size', tiers: 'Tiers', flavor: 'Flavor', filling: 'Filling', frosting: 'Frosting',
  color: 'Color', drip: 'Drip', toppings: 'Toppings', extras: 'Extras', dietary: 'Dietary', message: 'Message',
};

let filter = 'active';
let branchFilter = '';
let orderSearch = '';
let branchesLoaded = false;
let currentOrders = [];

// Fills the branch filter once (only shown when there's more than one branch).
async function loadBranchFilter() {
  if (branchesLoaded) return;
  branchesLoaded = true;
  try {
    const branches = await adminApi('/branches');
    const select = $('#order-branch');
    select.innerHTML = '<option value="">All branches</option>'
      + branches.map((b) => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
    select.hidden = branches.length < 2;
  } catch { /* filter stays hidden */ }
}

export async function load() {
  loadBranchFilter();
  let data;
  try {
    data = await adminApi(`/orders?status=${filter}`);
  } catch (err) {
    if (err.status !== 401) $('#orders-list').innerHTML = errorBlock(err);
    return;
  }
  const { counts } = data;
  let orders = branchFilter ? data.orders.filter((o) => o.branch === branchFilter) : data.orders;
  if (orderSearch) {
    orders = orders.filter((o) => {
      const hay = `${o.code} ${o.customer_name} ${o.customer_phone} ${o.branch || ''} ${(o.items || []).map((i) => i.name).join(' ')}`.toLowerCase();
      return hay.includes(orderSearch);
    });
  }
  currentOrders = orders;
  const n = (s) => counts[s] || 0;
  const filterCounts = {
    ...counts,
    active: n('new') + n('confirmed') + n('baking') + n('ready'),
    all: Object.values(counts).reduce((a, b) => a + b, 0),
  };

  // Render Executive Patisserie KPI Strip
  const kpiEl = $('#orders-kpi');
  if (kpiEl) {
    const today = isoDate(0);
    const dueToday = orders.filter((o) => o.pickup_date === today && o.status !== 'cancelled').length;
    const revenueCents = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total_cents || 0), 0);
    const cakesCount = orders.filter((o) => o.type === 'cake').length;
    kpiEl.innerHTML = `
      <div class="card kpi-card"><span class="kpi-label">Active Kitchen Queue</span><strong class="kpi-val">${filterCounts.active}</strong></div>
      <div class="card kpi-card"><span class="kpi-label">Scheduled Today</span><strong class="kpi-val">${dueToday}</strong></div>
      <div class="card kpi-card"><span class="kpi-label">View Order Value</span><strong class="kpi-val">${money(revenueCents)}</strong></div>
      <div class="card kpi-card"><span class="kpi-label">3D Cakes / Menu</span><strong class="kpi-val">${cakesCount} / ${Math.max(0, orders.length - cakesCount)}</strong></div>
    `;
  }

  $('#order-filters').innerHTML = FILTERS.map(([key, label]) => `
    <button type="button" data-filter="${key}" aria-pressed="${key === filter}">
      ${label}<span class="count">${filterCounts[key] || 0}</span>
    </button>`).join('');

  const label = FILTERS.find(([k]) => k === filter)[1].toLowerCase();
  $('#orders-list').innerHTML = orders.length
    ? `<div class="orders">${orders.map(orderCard).join('')}</div>`
    : emptyCard('📭', `No ${filter === 'all' ? '' : `${label} `}orders.`);

  $('#orders-updated').textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · checks for new orders every 30 seconds`;
}

function buildCustomerWhatsAppHref(o) {
  const digits = String(o.customer_phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const cleanDigits = digits.startsWith('0') ? `961${digits.slice(1)}` : digits.length <= 8 ? `961${digits}` : digits;
  const firstName = String(o.customer_name || '').trim().split(/\s+/)[0] || 'there';
  const siteBase = (o.type === 'menu' ? document.body.dataset.menuUrl : document.body.dataset.cakesUrl) || location.origin;
  const trackUrl = `${siteBase.replace(/\/$/, '')}/track?code=${encodeURIComponent(o.code)}`;
  const statusMsg = {
    new: `Hi ${firstName}! Thank you for your SAVORY order (${o.code}). We have received it and will confirm shortly.`,
    confirmed: `Hi ${firstName}! Your SAVORY order (${o.code}) is confirmed for ${o.pickup_date} at ${friendlyTime(o.pickup_time)}. Track live: ${trackUrl}`,
    baking: `Hi ${firstName}! Great news — our pastry chefs are preparing your SAVORY order (${o.code}) in the kitchen right now! Track live: ${trackUrl}`,
    ready: o.fulfillment === 'delivery'
      ? `Hi ${firstName}! Your SAVORY order (${o.code}) is freshly boxed and ready for delivery! Total due: ${money(o.total_cents)}.`
      : `Hi ${firstName}! Your SAVORY order (${o.code}) is ready for pickup${o.branch ? ` at our ${o.branch} branch` : ''}! Total due: ${money(o.total_cents)}.`,
    completed: `Hi ${firstName}! Thank you for celebrating with SAVORY (${o.code}). We hope you love every bite!`,
  }[o.status] || `Hi ${firstName}! Regarding your SAVORY order (${o.code}):`;
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(statusMsg)}`;
}

function printKitchenSheet(o) {
  const delivery = o.fulfillment === 'delivery';
  const [y, m, d] = o.pickup_date.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const win = window.open('', '_blank', 'width=720,height=860');
  if (!win) return;
  const itemsHtml = o.items.map((i) => {
    const details = Object.entries(i.details || {}).filter(([, v]) => v);
    return `
      <div class="ticket-item">
        <div class="ticket-line"><strong>${i.quantity} × ${esc(i.name)}</strong><span>${money(i.unit_price_cents * i.quantity)}</span></div>
        ${details.length ? `<table class="ticket-specs">${details.map(([k, v]) => `
          <tr><th>${esc(DETAIL_LABELS[k] || k)}</th><td>${k === 'message' ? `“${esc(v)}”` : esc(v)}</td></tr>`).join('')}</table>` : ''}
      </div>`;
  }).join('');

  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kitchen Prep Sheet · ${esc(o.code)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #2b1205; background: #fff; margin: 24px; line-height: 1.45; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4C2007; padding-bottom: 14px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 26px; letter-spacing: 0.08em; color: #4C2007; }
    .code { font-family: monospace; font-size: 24px; font-weight: 800; border: 2px solid #4C2007; padding: 4px 12px; border-radius: 6px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #F7F7D3; padding: 14px 18px; border-radius: 8px; margin-bottom: 18px; }
    .meta strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #6E462C; }
    .ticket-item { border: 1px solid #d8cfa8; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .ticket-line { display: flex; justify-content: space-between; font-size: 17px; margin-bottom: 8px; }
    .ticket-specs { width: 100%; border-collapse: collapse; font-size: 14px; }
    .ticket-specs th, .ticket-specs td { text-align: left; padding: 5px 8px; border-top: 1px solid #eee7c8; }
    .ticket-specs th { width: 32%; color: #6E462C; font-weight: 600; }
    .notes { background: #fff4e5; border-left: 4px solid #b5541a; padding: 10px 14px; margin-top: 14px; }
    .foot { display: flex; justify-content: space-between; border-top: 2px solid #4C2007; padding-top: 12px; margin-top: 18px; font-size: 18px; font-weight: 700; }
    @media print { .no-print { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="head">
    <div>
      <h1>SAVORY · KITCHEN PREP SHEET</h1>
      <div>${o.type === 'cake' ? '3D Custom Cake Order' : 'Patisserie Menu Order'}${o.branch ? ` · ${esc(o.branch)} Branch` : ''}</div>
    </div>
    <div class="code">${esc(o.code)}</div>
  </div>
  <div class="meta">
    <div><strong>${delivery ? 'Delivery schedule' : 'Pickup schedule'}</strong>${esc(day)} at ${esc(friendlyTime(o.pickup_time))}</div>
    <div><strong>Customer</strong>${esc(o.customer_name)} · ${esc(o.customer_phone)}</div>
    ${delivery ? `<div style="grid-column: 1 / -1"><strong>Delivery address</strong>${esc(o.delivery_address)}</div>` : ''}
  </div>
  ${itemsHtml}
  ${o.notes ? `<div class="notes"><strong>Special / Allergy Notes:</strong> ${esc(o.notes)}</div>` : ''}
  <div class="foot">
    <span>Status: ${esc(STATUS_LABELS[o.status] || o.status)}</span>
    <span>Total Due: ${money(o.total_cents)}</span>
  </div>
  <p class="no-print" style="margin-top:20px;text-align:right">
    <button onclick="window.print()" style="padding:8px 18px;font-weight:700;background:#4C2007;color:#F7F7D3;border:0;border-radius:6px;cursor:pointer">Print Sheet</button>
  </p>
  <script>setTimeout(() => window.print(), 250);</script>
</body>
</html>`);
  win.document.close();
}

function orderCard(o) {
  const today = isoDate(0);
  const active = ['new', 'confirmed', 'baking', 'ready'].includes(o.status);
  const delivery = o.fulfillment === 'delivery';
  const [y, m, d] = o.pickup_date.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  let flag = '';
  if (o.pickup_date === today) flag = '<span class="pill today">Today</span>';
  else if (active && o.pickup_date < today) flag = '<span class="pill overdue">Date has passed</span>';

  const dietary = o.items.some((i) => i.details?.dietary);
  const items = o.items.map((i) => {
    const details = Object.entries(i.details || {}).filter(([, v]) => v);
    return `
      <li>
        <div class="line"><span><span class="q">${i.quantity}×</span>${esc(i.name)}</span><span>${money(i.unit_price_cents * i.quantity)}</span></div>
        ${details.length ? `<dl class="details">${details.map(([k, v]) => `
          <dt>${esc(DETAIL_LABELS[k] || k)}</dt>
          <dd class="${k === 'dietary' ? 'flag' : ''}">${k === 'message' ? `“${esc(v)}”` : esc(v)}</dd>`).join('')}</dl>` : ''}
      </li>`;
  }).join('');

  const next = NEXT_STEP[o.status];
  const phoneHref = o.customer_phone.replace(/[^\d+]/g, '');
  const waHref = buildCustomerWhatsAppHref(o);

  return `
    <article class="card order-card st-${o.status}">
      <div class="order-top">
        <div class="ids">
          <span class="order-code-sm">${esc(o.code)}</span>
          ${o.type === 'cake' ? '<span class="pill cake"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/></svg>Custom cake</span>' : '<span class="pill">Menu order</span>'}
          ${o.branch ? `<span class="pill branch"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:3px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${esc(o.branch)}</span>` : ''}
          ${delivery ? '<span class="pill delivery"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Delivery</span>' : '<span class="pill">Pickup</span>'}
          ${dietary ? '<span class="pill warn"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:3px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Dietary needs</span>' : ''}
          <span class="pill st-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
        </div>
        <div class="when">${flag} ${delivery ? 'Deliver' : 'Pickup'} ${esc(day)} · ${esc(friendlyTime(o.pickup_time))}</div>
      </div>
      <div class="order-body">
        <div class="customer">
          <p class="cname">${esc(o.customer_name)}</p>
          <p><a href="tel:${esc(phoneHref)}">${esc(o.customer_phone)}</a></p>
          ${o.customer_email ? `<p><a href="mailto:${esc(o.customer_email)}">${esc(o.customer_email)}</a></p>` : ''}
          ${delivery ? `<p class="address">${esc(o.delivery_address)}</p>` : ''}
          <p class="muted small" style="margin-top: 8px;">Placed ${esc(timeAgo(o.created_at))}</p>
        </div>
        <div>
          <ul class="order-items">${items}</ul>
          ${o.notes ? `<p class="order-notes"><strong>Notes:</strong> ${esc(o.notes)}</p>` : ''}
          ${o.reference_image ? `<a class="ref-photo" href="/uploads/${esc(o.reference_image)}" target="_blank" rel="noopener"><img src="/uploads/${esc(o.reference_image)}" alt="Customer's inspiration photo" loading="lazy"><span>Inspiration photo · open full size</span></a>` : ''}
        </div>
      </div>
      <div class="order-foot">
        <span class="total">Total ${money(o.total_cents)}
          <span class="muted small">${o.delivery_fee_cents ? `incl. ${money(o.delivery_fee_cents)} delivery · ` : ''}pay on ${delivery ? 'delivery' : 'pickup'}</span></span>
        <div class="controls">
          <button type="button" class="btn btn-outline btn-sm" data-print-order="${o.id}" title="Print kitchen preparation sheet"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Prep sheet</button>
          ${waHref ? `<a class="btn btn-outline btn-sm" href="${esc(waHref)}" target="_blank" rel="noopener" title="Message customer on WhatsApp with current status"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp customer</a>` : ''}
          ${next ? `<button type="button" class="btn btn-gold btn-sm" data-order="${o.id}" data-set-status="${next[0]}">${next[1]}</button>` : ''}
          <label class="visually-hidden" for="status-${o.id}">Status</label>
          <select id="status-${o.id}" data-order="${o.id}" data-status-select>
            ${Object.entries(STATUS_LABELS).map(([k, l]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
    </article>`;
}

function timeAgo(sqliteUtc) {
  const then = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return then.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function setStatus(id, status) {
  try {
    await adminApi(`/orders/${id}`, { method: 'PATCH', body: { status } });
    toast(`Order marked as ${(STATUS_LABELS[status] || status).toLowerCase()}.`);
    document.dispatchEvent(new Event('admin:changed'));
  } catch (err) {
    toast(err.message, true);
  }
  load();
}

$('#order-filters').addEventListener('click', (e) => {
  const button = e.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  load();
});

$('#orders-list').addEventListener('click', (e) => {
  const printBtn = e.target.closest('[data-print-order]');
  if (printBtn) {
    const order = currentOrders.find((o) => String(o.id) === String(printBtn.dataset.printOrder));
    if (order) printKitchenSheet(order);
    return;
  }
  const button = e.target.closest('[data-set-status]');
  if (button) setStatus(button.dataset.order, button.dataset.setStatus);
});

$('#orders-list').addEventListener('change', (e) => {
  const select = e.target.closest('[data-status-select]');
  if (select) setStatus(select.dataset.order, select.value);
});

$('#orders-refresh').addEventListener('click', () => load());
$('#order-branch').addEventListener('change', (e) => {
  branchFilter = e.target.value;
  load();
});
$('#order-search')?.addEventListener('input', (e) => {
  orderSearch = e.target.value.trim().toLowerCase();
  load();
});
