import {
  api, esc, money, storage, isoDate, friendlyDate, friendlyTime, loadSettings, setupFulfillment, deliveryFee, reveal,
} from '/js/common.js';

const CART_KEY = 'sc_cart_v2';

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
form.pickup_date.value = isoDate(0);

let items = [];
try {
  items = await api('/api/menu');
} catch (err) {
  menuEl.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
}
const itemsById = new Map(items.map((i) => [i.id, i]));

// ---------- add-on helpers ----------
// A cart line's `picks` holds one array of choice indexes per option group of the item.

function picksValid(item, picks) {
  if (!Array.isArray(picks) || picks.length !== item.options.length) return false;
  return item.options.every((g, gi) => {
    const p = picks[gi];
    if (!Array.isArray(p) || p.some((i) => !Number.isInteger(i) || i < 0 || i >= g.choices.length)) return false;
    if (g.type === 'single' && p.length > 1) return false;
    return !(g.required && p.length === 0);
  });
}

function unitPrice(item, picks) {
  return item.price_cents + item.options.reduce((sum, g, gi) => sum + (picks[gi] || []).reduce((s, i) => s + g.choices[i].price_cents, 0), 0);
}

function picksText(item, picks) {
  return item.options.flatMap((g, gi) => (picks[gi] || []).map((i) => g.choices[i].name)).join(' · ');
}

// Lowest possible price, for "from $x" on items whose required options cost extra.
function fromPrice(item) {
  return item.price_cents + item.options
    .filter((g) => g.required)
    .reduce((sum, g) => sum + Math.min(...g.choices.map((c) => c.price_cents)), 0);
}

// ---------- cart ----------

const lineKey = (id, picks) => `${id}:${JSON.stringify(picks)}`;

let cart = storage.get(CART_KEY, [])
  .filter((l) => itemsById.has(l.id) && l.quantity > 0 && picksValid(itemsById.get(l.id), l.picks))
  .map((l) => ({ ...l, key: lineKey(l.id, l.picks) }));

function saveCart() {
  storage.set(CART_KEY, cart.map(({ id, quantity, picks }) => ({ id, quantity, picks })));
}

function addToCart(id, picks, quantity) {
  const key = lineKey(id, picks);
  const line = cart.find((l) => l.key === key);
  if (line) line.quantity = Math.min(99, line.quantity + quantity);
  else cart.push({ key, id, picks, quantity });
  saveCart();
  renderControls();
  renderCart();
}

function changeLine(key, delta) {
  const line = cart.find((l) => l.key === key);
  if (!line) return;
  line.quantity = Math.min(99, line.quantity + delta);
  if (line.quantity <= 0) cart = cart.filter((l) => l !== line);
  saveCart();
  renderControls();
  renderCart();
}

// ---------- menu ----------

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
  const names = [...categories.keys()];
  const slug = (name, i) => `cat-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  document.getElementById('category-nav').innerHTML = names.length > 1
    ? names.map((name, i) => `<a href="#${slug(name, i)}">${esc(name)}</a>`).join('')
    : '';

  menuEl.innerHTML = names.map((name, i) => `
    <section class="menu-category" id="${slug(name, i)}">
      <h2 data-reveal>${esc(name)}</h2>
      <div class="menu-grid">
        ${categories.get(name).map((item, k) => {
          const from = item.options.length && fromPrice(item) !== item.price_cents;
          return `
          <article class="card menu-card" data-reveal style="--delay: ${(k % 3) * 0.06}s">
            <div class="thumb">${item.image
              ? `<img src="/uploads/${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">`
              : `<span class="initial" aria-hidden="true">${esc(item.name.charAt(0))}</span>`}</div>
            <div class="body">
              <h3>${esc(item.name)}</h3>
              <p class="desc">${esc(item.description)}</p>
              ${item.options.length ? '<span class="has-options">✦ Customizable</span>' : ''}
              <div class="foot">
                <span class="price">${from ? '<span class="from">from</span>' : ''}${money(from ? fromPrice(item) : item.price_cents)}</span>
                <span data-control="${item.id}"></span>
              </div>
            </div>
          </article>`;
        }).join('')}
      </div>
    </section>`).join('');

  renderControls();
  reveal(menuEl);

  // Highlight the category currently on screen.
  const links = [...document.querySelectorAll('#category-nav a')];
  if (links.length) {
    const spy = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.hash === `#${entry.target.id}`));
      }
    }, { rootMargin: '-40% 0px -55% 0px' });
    menuEl.querySelectorAll('.menu-category').forEach((s) => spy.observe(s));
  }
}

