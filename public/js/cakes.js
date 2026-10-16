import {
  api, esc, money, isoDate, friendlyDate, friendlyTime, loadSettings, setupFulfillment, deliveryFee,
} from '/js/common.js';
import { createCakeStage } from '/js/cake3d.js';

const SHAPE_ICONS = {
  round: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="20" cy="13" rx="14" ry="5"/><path d="M6 13v14c0 2.8 6.3 5 14 5s14-2.2 14-5V13"/></svg>',
  square: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 14l14-6 14 6-14 6z"/><path d="M6 14v13l14 6 14-6V14M20 20v13"/></svg>',
  heart: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 33S6 24.5 6 15a7 7 0 0 1 14-1.5A7 7 0 0 1 34 15c0 9.5-14 18-14 18z"/></svg>',
};
const TIER_ICONS = {
  1: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="20" width="26" height="12" rx="2"/></svg>',
  2: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="22" width="28" height="11" rx="2"/><rect x="11" y="12" width="18" height="10" rx="2"/></svg>',
  3: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="25" width="30" height="9" rx="2"/><rect x="10" y="16" width="20" height="9" rx="2"/><rect x="14" y="7" width="12" height="9" rx="2"/></svg>',
};

const form = document.getElementById('cake-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('form-error');
const messageInput = document.getElementById('message');

const stage = createCakeStage(document.getElementById('cake-stage'));
const settings = await loadSettings();
let ordersOpen = settings.orders_open !== '0';

const leadDays = Number(settings.cake_lead_days) || 0;
form.pickup_date.min = isoDate(leadDays);
form.pickup_date.max = isoDate(180);
form.pickup_date.value = isoDate(leadDays);
document.getElementById('date-hint').textContent = leadDays > 0 ? `Earliest: ${friendlyDate(form.pickup_date.min)}.` : '';

let groups = [];
try {
  ({ groups } = await api('/api/cake-options'));
} catch (err) {
  form.querySelector('[data-groups]').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  ordersOpen = false;
}
groups = groups.filter((g) => g.options.length);
const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
const optionById = new Map(groups.flatMap((g) => g.options.map((o) => [String(o.id), o])));

// ---------- render the choices ----------

function cost(group, o) {
  if (group.key === 'size') return money(o.price_cents);
  return o.price_cents ? `+ ${money(o.price_cents)}` : 'Included';
}

function renderChoice(group, o, index) {
  const type = group.mode === 'multi' ? 'checkbox' : 'radio';
  const checked = group.mode === 'single' && index === 0 ? 'checked' : '';
  const input = `<input type="${type}" name="${group.key}" value="${o.id}" ${checked}>`;

  if (group.key === 'color' || group.key === 'drip') {
    const dotClass = !o.color ? 'none' : o.visual === 'metallic' ? 'metallic' : '';
    return `
      <label class="choice swatch">${input}
        <span class="dot ${dotClass}" style="${o.color ? `background:${esc(o.color)}` : ''}"></span>
        <span class="name">${esc(o.name)}</span>
        <span class="cost">${cost(group, o)}</span>
      </label>`;
  }
  const icon = group.key === 'shape' ? SHAPE_ICONS[o.visual] || '' : group.key === 'tiers' ? TIER_ICONS[o.visual] || '' : '';
  return `
    <label class="choice">${input}
      ${icon}
      <span class="name">${esc(o.name)}</span>
      ${o.description ? `<span class="meta">${esc(o.description)}</span>` : ''}
      <span class="cost">${cost(group, o)}</span>
    </label>`;
}

form.querySelectorAll('[data-groups]').forEach((container) => {
  container.innerHTML = container.dataset.groups.split(',').map((key) => {
    const group = byKey[key];
    if (!group) return '';
    const layout = key === 'color' || key === 'drip' ? 'swatches' : 'choices';
    return `
      <div class="group" role="${group.mode === 'single' ? 'radiogroup' : 'group'}" aria-label="${esc(group.label)}">
        <div class="group-title"><span class="label">${esc(group.label)}</span><span class="chosen" data-chosen="${key}"></span></div>
        <div class="${layout}">${group.options.map((o, i) => renderChoice(group, o, i)).join('')}</div>
      </div>`;
  }).join('') || '<p class="muted">No options available right now.</p>';
});

if (!groups.length) ordersOpen = false;
if (!ordersOpen) {
  document.getElementById('closed-notice').hidden = settings.orders_open !== '0';
  submitBtn.disabled = true;
}

// ---------- state → 3D cake, summary and price ----------

function selected(key) {
  const inputs = [...form.querySelectorAll(`input[name="${key}"]:checked`)];
  return inputs.map((i) => optionById.get(i.value)).filter(Boolean);
}

function cakeConfig() {
  const one = (key) => selected(key)[0];
  const sizes = byKey.size?.options || [];
  const sizeIndex = Math.max(0, sizes.indexOf(one('size')));
  return {
    shape: one('shape')?.visual || 'round',
    tiers: Number(one('tiers')?.visual) || 1,
    size: sizes.length > 1 ? 0.85 + (sizeIndex / (sizes.length - 1)) * 0.35 : 1,
    color: one('color')?.color || '#f3e6d3',
    drip: one('drip')?.color || '',
    dripMetallic: one('drip')?.visual === 'metallic',
    toppings: selected('toppings').map((o) => o.visual).filter(Boolean),
    extras: selected('extras').map((o) => o.visual).filter(Boolean),
    message: messageInput.value.trim(),
  };
}

let fulfillment = () => 'pickup';

function update({ redraw = true } = {}) {
  if (redraw) stage?.setCake(cakeConfig());
  document.getElementById('message-count').textContent = `${messageInput.value.length} / 60 · shown on a chocolate plaque`;

  let subtotal = 0;
  const rows = [];
  for (const group of groups) {
    const chosen = selected(group.key);
    const label = form.querySelector(`[data-chosen="${group.key}"]`);
    if (label) label.textContent = group.mode === 'single' ? chosen[0]?.name || '' : chosen.length ? `${chosen.length} selected` : 'Optional';
    for (const o of chosen) {
      subtotal += o.price_cents;
      rows.push(`<li><span class="k">${esc(group.label)}: ${esc(o.name)}</span><span class="v">${group.key === 'size' ? money(o.price_cents) : o.price_cents ? `+ ${money(o.price_cents)}` : '—'}</span></li>`);
    }
  }
  const message = messageInput.value.trim();
  if (message) rows.push(`<li><span class="k">Message: “${esc(message)}”</span><span class="v">—</span></li>`);

  const fee = deliveryFee(settings, fulfillment());
  const total = subtotal + fee;
  document.getElementById('summary').innerHTML = rows.join('');
  document.getElementById('fee-rows').innerHTML = fee
    ? `<div class="sum-row"><span>Delivery</span><span>${money(fee)}</span></div>` : '';
  const sized = selected('size').length > 0 || !byKey.size;
  document.getElementById('total').textContent = sized ? money(total) : '—';
  document.getElementById('preview-total').textContent = sized ? money(total) : '—';
  document.getElementById('bar-total').textContent = sized ? money(total) : '';
  document.getElementById('preview-title').textContent = [selected('size')[0]?.name, selected('shape')[0]?.name, selected('tiers')[0]?.name]
    .filter(Boolean).join(' · ') || 'Custom cake';
}

fulfillment = setupFulfillment(form, settings, () => update({ redraw: false }));

let messageTimer = 0;
form.addEventListener('change', (e) => {
  if (e.target.name === 'fulfillment') return;
  update({ redraw: Boolean(optionById.get(e.target.value)) });
});
messageInput.addEventListener('input', () => {
  update({ redraw: false });
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => stage?.setCake(cakeConfig()), 350);
});
update();

