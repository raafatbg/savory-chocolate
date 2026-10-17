import { $, esc, money, isoDate, friendlyTime, adminApi, toast, errorBlock, emptyCard } from './core.js';

const FILTERS = [
  ['active', 'Active'], ['new', 'New'], ['confirmed', 'Confirmed'], ['ready', 'Ready'],
  ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All'],
];
const STATUS_LABELS = {
  new: 'New', confirmed: 'Confirmed', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
};
const NEXT_STEP = {
  new: ['confirmed', 'Confirm order'],
  confirmed: ['ready', 'Mark ready'],
  ready: ['completed', 'Mark completed'],
};
const DETAIL_LABELS = {
  shape: 'Shape', size: 'Size', tiers: 'Tiers', flavor: 'Flavor', filling: 'Filling', frosting: 'Frosting',
  color: 'Color', drip: 'Drip', toppings: 'Toppings', extras: 'Extras', dietary: 'Dietary', message: 'Message',
};

let filter = 'active';
let branchFilter = '';
let branchesLoaded = false;

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
  const orders = branchFilter ? data.orders.filter((o) => o.branch === branchFilter) : data.orders;
  const n = (s) => counts[s] || 0;
  const filterCounts = {
    ...counts,
    active: n('new') + n('confirmed') + n('ready'),
    all: Object.values(counts).reduce((a, b) => a + b, 0),
  };

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

function orderCard(o) {
  const today = isoDate(0);
  const active = ['new', 'confirmed', 'ready'].includes(o.status);
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

  return `
    <article class="card order-card st-${o.status}">
      <div class="order-top">
        <div class="ids">
          <span class="order-code-sm">${esc(o.code)}</span>
          ${o.type === 'cake' ? '<span class="pill cake">🎂 Custom cake</span>' : '<span class="pill">Menu order</span>'}
          ${o.branch ? `<span class="pill branch">📍 ${esc(o.branch)}</span>` : ''}
          ${delivery ? '<span class="pill delivery">🚚 Delivery</span>' : '<span class="pill">Pickup</span>'}
          ${dietary ? '<span class="pill warn">⚠ Dietary needs</span>' : ''}
          <span class="pill st-${o.status}">${STATUS_LABELS[o.status]}</span>
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
    toast(`Order marked as ${STATUS_LABELS[status].toLowerCase()}.`);
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
