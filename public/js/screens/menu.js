import {
  api, esc, money, storage, isoDate, loadSettings, setupFulfillment, deliveryFee, reveal,
  setupBranches, orderConfirmation, openWhatsApp,
} from '/js/common.js';
import { illustrationFor, art } from '/js/illustrations.js';
import { confetti } from '/js/confetti.js';

const CART_KEY = 'sc_cart_v2';

const BOX_TIERS = {
  9: { size: 9, cols: 3, name: 'SAVORY 9-Piece Assorted Gift Box', price_cents: 1800 },
  16: { size: 16, cols: 4, name: 'SAVORY 16-Piece Luxury Gift Box', price_cents: 3000 },
  25: { size: 25, cols: 5, name: 'SAVORY 25-Piece Grand Selection Box', price_cents: 4500 },
};

const TRUFFLES = [
  { id: 'pistachio', name: 'Pistachio Kunafa', color: '#96bc61', accent: '#d9b066', shape: 'dome' },
  { id: 'hazelnut', name: 'Hazelnut Praline', color: '#5c2c12', accent: '#e3c184', shape: 'round' },
  { id: 'caramel', name: 'Salted Caramel', color: '#c67d2d', accent: '#4C2007', shape: 'swirl' },
  { id: 'dark70', name: '70% Dark Ganache', color: '#2b1206', accent: '#d9b066', shape: 'square' },
  { id: 'lotus', name: 'Lotus Speculoos', color: '#b56e33', accent: '#f6ead8', shape: 'round' },
  { id: 'raspberry', name: 'Raspberry Velvet', color: '#8c1832', accent: '#f4b6c2', shape: 'heart' },
  { id: 'espresso', name: 'Arabic Coffee Roast', color: '#3b1c0c', accent: '#c9a063', shape: 'dome' },
  { id: 'white', name: 'Almond Blanc', color: '#f3dfba', accent: '#7A3912', shape: 'swirl' },
];

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

const lineKey = (id, picks, customBox = null) => (customBox ? `box:${JSON.stringify(customBox)}` : `${id}:${JSON.stringify(picks)}`);

let cart = storage.get(CART_KEY, [])
  .filter((l) => {
    if (l.custom_box) return Boolean(BOX_TIERS[Number(l.custom_box.size)]) && l.quantity > 0;
    return itemsById.has(l.id) && l.quantity > 0 && picksValid(itemsById.get(l.id), l.picks);
  })
  .map((l) => ({ ...l, key: lineKey(l.id, l.picks, l.custom_box) }));

function saveCart() {
  storage.set(CART_KEY, cart.map(({ id, quantity, picks, custom_box }) => (
    custom_box ? { quantity, custom_box } : { id, quantity, picks }
  )));
}

function lineUnitPrice(line) {
  if (line.custom_box) return BOX_TIERS[Number(line.custom_box.size)]?.price_cents || 1800;
  return unitPrice(itemsById.get(line.id), line.picks);
}

function lineDisplay(line) {
  if (line.custom_box) {
    const tier = BOX_TIERS[Number(line.custom_box.size)] || BOX_TIERS[9];
    const counts = new Map();
    for (const p of line.custom_box.pieces || []) counts.set(p, (counts.get(p) || 0) + 1);
    const summary = [...counts.entries()].map(([n, c]) => `${c}× ${n}`).join(', ');
    const parts = [summary];
    if (line.custom_box.ribbon) parts.push(`Ribbon: ${line.custom_box.ribbon}`);
    if (line.custom_box.note) parts.push(`Card: “${line.custom_box.note}”`);
    return { name: tier.name, extras: parts.filter(Boolean).join(' · ') };
  }
  const item = itemsById.get(line.id);
  return { name: item.name, extras: picksText(item, line.picks) };
}

