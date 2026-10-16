import { api, esc, money, storage, isoDate, friendlyDate, friendlyTime, loadSettings } from '/js/common.js';

const CART_KEY = 'sc_cart';

const menuEl = document.getElementById('menu');
const form = document.getElementById('checkout-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('form-error');

const settings = await loadSettings();
const ordersOpen = settings.orders_open !== '0';
if (!ordersOpen) {
  document.getElementById('closed-notice').hidden = false;
  submitBtn.disabled = true;
}

form.pickup_date.min = isoDate(0);
form.pickup_date.max = isoDate(180);
form.pickup_date.value ||= isoDate(0);

let items = [];
try {
  items = await api('/api/menu');
} catch (err) {
  menuEl.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
}
const itemsById = new Map(items.map((i) => [String(i.id), i]));

// Cart is { itemId: quantity }, kept in localStorage so it survives a page refresh.
const cart = Object.fromEntries(
  Object.entries(storage.get(CART_KEY, {})).filter(([id, qty]) => itemsById.has(id) && qty > 0),
);

renderMenu();
renderCart();

function renderMenu() {
  if (!items.length) {
    if (!menuEl.querySelector('.alert')) {
      menuEl.innerHTML = '<div class="card empty-state"><div class="icon" aria-hidden="true">🍰</div><p>Our menu is being updated. Please check back soon!</p></div>';
    }
    return;
  }

  const categories = new Map();
  for (const item of items) {
    if (!categories.has(item.category)) categories.set(item.category, []);
    categories.get(item.category).push(item);
  }

  const slug = (name, i) => `cat-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const names = [...categories.keys()];

  document.getElementById('category-nav').innerHTML = names.length > 1
    ? names.map((name, i) => `<a href="#${slug(name, i)}">${esc(name)}</a>`).join('')
    : '';

  menuEl.innerHTML = names.map((name, i) => `
    <section class="menu-category" id="${slug(name, i)}">
      <h2>${esc(name)}</h2>
      <div class="menu-grid">
        ${categories.get(name).map((item) => `
          <article class="card menu-card">
            <div class="thumb">${item.image
              ? `<img src="/uploads/${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">`
              : `<span class="initial" aria-hidden="true">${esc(item.name.charAt(0))}</span>`}</div>
            <div class="body">
              <h3>${esc(item.name)}</h3>
              <p class="desc">${esc(item.description)}</p>
              <div class="foot">
                <span class="price">${money(item.price_cents)}</span>
                <span data-control="${item.id}"></span>
              </div>
            </div>
          </article>`).join('')}
      </div>
    </section>`).join('');

  for (const item of items) renderControl(String(item.id));
}

function stepper(id, qty, name) {
  return `
    <span class="qty">
      <button type="button" data-dec="${id}" aria-label="Remove one ${esc(name)}">−</button>
      <span aria-live="polite">${qty}</span>
      <button type="button" data-inc="${id}" aria-label="Add one more ${esc(name)}">+</button>
    </span>`;
}

function renderControl(id) {
  const slot = menuEl.querySelector(`[data-control="${id}"]`);
  if (!slot) return;
  const qty = cart[id] || 0;
  const name = itemsById.get(id).name;
  slot.innerHTML = qty
    ? stepper(id, qty, name)
    : `<button type="button" class="btn btn-accent btn-sm" data-inc="${id}" ${ordersOpen ? '' : 'disabled'}>Add</button>`;
}

function renderCart() {
  const ids = Object.keys(cart);
  const count = ids.reduce((n, id) => n + cart[id], 0);
  const total = ids.reduce((sum, id) => sum + cart[id] * itemsById.get(id).price_cents, 0);

  document.getElementById('cart-empty').hidden = count > 0;
  document.getElementById('cart-full').hidden = count === 0;

  document.getElementById('cart-lines').innerHTML = ids.map((id) => {
    const item = itemsById.get(id);
    return `
      <li>
        <span class="name">${esc(item.name)}</span>
        <span class="line-total">${money(item.price_cents * cart[id])}</span>
        ${stepper(id, cart[id], item.name)}
      </li>`;
  }).join('');
  document.getElementById('cart-total').textContent = money(total);

  const bar = document.getElementById('cart-bar');
  bar.classList.toggle('show', count > 0);
  document.getElementById('cart-bar-count').textContent = `View order · ${count} item${count === 1 ? '' : 's'}`;
  document.getElementById('cart-bar-total').textContent = money(total);
}

function change(id, delta) {
  const next = Math.min(99, (cart[id] || 0) + delta);
  if (next > 0) cart[id] = next;
  else delete cart[id];
  storage.set(CART_KEY, cart);
  renderControl(id);
  renderCart();
}

document.addEventListener('click', (event) => {
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  if (inc && ordersOpen) change(inc.dataset.inc, 1);
  if (dec) change(dec.dataset.dec, -1);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form));
  data.items = Object.entries(cart).map(([id, quantity]) => ({ id: Number(id), quantity }));

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Placing order…';

  try {
    const order = await api('/api/orders/menu', { method: 'POST', body: data });
    storage.set(CART_KEY, {});
    showConfirmation(order, data.customer_name);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place order';
  }
});

function showConfirmation(order, name) {
  const firstName = name.trim().split(/\s+/)[0];
  document.getElementById('cart-bar').remove();
  document.getElementById('page').innerHTML = `
    <div class="card confirm" style="margin-top: 48px;">
      <div class="icon" aria-hidden="true">🎉</div>
      <h1 style="font-size: 2rem;">Thank you, ${esc(firstName)}!</h1>
      <p>Your order is in. Your order number is</p>
      <div class="order-code">${esc(order.code)}</div>
      <p><strong>Pickup:</strong> ${esc(friendlyDate(order.pickup_date))} at ${esc(friendlyTime(order.pickup_time))}<br>
         <strong>Total due at pickup:</strong> ${money(order.total_cents)}</p>
      <p class="muted">Give us your order number when you arrive.</p>
      <div class="hero-actions" style="justify-content: center;">
        <a class="btn btn-primary" href="/">Back to home</a>
        <a class="btn btn-outline" href="/cakes">Design a cake</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