const bar = document.getElementById('bottom-bar');
const summaryStep = document.getElementById('summary-step');
new IntersectionObserver(([entry]) => bar.classList.toggle('show', !entry.isIntersecting && entry.boundingClientRect.top > 0))
  .observe(summaryStep);

// ---------- submit ----------

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form));
  for (const group of groups) {
    const ids = selected(group.key).map((o) => o.id);
    data[group.key] = group.mode === 'single' ? ids[0] : ids;
  }
  data.fulfillment = fulfillment();

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Placing your order…';
  try {
    const order = await api('/api/orders/cake', { method: 'POST', body: data });
    showConfirmation(order, data.customer_name);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place cake order';
  }
});

function showConfirmation(order, name) {
  const firstName = name.trim().split(/\s+/)[0];
  const delivery = order.fulfillment === 'delivery';
  bar.remove();
  document.getElementById('builder-col').innerHTML = `
    <div class="card confirm" style="margin: 0;">
      <span class="script" style="font-size: 2.4rem;">Thank you</span>
      <h1 style="font-size: 2.6rem;">${esc(firstName)}, your cake is ordered!</h1>
      <p class="muted">Your order number is</p>
      <div class="order-code">${esc(order.code)}</div>
      <p><strong>${delivery ? 'Delivery' : 'Pickup'}:</strong> ${esc(friendlyDate(order.pickup_date))} at ${esc(friendlyTime(order.pickup_time))}
        ${delivery ? `<br><span class="muted">${esc(order.delivery_address)}</span>` : ''}<br>
        <strong>Total due on ${delivery ? 'delivery' : 'pickup'}:</strong> ${money(order.total_cents)}</p>
      <p class="muted">We'll be in touch if we have any questions about your design.</p>
      <div class="hero-actions" style="justify-content: center; margin-top: 24px;">
        <a class="btn btn-gold" href="/">Back to home</a>
        <a class="btn btn-outline" href="/menu">Browse the menu</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