// A little gold dot arcs from the button to the order panel (or the bottom bar on phones).
function flyToCart(from) {
  if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bar = document.getElementById('cart-bar');
  const target = bar.classList.contains('show') && getComputedStyle(bar).display !== 'none'
    ? bar : document.querySelector('#cart .panel');
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b.left + Math.min(b.width / 2, 120);
  const y1 = b.top + Math.min(b.height / 2, 40);
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  document.body.append(dot);
  dot.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)` },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 140}px) scale(1.25)`, offset: 0.45 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.35)`, opacity: 0.3 },
  ], { duration: 750, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' }).onfinish = () => {
    dot.remove();
    target.classList.remove('bump');
    void target.offsetWidth;
    target.classList.add('bump');
  };
  setTimeout(() => dot.remove(), 1500);
}

function addToCart(id, picks, quantity, from = null, customBox = null) {
  const key = lineKey(id, picks, customBox);
  const line = cart.find((l) => l.key === key);
  if (line) line.quantity = Math.min(99, line.quantity + quantity);
  else cart.push({ key, id, picks, quantity, custom_box: customBox });
  saveCart();
  renderControls();
  renderCart();
  flyToCart(from);
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

// ---------- Interactive Gift Box Builder ----------

const boxDialog = document.getElementById('box-dialog');
const boxTray = document.getElementById('box-tray');
const boxFlavors = document.getElementById('box-flavors');
const boxProgress = document.getElementById('box-progress');
const boxPriceLabel = document.getElementById('box-price-label');
const boxError = document.getElementById('box-error');
let activeBoxSize = 9;
let boxSlots = [];

function renderBoxFlavors() {
  if (!boxFlavors) return;
  boxFlavors.innerHTML = TRUFFLES.map((t) => `
    <button type="button" class="truffle-pick" data-truffle="${esc(t.id)}">
      <span class="truffle-dot" style="background:${esc(t.color)};box-shadow:inset 0 0 0 2px ${esc(t.accent)}"></span>
      <span class="truffle-name">${esc(t.name)}</span>
      <span class="truffle-add">+</span>
    </button>
  `).join('');
}

function renderBoxTray() {
  if (!boxTray) return;
  const tier = BOX_TIERS[activeBoxSize];
  boxTray.dataset.cols = String(tier.cols);
  boxTray.innerHTML = Array.from({ length: activeBoxSize }, (_, i) => {
    const t = boxSlots[i];
    if (!t) {
      return `<button type="button" class="box-slot empty" data-slot="${i}" aria-label="Empty slot ${i + 1}"><span>+</span></button>`;
    }
    return `
      <button type="button" class="box-slot filled" data-slot="${i}" title="${esc(t.name)} (tap to remove)" aria-label="Remove ${esc(t.name)}">
        <span class="bonbon" style="background:${esc(t.color)};border-color:${esc(t.accent)}"></span>
      </button>`;
  }).join('');
  boxProgress.textContent = `${boxSlots.length} / ${activeBoxSize} pieces selected`;
  boxPriceLabel.textContent = money(tier.price_cents);
}

renderBoxFlavors();
renderBoxTray();

document.getElementById('open-box-builder')?.addEventListener('click', () => {
  boxError.hidden = true;
  if (boxSlots.length === 0) {
    // Pre-fill a welcoming signature assortment so the user sees it alive immediately
    boxSlots = Array.from({ length: activeBoxSize }, (_, i) => TRUFFLES[i % TRUFFLES.length]);
    renderBoxTray();
  }
  boxDialog?.showModal();
});

boxDialog?.querySelectorAll('[data-box-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeBoxSize = Number(btn.dataset.boxSize);
    boxDialog.querySelectorAll('[data-box-size]').forEach((b) => b.classList.toggle('active', b === btn));
    if (boxSlots.length > activeBoxSize) boxSlots = boxSlots.slice(0, activeBoxSize);
    renderBoxTray();
  });
});

boxFlavors?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-truffle]');
  if (!btn) return;
  const truffle = TRUFFLES.find((t) => t.id === btn.dataset.truffle);
  if (!truffle) return;
  if (boxSlots.length < activeBoxSize) {
    boxSlots.push(truffle);
  } else {
    // Replace the last slot if already full
    boxSlots[activeBoxSize - 1] = truffle;
  }
  boxError.hidden = true;
  renderBoxTray();
});

boxTray?.addEventListener('click', (e) => {
  const slot = e.target.closest('[data-slot]');
  if (!slot) return;
  const idx = Number(slot.dataset.slot);
  if (idx >= 0 && idx < boxSlots.length) {
    boxSlots.splice(idx, 1);
    renderBoxTray();
  }
});

document.getElementById('box-autofill')?.addEventListener('click', () => {
  while (boxSlots.length < activeBoxSize) {
    boxSlots.push(TRUFFLES[boxSlots.length % TRUFFLES.length]);
  }
  boxError.hidden = true;
  renderBoxTray();
});

document.getElementById('box-clear')?.addEventListener('click', () => {
  boxSlots = [];
  renderBoxTray();
});

boxDialog?.querySelector('[data-box-close]')?.addEventListener('click', () => boxDialog.close());
boxDialog?.addEventListener('click', (e) => { if (e.target === boxDialog) boxDialog.close(); });

document.getElementById('box-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (boxSlots.length < activeBoxSize) {
    // Automatically top up any remaining slots or let the user know
    while (boxSlots.length < activeBoxSize) {
      boxSlots.push(TRUFFLES[boxSlots.length % TRUFFLES.length]);
    }
  }
  const customBox = {
    size: activeBoxSize,
    pieces: boxSlots.map((t) => t.name),
    ribbon: document.getElementById('box-ribbon').value,
    note: document.getElementById('box-note').value.trim(),
  };
  boxDialog.close();
  addToCart(0, [], 1, document.getElementById('open-box-builder'), customBox);
});

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
          <article class="card spotlight menu-card" data-reveal style="--delay: ${(k % 3) * 0.06}s">
            <div class="thumb ${item.image ? '' : 'illus'}">${item.image
              ? `<img src="/uploads/${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">`
              : illustrationFor(item)}</div>
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
      const count = cart.filter((l) => !l.custom_box && l.id === item.id).reduce((n, l) => n + l.quantity, 0);
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
  const subtotal = cart.reduce((sum, l) => sum + l.quantity * lineUnitPrice(l), 0);
  const fee = deliveryFee(settings, fulfillment());

  document.getElementById('cart-empty').hidden = count > 0;
  form.hidden = count === 0;

  document.getElementById('cart-lines').innerHTML = cart.map((l) => {
    const { name, extras } = lineDisplay(l);
    return `
      <li>
        <span class="name">${esc(name)}</span>
        <span class="line-total">${money(lineUnitPrice(l) * l.quantity)}</span>
        ${extras ? `<span class="choices">${esc(extras)}</span>` : ''}
        ${stepper(l.key, l.quantity, name)}
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
const branchOf = await setupBranches(form);
renderMenu();
renderCart();

