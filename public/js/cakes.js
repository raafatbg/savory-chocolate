import { api, esc, money, isoDate, friendlyDate, friendlyTime, loadSettings } from '/js/common.js';

const GROUPS = [
  { type: 'size', label: 'Size' },
  { type: 'flavor', label: 'Flavor' },
  { type: 'filling', label: 'Filling' },
  { type: 'frosting', label: 'Frosting' },
];

const form = document.getElementById('cake-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('form-error');
const byId = new Map();

const settings = await loadSettings();
const leadDays = Number(settings.cake_lead_days) || 0;
let ordersOpen = settings.orders_open !== '0';

const dateInput = document.getElementById('pickup_date');
dateInput.min = isoDate(leadDays);
dateInput.max = isoDate(180);
document.getElementById('date-hint').textContent = leadDays > 0
  ? `Earliest pickup: ${friendlyDate(dateInput.min)}.`
  : '';

try {
  const options = await api('/api/cake-options');
  for (const { type, label } of GROUPS) {
    const container = form.querySelector(`[data-group="${type}"]`);
    const list = options[type] || [];
    if (!list.length) {
      container.innerHTML = `<p class="muted">No ${label.toLowerCase()} options are available right now.</p>`;
      ordersOpen = false;
      continue;
    }
    container.innerHTML = list.map((o) => {
      byId.set(String(o.id), o);
      const cost = type === 'size' ? money(o.price_cents) : o.price_cents ? `+ ${money(o.price_cents)}` : 'Included';
      return `
        <label class="choice">
          <input type="radio" name="${type}" value="${o.id}" required>
          <span class="name">${esc(o.name)}</span>
          ${o.description ? `<span class="meta">${esc(o.description)}</span>` : ''}
          <span class="cost">${cost}</span>
        </label>`;
    }).join('');
  }
} catch (err) {
  form.querySelector('[data-group="size"]').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  ordersOpen = false;
}

if (!ordersOpen) {
  document.getElementById('closed-notice').hidden = settings.orders_open !== '0';
  submitBtn.disabled = true;
}

const messageInput = document.getElementById('message');
const messageCount = document.getElementById('message-count');

function selected(type) {
  const input = form.querySelector(`input[name="${type}"]:checked`);
  return input ? byId.get(input.value) : null;
}

function updateSummary() {
  messageCount.textContent = `${messageInput.value.length} / 60`;

  let total = 0;
  const rows = GROUPS.map(({ type, label }) => {
    const option = selected(type);
    if (option) total += option.price_cents;
    return row(label, option ? esc(option.name) : null, `Choose a ${label.toLowerCase()}`);
  });

  const message = messageInput.value.trim();
  if (message) rows.push(row('Message', `“${esc(message)}”`));

  const date = dateInput.value;
  const time = form.pickup_time.value;
  const when = date ? `${friendlyDate(date)}${time ? `, ${friendlyTime(time)}` : ''}` : null;
  rows.push(row('Pickup', when, 'Choose a day'));

  document.getElementById('summary').innerHTML = rows.join('');
  document.getElementById('total').textContent = selected('size') ? money(total) : '—';
}

function row(label, value, placeholder) {
  return `<li><span class="k">${label}</span><span class="v ${value ? '' : 'pending'}">${value ?? placeholder}</span></li>`;
}

form.addEventListener('input', updateSummary);
form.addEventListener('change', updateSummary);
updateSummary();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form));
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Placing order…';

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
  document.getElementById('page').innerHTML = `
    <div class="card confirm" style="margin-top: 48px;">
      <div class="icon" aria-hidden="true">🎉</div>
      <h1 style="font-size: 2rem;">Thank you, ${esc(firstName)}!</h1>
      <p>Your cake order is in. Your order number is</p>
      <div class="order-code">${esc(order.code)}</div>
      <p><strong>Pickup:</strong> ${esc(friendlyDate(order.pickup_date))} at ${esc(friendlyTime(order.pickup_time))}<br>
         <strong>Total due at pickup:</strong> ${money(order.total_cents)}</p>
      <p class="muted">We'll get in touch if we have any questions about your design. Keep your order number handy.</p>
      <div class="hero-actions" style="justify-content: center;">
        <a class="btn btn-primary" href="/">Back to home</a>
        <a class="btn btn-outline" href="/menu">Browse the menu</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