function renderControls() {
  for (const item of items) {
    const slot = menuEl.querySelector(`[data-control="${item.id}"]`);
    if (!slot) continue;
    const disabled = ordersOpen ? '' : 'disabled';
    if (item.options.length) {
      const count = cart.filter((l) => l.id === item.id).reduce((n, l) => n + l.quantity, 0);
      slot.innerHTML = `<button type="button" class="btn btn-gold btn-sm" data-choose="${item.id}" ${disabled}>${count ? `Add more (${count})` : 'Choose'}</button>`;
    } else {
      const line = cart.find((l) => l.key === lineKey(item.id, []));
      slot.innerHTML = line
        ? stepper(line.key, line.quantity, item.name)
        : `<button type="button" class="btn btn-gold btn-sm" data-add="${item.id}" ${disabled}>Add</button>`;
    }
  }
}

function stepper(key, qty, name) {
  return `
    <span class="qty">
      <button type="button" data-dec="${esc(key)}" aria-label="Remove one ${esc(name)}">−</button>
      <span aria-live="polite">${qty}</span>
      <button type="button" data-inc="${esc(key)}" aria-label="Add one more ${esc(name)}">+</button>
    </span>`;
}

// ---------- cart panel ----------

let fulfillment = () => 'pickup';

function renderCart() {
  const count = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((sum, l) => sum + l.quantity * unitPrice(itemsById.get(l.id), l.picks), 0);
  const fee = deliveryFee(settings, fulfillment());

  document.getElementById('cart-empty').hidden = count > 0;
  form.hidden = count === 0;

  document.getElementById('cart-lines').innerHTML = cart.map((l) => {
    const item = itemsById.get(l.id);
    const extras = picksText(item, l.picks);
    return `
      <li>
        <span class="name">${esc(item.name)}</span>
        <span class="line-total">${money(unitPrice(item, l.picks) * l.quantity)}</span>
        ${extras ? `<span class="choices">${esc(extras)}</span>` : ''}
        ${stepper(l.key, l.quantity, item.name)}
      </li>`;
  }).join('');

  document.getElementById('sum-rows').innerHTML = fee
    ? `<div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
       <div class="sum-row"><span>Delivery</span><span>${money(fee)}</span></div>`
    : '';
  document.getElementById('cart-total').textContent = money(subtotal + fee);

  const bar = document.getElementById('cart-bar');
  bar.classList.toggle('show', count > 0);
  document.getElementById('cart-bar-count').textContent = `View order · ${count} item${count === 1 ? '' : 's'}`;
  document.getElementById('cart-bar-total').textContent = money(subtotal + fee);
}

fulfillment = setupFulfillment(form, settings, renderCart);
renderMenu();
renderCart();

// ---------- options dialog ----------

const dialog = document.getElementById('item-dialog');
const dialogForm = document.getElementById('item-form');
let dialogItem = null;
let dialogQty = 1;