// ---------- options dialog ----------

const dialog = document.getElementById('item-dialog');
const dialogForm = document.getElementById('item-form');
let dialogItem = null;
let dialogQty = 1;

let dialogSource = null;

function openOptions(item, source = null) {
  dialogItem = item;
  dialogSource = source;
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
  dialog.close();
  addToCart(dialogItem.id, picks, dialogQty, dialogSource);
});

// ---------- clicks ----------

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  const choose = event.target.closest('[data-choose]');
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  if (add && ordersOpen) addToCart(Number(add.dataset.add), [], 1, add);
  if (choose && ordersOpen) openOptions(itemsById.get(Number(choose.dataset.choose)), choose);
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
  data.branch = branchOf()?.id;
  data.items = cart.map((l) => (
    l.custom_box
      ? { quantity: l.quantity, custom_box: l.custom_box }
      : { id: l.id, quantity: l.quantity, choices: l.picks }
  ));

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Placing your order…';
  try {
    const order = await api('/api/orders/menu', { method: 'POST', body: data });
    cart = [];
    saveCart();
    showConfirmation(order, data.customer_name);
    openWhatsApp(order.whatsapp_url);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place order';
  }
});

function showConfirmation(order, name) {
  document.getElementById('cart-bar').remove();
  confetti();
  document.getElementById('page').innerHTML = orderConfirmation(order, {
    name,
    title: 'your order is in!',
    shopName: settings.shop_name,
    links: `<a class="btn btn-gold" href="/track?code=${encodeURIComponent(order.order_code || order.code)}">Track order live</a><a class="btn btn-outline" href="/">Order more from menu</a>`,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ---------- What we make (Menu & Chocolatier specialties) ----------

const PRODUCT_LINES = [
  { art: 'chocolate', name: 'Chocolates & bark', text: 'Fine chocolates and loaded chocolate bark, for gifting or sharing.', href: '#menu', go: 'Browse chocolates' },
  { art: 'gift', name: 'Luxury gift boxes', text: 'Curate a 9, 16, or 25-piece SAVORY chocolate box with a satin ribbon.', href: '#box-banner', go: 'Build a box' },
  { art: 'icecream', name: 'Ice cream & Flurry', text: 'Scoops, soft serve and Savory Flurry cups piled with toppings.', href: '#menu', go: 'See the menu' },
  { art: 'crepe', name: 'Warm crepes', text: 'Warm crepes drizzled with chocolate, pistachio and more.', href: '#menu', go: 'See the menu' },
  { art: 'shake', name: 'Thick shakes', text: 'Thick shakes crowned with cookies and chocolate.', href: '#menu', go: 'See the menu' },
  { art: 'eclair', name: 'Éclairs & pastries', text: 'Éclairs and sweet pastries, fresh from our kitchen.', href: '#menu', go: 'See the menu' },
  { art: 'nuts', name: 'Mixed nuts', text: 'Smoked almonds, pistachios, cashews, hazelnuts and more.', href: '#menu', go: 'See the menu' },
  { art: 'cake', name: 'Gateaux slices', text: 'Individual slices and daily counter bakes ready to enjoy.', href: '#menu', go: 'See the menu' },
];

const linesEl = document.getElementById('product-lines');
if (linesEl) {
  linesEl.innerHTML = PRODUCT_LINES.map((p, i) => `
    <a class="card spotlight product-line" href="${p.href}" data-reveal style="--delay: ${(i % 4) * 0.07}s">
      <span class="pl-icon">${art(p.art)}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.text)}</p>
      <span class="go">${esc(p.go)} <span class="arrow" aria-hidden="true">→</span></span>
    </a>`).join('');
  reveal(linesEl);
}
