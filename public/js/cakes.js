import {
  api, esc, money, isoDate, friendlyDate, friendlyTime, loadSettings, setupFulfillment, deliveryFee, whatsappLink,
} from '/js/common.js';
import { createCakeStage, renderCakeSnapshot, releaseSnapshots } from '/js/cake3d.js';
import { SIGNATURE_DESIGNS } from '/js/designs.js';
import { confetti } from '/js/confetti.js';

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

const baseLeadDays = Number(settings.cake_lead_days) || 0;
form.pickup_date.min = isoDate(baseLeadDays);
form.pickup_date.max = isoDate(180);
form.pickup_date.value = isoDate(baseLeadDays);

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

let sizeScale = 1;

function priceOf(o) {
  if (o.type === 'size' || !o.scales || !o.price_cents || sizeScale === 1) return o.price_cents;
  return Math.round((o.price_cents * sizeScale) / 50) * 50;
}

function cost(group, o) {
  if (group.key === 'size') return money(o.price_cents);
  return o.price_cents ? `+ ${money(priceOf(o))}` : 'Included';
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
        <span class="cost" data-cost="${o.id}">${cost(group, o)}</span>
      </label>`;
  }
  const icon = group.key === 'shape' ? SHAPE_ICONS[o.visual] || '' : group.key === 'tiers' ? TIER_ICONS[o.visual] || '' : '';
  return `
    <label class="choice">${input}
      ${icon}
      <span class="name">${esc(o.name)}</span>
      ${o.description ? `<span class="meta">${esc(o.description)}</span>` : ''}
      ${group.key === 'size' && o.lead_days ? `<span class="meta">Needs ${o.lead_days} extra day${o.lead_days === 1 ? '' : 's'} of notice</span>` : ''}
      <span class="cost" data-cost="${o.id}">${cost(group, o)}</span>
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
        ${key === 'size' && group.options.some((o) => Number(o.price_scale) !== 1)
          ? '<p class="size-note">✦ Bigger cakes use more of everything, so toppings, fillings and finishes are priced for the size you choose.</p>' : ''}
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

function update({ redraw = true, intro = false } = {}) {
  if (redraw) stage?.setCake(cakeConfig(), { intro });
  document.getElementById('message-count').textContent = `${messageInput.value.length} / 60 · shown on a chocolate plaque`;

  const size = selected('size')[0];
  const scale = Number(size?.price_scale) || 1;
  if (scale !== sizeScale) {
    sizeScale = scale;
    for (const group of groups) {
      if (group.key === 'size') continue;
      for (const o of group.options) {
        const label = form.querySelector(`[data-cost="${o.id}"]`);
        if (label) label.textContent = cost(group, o);
      }
    }
  }
  const leadDays = baseLeadDays + (Number(size?.lead_days) || 0);
  const earliest = isoDate(leadDays);
  form.pickup_date.min = earliest;
  if (form.pickup_date.value < earliest) form.pickup_date.value = earliest;
  document.getElementById('date-hint').textContent = leadDays > 0
    ? `Earliest: ${friendlyDate(earliest)}${size?.lead_days ? ` (${size.name} cakes need ${leadDays} days)` : ''}.` : '';

  let subtotal = 0;
  const rows = [];
  for (const group of groups) {
    const chosen = selected(group.key);
    const label = form.querySelector(`[data-chosen="${group.key}"]`);
    if (label) label.textContent = group.mode === 'single' ? chosen[0]?.name || '' : chosen.length ? `${chosen.length} selected` : 'Optional';
    for (const o of chosen) {
      subtotal += priceOf(o);
      rows.push(`<li><span class="k">${esc(group.label)}: ${esc(o.name)}</span><span class="v">${group.key === 'size' ? money(o.price_cents) : o.price_cents ? `+ ${money(priceOf(o))}` : '—'}</span></li>`);
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

// ---------- signature designs (/cakes?design=classic) ----------

// Matches a design's picks to the admin's options by 3D look or color, so renamed options still match.
function applyDesign(design) {
  const matches = (o, want) => o.visual === want || Boolean(o.color && want.startsWith('#') && o.color.toLowerCase() === want.toLowerCase());
  for (const [key, want] of Object.entries(design.picks)) {
    const group = byKey[key];
    if (!group) continue;
    const input = (o) => form.querySelector(`input[name="${key}"][value="${o.id}"]`);
    if (group.mode === 'single') {
      const option = group.options.find((o) => matches(o, want));
      if (option) input(option).checked = true;
    } else {
      for (const o of group.options) input(o).checked = want.some((w) => matches(o, w));
    }
  }
}

const preset = SIGNATURE_DESIGNS.find((d) => d.id === new URLSearchParams(location.search).get('design'));
if (preset && groups.length) {
  applyDesign(preset);
  const note = document.createElement('div');
  note.className = 'alert alert-info';
  note.innerHTML = `You're customizing <strong>${esc(preset.name)}</strong>. Change anything you like.`;
  document.getElementById('stepper').before(note);
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
update({ intro: true });

// ---------- progress stepper ----------

const stepper = document.getElementById('stepper');
const sections = [...form.querySelectorAll('.builder-step')];
stepper.innerHTML = sections.map((s, i) => `<a href="#${s.id}" data-for="${s.id}"><span class="dot">${i + 1}</span>${esc(s.dataset.step)}</a>`).join('');

function stepDone(section) {
  const groupsHere = [...section.querySelectorAll('[data-chosen]')].map((el) => byKey[el.dataset.chosen]).filter(Boolean);
  if (groupsHere.length) return groupsHere.every((g) => g.mode === 'multi' || selected(g.key).length > 0);
  if (section.id === 'summary-step') return false;
  const fields = [...section.querySelectorAll('input, textarea')].filter((el) => el.type !== 'radio' && el.offsetParent !== null);
  const required = fields.filter((el) => el.required);
  if (required.length) return required.every((el) => el.value && el.checkValidity());
  return fields.some((el) => el.value.trim());
}

function refreshStepper() {
  sections.forEach((s, i) => {
    const link = stepper.querySelector(`[data-for="${s.id}"]`);
    const done = stepDone(s);
    link.classList.toggle('done', done);
    link.querySelector('.dot').textContent = done ? '✓' : i + 1;
  });
}

// Highlight the step in the middle of the screen, keeping it visible in the (scrollable) stepper.
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const link = stepper.querySelector(`[data-for="${entry.target.id}"]`);
    stepper.querySelectorAll('a').forEach((a) => a.classList.toggle('current', a === link));
    stepper.scrollTo({ left: link.offsetLeft - stepper.clientWidth / 2 + link.clientWidth / 2, behavior: 'smooth' });
  }
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach((s) => spy.observe(s));

form.addEventListener('input', refreshStepper);
form.addEventListener('change', refreshStepper);
refreshStepper();

// ---------- surprise me & save image ----------

document.getElementById('surprise-btn').addEventListener('click', () => {
  const inputsOf = (key) => [...form.querySelectorAll(`input[name="${key}"]`)];
  const random = (list) => list[Math.floor(Math.random() * list.length)];
  for (const key of ['shape', 'tiers', 'flavor', 'filling', 'frosting', 'color', 'drip']) {
    const inputs = inputsOf(key);
    if (inputs.length) random(inputs).checked = true;
  }
  for (const [key, min, max] of [['toppings', 1, 2], ['extras', 0, 1]]) {
    const inputs = inputsOf(key).sort(() => Math.random() - 0.5);
    const count = min + Math.floor(Math.random() * (max - min + 1));
    inputs.forEach((input, i) => { input.checked = i < count; });
  }
  update();
  refreshStepper();
});

document.getElementById('save-btn').addEventListener('click', async (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  try {
    const url = await cakeCard();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(settings.shop_name || 'cake').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-my-cake.png`;
    link.click();
  } finally {
    releaseSnapshots();
    button.disabled = false;
  }
});

// A portrait image of the cake on a branded background, ready to share.
async function cakeCard() {
  const render = await renderCakeSnapshot(cakeConfig(), { width: 1000, height: 1000 });
  if (!render) return null;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = render;
  });
  await Promise.all(['600 72px "Cormorant Garamond"', '500 30px Manrope', '60px "Great Vibes"'].map((f) => document.fonts.load(f).catch(() => {})));

  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(540, 820, 60, 540, 700, 900);
  bg.addColorStop(0, '#3a2516');
  bg.addColorStop(0.55, '#1a0f09');
  bg.addColorStop(1, '#0e0704');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 40, 190, 1000, 1000);

  const gold = ctx.createLinearGradient(300, 0, 780, 0);
  gold.addColorStop(0, '#b0843f');
  gold.addColorStop(0.5, '#f6e1a8');
  gold.addColorStop(1, '#b0843f');
  ctx.textAlign = 'center';
  ctx.fillStyle = gold;
  ctx.font = '600 72px "Cormorant Garamond", serif';
  ctx.fillText(settings.shop_name || 'Savory Chocolate', 540, 130);
  ctx.font = '60px "Great Vibes", cursive';
  ctx.fillText('Designed by you', 540, 1250);
  ctx.fillStyle = '#bba48f';
  ctx.font = '500 30px Manrope, sans-serif';
  ctx.fillText(document.getElementById('preview-title').textContent, 540, 1300);
  return c.toDataURL('image/png');
}

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
  confetti();
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
      ${whatsappLink(settings) ? `<p class="small">Questions? <a href="${esc(whatsappLink(settings, `Hello, it's about my order ${order.code}`))}" target="_blank" rel="noopener">Message us on WhatsApp</a></p>` : ''}
      <div class="hero-actions" style="justify-content: center; margin-top: 24px;">
        <a class="btn btn-gold" href="/">Back to home</a>
        <a class="btn btn-outline" href="/menu">Browse the menu</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