function openOptions(item) {
  dialogItem = item;
  dialogQty = 1;
  document.getElementById('d-name').textContent = item.name;
  document.getElementById('d-desc').textContent = item.description;
  document.getElementById('d-error').hidden = true;
  document.getElementById('d-groups').innerHTML = item.options.map((g, gi) => {
    const multi = g.type === 'multi';
    const note = g.required ? 'Required' : multi ? 'Choose any' : 'Optional';
    const none = !multi && !g.required
      ? `<label class="opt"><input type="radio" name="g${gi}" value="" checked><span class="name">No, thanks</span></label>` : '';
    return `
      <fieldset class="opt-group">
        <legend>${esc(g.name)}<span class="req">${note}</span></legend>
        ${none}
        ${g.choices.map((c, ci) => `
          <label class="opt">
            <input type="${multi ? 'checkbox' : 'radio'}" name="g${gi}" value="${ci}" ${!multi && g.required && ci === 0 ? 'checked' : ''}>
            <span class="name">${esc(c.name)}</span>
            <span class="cost">${c.price_cents ? `+ ${money(c.price_cents)}` : ''}</span>
          </label>`).join('')}
      </fieldset>`;
  }).join('');
  updateDialog();
  dialog.showModal();
}

function dialogPicks() {
  return dialogItem.options.map((g, gi) => [...dialogForm.querySelectorAll(`input[name="g${gi}"]:checked`)]
    .filter((i) => i.value !== '')
    .map((i) => Number(i.value)));
}

function updateDialog() {
  document.getElementById('d-qty').textContent = dialogQty;
  document.getElementById('d-add').textContent = `Add to order · ${money(unitPrice(dialogItem, dialogPicks()) * dialogQty)}`;
}

dialogForm.addEventListener('change', updateDialog);
document.getElementById('d-inc').addEventListener('click', () => { dialogQty = Math.min(99, dialogQty + 1); updateDialog(); });
document.getElementById('d-dec').addEventListener('click', () => { dialogQty = Math.max(1, dialogQty - 1); updateDialog(); });
dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

dialogForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const picks = dialogPicks();
  if (!picksValid(dialogItem, picks)) {
    const missing = dialogItem.options.find((g, gi) => g.required && !picks[gi].length);
    const box = document.getElementById('d-error');
    box.textContent = missing ? `Please choose a ${missing.name.toLowerCase()}.` : 'Please check your choices.';
    box.hidden = false;
    return;
  }
  addToCart(dialogItem.id, picks, dialogQty);
  dialog.close();
});

// ---------- clicks ----------

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  const choose = event.target.closest('[data-choose]');
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  if (add && ordersOpen) addToCart(Number(add.dataset.add), [], 1);
  if (choose && ordersOpen) openOptions(itemsById.get(Number(choose.dataset.choose)));
  if (inc) changeLine(inc.dataset.inc, 1);
  if (dec) changeLine(dec.dataset.dec, -1);
});

// ---------- checkout ----------

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form));
  data.fulfillment = fulfillment();
  data.items = cart.map((l) => ({ id: l.id, quantity: l.quantity, choices: l.picks }));

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Placing your order…';
  try {
    const order = await api('/api/orders/menu', { method: 'POST', body: data });
    cart = [];
    saveCart();
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
  const delivery = order.fulfillment === 'delivery';
  document.getElementById('cart-bar').remove();
  document.getElementById('page').innerHTML = `
    <div class="card confirm">
      <span class="script" style="font-size: 2.4rem;">Thank you</span>
      <h1 style="font-size: 2.6rem;">${esc(firstName)}, your order is in!</h1>
      <p class="muted">Your order number is</p>
      <div class="order-code">${esc(order.code)}</div>
      <p><strong>${delivery ? 'Delivery' : 'Pickup'}:</strong> ${esc(friendlyDate(order.pickup_date))} at ${esc(friendlyTime(order.pickup_time))}
        ${delivery ? `<br><span class="muted">${esc(order.delivery_address)}</span>` : ''}<br>
        <strong>Total due on ${delivery ? 'delivery' : 'pickup'}:</strong> ${money(order.total_cents)}</p>
      <p class="muted">${delivery ? 'We\'ll bring it to your door.' : 'Give us your order number when you arrive.'}</p>
      <div class="hero-actions" style="justify-content: center; margin-top: 24px;">
        <a class="btn btn-gold" href="/">Back to home</a>
        <a class="btn btn-outline" href="/cakes">Design a cake</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
