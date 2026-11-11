import {
  api, esc, money, storage, isoDate, loadSettings, setupFulfillment, deliveryFee, reveal,
  setupBranches, orderConfirmation, openWhatsApp,
} from '/js/common.js';
import { illustrationFor, art } from '/js/illustrations.js';
import { confetti } from '/js/confetti.js';
import { playClick, playPop, playCelebration } from '/js/audio.js';

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

const CATEGORY_META = {
  'Signature Gateaux & Bakes': {
    desc: 'Hand-finished whole tortes, molten lava bakes, and signature chocolate creations.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h16"/><path d="M5 19v-5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5"/><path d="M8 12V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/><circle cx="12" cy="4" r="1.5" fill="currentColor"/></svg>`,
  },
  'Chocolates & Bark': {
    desc: 'Artisan bonbons, pistachio kunafa bars, and hand-broken roasted nut barks.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg>`,
  },
  'Crepes & Waffles': {
    desc: 'Warm golden crepes and crispy waffles drenched in Belgian milk and dark couverture.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18c0-5 3.5-9 8-9s8 4 8 9"/><path d="M3 18h18"/><path d="M12 9v9"/><path d="M8 11.5v6.5"/><path d="M16 11.5v6.5"/></svg>`,
  },
  'Savory Flurry & Shakes': {
    desc: 'Handcrafted velvety soft serve flurries and decadent thick shakes.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l-2 13a4 4 0 0 1-4 4 4 4 0 0 1-4-4L6 3z"/><path d="M10 21h4"/><line x1="6" y1="8" x2="18" y2="8"/></svg>`,
  },
  'Cakes by the slice': {
    desc: 'Decadent chocolate fudge slices, spiced carrot cakes, and patisserie slices.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l18-8v8H3z"/><path d="M3 17l6-9 12 1"/><line x1="3" y1="17" x2="21" y2="17"/></svg>`,
  },
  'Bakes': {
    desc: 'Freshly baked Belgian chocolate brownies, chewy cookies, and afternoon treats.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><circle cx="10" cy="15" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>`,
  },
  'Drinks': {
    desc: 'Signature warm Belgian hot chocolate, iced beverages, and specialty roasts.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  },
};

const DEFAULT_CATEGORY_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

// ---------- Stage & View Containers ----------
const viewFolders = document.getElementById('view-folders');
const viewCategory = document.getElementById('view-category');
const viewProduct = document.getElementById('view-product');
const viewSearch = document.getElementById('view-search');

const breadcrumb = document.getElementById('menu-breadcrumb');
const bcHome = document.getElementById('bc-home');
const bcSepCat = document.getElementById('bc-sep-cat');
const bcCat = document.getElementById('bc-cat');
const bcSepProd = document.getElementById('bc-sep-prod');
const bcProd = document.getElementById('bc-prod');

const foldersGrid = document.getElementById('folders-grid');
const categoryRowsList = document.getElementById('category-rows-list');
const searchRowsList = document.getElementById('search-rows-list');
const productPageCard = document.getElementById('product-page-card');

const catBannerTitle = document.getElementById('cat-banner-title');
const catBannerDesc = document.getElementById('cat-banner-desc');
const catBannerIcon = document.getElementById('cat-banner-icon');
const catBackBtn = document.getElementById('cat-back-btn');
const catProductsCount = document.getElementById('cat-products-count');
const catSwitchBtn = document.getElementById('cat-switch-btn');

const prodBackBtn = document.getElementById('prod-back-btn');
const prodBackCatName = document.getElementById('prod-back-cat-name');

const searchInput = document.getElementById('menu-search');
const searchClear = document.getElementById('menu-search-clear');
const filterPills = document.getElementById('menu-filter-pills');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchTitle = document.getElementById('search-title');

const form = document.getElementById('checkout-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('form-error');

// ---------- Load Settings & Menu Data ----------
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
  if (foldersGrid) {
    foldersGrid.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  }
}
const itemsById = new Map(items.map((i) => [i.id, i]));

// ---------- Option & Pricing Helpers ----------

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

function fromPrice(item) {
  return item.price_cents + item.options
    .filter((g) => g.required)
    .reduce((sum, g) => sum + Math.min(...g.choices.map((c) => c.price_cents)), 0);
}

function inferMenuBadges(item) {
  const text = `${item.name} ${item.description} ${item.category}`.toLowerCase();
  const badges = [];
  if (/lava|mirror|kunafa|gift box|fettuccine|flurry/i.test(text)) {
    badges.push({ label: "★ Chef's Pick", cls: 'badge-chef' });
  }
  if (/pistachio|kunafa|hazelnut|praline|almond|pecan|nut/i.test(text)) {
    badges.push({ label: 'Nuts & Praline', cls: 'badge-nut' });
  }
  if (/70%|dark|ganache|mirror|truffle|bark/i.test(text)) {
    badges.push({ label: 'Belgian Cocoa', cls: 'badge-dark' });
  }
  if (/lava|warm|crepe|waffle|molten|brownie/i.test(text)) {
    badges.push({ label: 'Served Warm', cls: 'badge-warm' });
  } else if (/flurry|shake|ice cream|chilled/i.test(text)) {
    badges.push({ label: 'Chilled', cls: 'badge-chill' });
  }
  return badges.slice(0, 3);
}

function inferPairing(item) {
  const text = `${item.name} ${item.category}`.toLowerCase();
  if (/crepe|waffle|lava|brownie/.test(text)) {
    return 'Chef’s Pairing: Enjoy warm with a scoop of Madagascar vanilla gelato or double espresso.';
  }
  if (/flurry|shake/.test(text)) {
    return 'Chef’s Pairing: Pairs effortlessly with a warm Belgian chocolate brownie or pistachio kunafa bar.';
  }
  if (/box|praline|truffle|bark/.test(text)) {
    return 'Chef’s Pairing: Hand-tempered for gifting — pairs beautifully with roasted Arabic coffee.';
  }
  return 'Chef’s Pairing: Freshly crafted to order in our Aramoun & Aley kitchens.';
}

// ---------- Cart State & Logic ----------

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
  playPop();
  const key = lineKey(id, picks, customBox);
  const line = cart.find((l) => l.key === key);
  if (line) line.quantity = Math.min(99, line.quantity + quantity);
  else cart.push({ key, id, picks, quantity, custom_box: customBox });
  saveCart();
  renderCart();
  flyToCart(from);
}

function changeLine(key, delta) {
  playClick();
  const line = cart.find((l) => l.key === key);
  if (!line) return;
  line.quantity = Math.min(99, line.quantity + delta);
  if (line.quantity <= 0) cart = cart.filter((l) => l !== line);
  saveCart();
  renderCart();
}

function stepper(key, qty, name) {
  return `
    <span class="qty">
      <button type="button" data-dec="${esc(key)}" aria-label="Remove one ${esc(name)}">−</button>
      <span aria-live="polite">${qty}</span>
      <button type="button" data-inc="${esc(key)}" aria-label="Add one more ${esc(name)}">+</button>
    </span>`;
}

// ---------- Cart Rendering ----------

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

  const upsellEl = document.getElementById('cart-upsell');
  if (upsellEl && ordersOpen) {
    const inCartIds = new Set(cart.filter((l) => !l.custom_box).map((l) => l.id));
    const candidates = items.filter((it) => !inCartIds.has(it.id) && !it.options.some((g) => g.required));
    const picks = candidates.slice(0, 2);
    if (picks.length && count > 0) {
      upsellEl.hidden = false;
      upsellEl.innerHTML = `
        <div class="cart-upsell-head">✦ Complete your treat</div>
        <div class="cart-upsell-list">
          ${picks.map((u) => `
            <div class="cart-upsell-item">
              <div class="cart-upsell-info">
                <strong>${esc(u.name)}</strong>
                <span>${money(u.price_cents)}</span>
              </div>
              <button type="button" class="btn btn-outline btn-sm" data-add-quick="${u.id}">+ Add</button>
            </div>
          `).join('')}
        </div>`;
    } else {
      upsellEl.hidden = true;
      upsellEl.innerHTML = '';
    }
  }

  document.getElementById('sum-rows').innerHTML = fee
    ? `<div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
       <div class="sum-row"><span>Delivery</span><span>${money(fee)}</span></div>`
    : '';
  document.getElementById('cart-total').textContent = money(subtotal + fee);

  const bar = document.getElementById('cart-bar');
  if (bar) {
    bar.classList.toggle('show', count > 0);
    document.getElementById('cart-bar-count').textContent = `View order · ${count} item${count === 1 ? '' : 's'}`;
    document.getElementById('cart-bar-total').textContent = money(subtotal + fee);
  }
}

// ---------- View Router & Navigation Controller ----------

let currentCategory = null;
let currentProduct = null;
let currentProductPicks = [];
let currentProductQty = 1;

function switchStageView(targetId) {
  [viewFolders, viewCategory, viewProduct, viewSearch].forEach((el) => {
    if (el) el.hidden = el.id !== targetId;
  });

  const stage = document.getElementById('menu-stage-wrapper');
  if (stage && window.scrollY > stage.offsetTop + 120) {
    stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateBreadcrumbs(state) {
  if (!breadcrumb) return;

  if (state.view === 'folders') {
    breadcrumb.hidden = true;
    return;
  }

  breadcrumb.hidden = false;

  if (state.view === 'category') {
    bcSepCat.hidden = false;
    bcCat.hidden = false;
    bcCat.textContent = state.category;
    bcCat.href = `#category/${encodeURIComponent(state.category)}`;
    bcCat.classList.add('bc-current');
    bcSepProd.hidden = true;
    bcProd.hidden = true;
    bcProd.textContent = '';
  } else if (state.view === 'product') {
    bcSepCat.hidden = false;
    bcCat.hidden = false;
    bcCat.textContent = state.category;
    bcCat.href = `#category/${encodeURIComponent(state.category)}`;
    bcCat.classList.remove('bc-current');
    bcSepProd.hidden = false;
    bcProd.hidden = false;
    bcProd.textContent = state.product.name;
  } else if (state.view === 'search') {
    bcSepCat.hidden = false;
    bcCat.hidden = false;
    bcCat.textContent = 'Search Results';
    bcCat.href = '#folders';
    bcCat.classList.add('bc-current');
    bcSepProd.hidden = true;
    bcProd.hidden = true;
    bcProd.textContent = '';
  }
}

// ---------- Tier 1: Category Folders Overview ----------

function showFoldersView() {
  if (!foldersGrid) return;
  const categories = new Map();
  for (const item of items) {
    if (!categories.has(item.category)) categories.set(item.category, []);
    categories.get(item.category).push(item);
  }

  const cardsHtml = [...categories.entries()].map(([catName, catItems]) => {
    const meta = CATEGORY_META[catName] || {
      desc: 'Handcrafted atelier specialties and gourmet recipes.',
      icon: DEFAULT_CATEGORY_ICON,
    };
    return `
      <a class="folder-card" href="#category/${encodeURIComponent(catName)}" data-nav-cat="${esc(catName)}">
        <div class="folder-card-top">
          <div class="folder-icon">${meta.icon}</div>
          <span class="folder-count-badge">${catItems.length} item${catItems.length === 1 ? '' : 's'}</span>
        </div>
        <div>
          <h3 class="folder-title">${esc(catName)}</h3>
          <p class="folder-desc">${esc(meta.desc)}</p>
        </div>
        <div class="folder-action">
          <span>Explore Category</span>
          <span class="folder-arrow" aria-hidden="true">→</span>
        </div>
      </a>`;
  }).join('');

  const boxCardHtml = `
    <div class="folder-card folder-card-bespoke" role="button" tabindex="0" id="folder-box-builder" style="border-color: var(--line-strong); background: linear-gradient(145deg, #FDFDE9, #F5F1C6);">
      <div class="folder-card-top">
        <div class="folder-icon" style="background: var(--text); color: var(--gold-light);">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M12 8C10.5 5 8 5 8 6.5s2 1.5 4 1.5c2 0 4 0 4-1.5S13.5 5 12 8z"/></svg>
        </div>
        <span class="folder-count-badge" style="background: var(--text); color: var(--bg); border-color: var(--text);">✦ Bespoke Studio</span>
      </div>
      <div>
        <h3 class="folder-title">Luxury Gift Boxes</h3>
        <p class="folder-desc">Hand-pick 9, 16, or 25 artisan truffles in an embossed keepsake box with personalized satin ribbon.</p>
      </div>
      <div class="folder-action">
        <span>Build Your Box</span>
        <span class="folder-arrow" aria-hidden="true">→</span>
      </div>
    </div>`;

  foldersGrid.innerHTML = cardsHtml + boxCardHtml;

  document.getElementById('folder-box-builder')?.addEventListener('click', () => {
    document.getElementById('open-box-builder')?.click();
  });

  updateBreadcrumbs({ view: 'folders' });
  switchStageView('view-folders');
}

// ---------- Tier 2: Category Products Drill-Down (Good Morning Pattern) ----------

function renderRowCard(item) {
  const from = item.options.length && fromPrice(item) !== item.price_cents;
  const badges = inferMenuBadges(item);
  const optTag = item.options.length ? '✦ Customizable options' : '✦ Single portion';

  return `
    <article class="menu-row-card" data-open-product="${item.id}" role="button" tabindex="0" aria-label="View ${esc(item.name)} details">
      <div class="row-card-left">
        <div class="row-card-title-row">
          <h3 class="row-card-title">${esc(item.name)}</h3>
          ${badges.length ? `<span class="menu-badge ${badges[0].cls}">${esc(badges[0].label)}</span>` : ''}
        </div>
        <p class="row-card-desc">${esc(item.description)}</p>
        <div class="row-card-footer">
          <span class="row-card-price">${from ? '<span class="from">from</span>' : ''}${money(from ? fromPrice(item) : item.price_cents)}</span>
          <span class="row-card-opt-tag">${optTag}</span>
        </div>
      </div>
      <div class="row-card-right">
        <div class="row-card-thumb">
          ${item.image ? `<img src="/uploads/${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">` : illustrationFor(item)}
        </div>
        <button type="button" class="row-card-btn" data-open-product="${item.id}">
          ${item.options.length ? 'Customize →' : 'Select →'}
        </button>
      </div>
    </article>`;
}

function showCategoryView(catName) {
  const catItems = items.filter((i) => i.category === catName);
  if (!catItems.length) {
    window.location.hash = '#folders';
    return;
  }
  currentCategory = catName;

  const meta = CATEGORY_META[catName] || {
    desc: 'Handcrafted atelier specialties and gourmet recipes.',
    icon: DEFAULT_CATEGORY_ICON,
  };

  catBannerTitle.textContent = catName;
  catBannerDesc.textContent = meta.desc;
  catBannerIcon.innerHTML = meta.icon;
  catProductsCount.textContent = `${catItems.length} creation${catItems.length === 1 ? '' : 's'} available to order`;

  categoryRowsList.innerHTML = catItems.map(renderRowCard).join('');

  updateBreadcrumbs({ view: 'category', category: catName });
  switchStageView('view-category');
}

// ---------- Tier 3: Dedicated Product Page ----------

function showProductView(productId) {
  const item = itemsById.get(Number(productId));
  if (!item) {
    window.location.hash = '#folders';
    return;
  }

  currentProduct = item;
  currentCategory = item.category;
  currentProductQty = 1;

  // Initialize option picks: default to first choice if required single, else empty
  currentProductPicks = item.options.map((g) => {
    if (g.type === 'single' && g.required && g.choices.length > 0) return [0];
    return [];
  });

  prodBackCatName.textContent = item.category;

  const from = item.options.length && fromPrice(item) !== item.price_cents;
  const badges = inferMenuBadges(item);

  const optionsHtml = item.options.map((g, gi) => {
    const isSingle = g.type === 'single';
    const note = g.required
      ? (isSingle ? 'Required · Pick 1' : 'Required · Choose any')
      : (isSingle ? 'Optional · Pick 1' : 'Optional · Choose any');

    if (isSingle) {
      return `
        <div class="option-group-box">
          <div class="option-group-title">
            <span>${esc(g.name)}</span>
            <span style="font-size: 0.72rem; color: var(--muted); text-transform: none; font-weight: 500;">${note}</span>
          </div>
          <div class="variant-bubbles-wrap">
            ${!g.required ? `
              <button type="button" class="variant-bubble-btn ${currentProductPicks[gi].length === 0 ? 'active' : ''}" data-bubble-group="${gi}" data-bubble-choice="-1">
                None
              </button>` : ''}
            ${g.choices.map((c, ci) => `
              <button type="button" class="variant-bubble-btn ${currentProductPicks[gi].includes(ci) ? 'active' : ''}" data-bubble-group="${gi}" data-bubble-choice="${ci}">
                ${esc(c.name)} ${c.price_cents ? `(+${money(c.price_cents)})` : ''}
              </button>`).join('')}
          </div>
        </div>`;
    }

    return `
      <div class="option-group-box">
        <div class="option-group-title">
          <span>${esc(g.name)}</span>
          <span style="font-size: 0.72rem; color: var(--muted); text-transform: none; font-weight: 500;">${note}</span>
        </div>
        <div class="addon-options-list">
          ${g.choices.map((c, ci) => `
            <label class="addon-option-row">
              <span>
                <input type="checkbox" data-addon-group="${gi}" data-addon-choice="${ci}" ${currentProductPicks[gi].includes(ci) ? 'checked' : ''}>
                <span>${esc(c.name)}</span>
              </span>
              <span class="addon-option-price">${c.price_cents ? `+${money(c.price_cents)}` : 'Included'}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }).join('');

  productPageCard.innerHTML = `
    <div class="product-page-grid">
      <div class="product-page-visual">
        <span class="choco-price-badge">PRICE<br><strong>${money(item.price_cents)}</strong></span>
        ${item.image ? `<img src="/uploads/${esc(item.image)}" alt="${esc(item.name)}">` : illustrationFor(item)}
      </div>

      <div class="product-page-body">
        <div class="product-kicker">${esc(item.category)}</div>
        <h2 class="product-page-title">${esc(item.name)}</h2>

        <div class="product-page-price-row">
          <span class="product-live-price" id="prod-live-price">${money(unitPrice(item, currentProductPicks) * currentProductQty)}</span>
          ${badges.map((b) => `<span class="menu-badge ${b.cls}">${esc(b.label)}</span>`).join('')}
        </div>

        <p class="product-page-desc">${esc(item.description)}</p>

        <div class="product-tasting-box">
          <strong>✦ Tasting Note:</strong> ${esc(inferPairing(item))}
        </div>

        <div id="product-options-root">
          ${optionsHtml}
        </div>

        <div class="option-group-box" style="border-bottom: none; margin-bottom: 8px;">
          <label for="prod-note-input" class="option-group-title" style="margin-bottom: 6px;">
            <span>Special Requests &amp; Notes</span>
            <span style="font-size: 0.72rem; color: var(--muted); text-transform: none; font-weight: 500;">Optional</span>
          </label>
          <input type="text" id="prod-note-input" placeholder="Candle request, packaging notes, allergies…" style="width: 100%; padding: 10px 14px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: 0.88rem;">
        </div>

        <div class="product-page-actions">
          <div class="qty" style="padding: 2px 4px;">
            <button type="button" id="prod-qty-dec" aria-label="Decrease quantity">−</button>
            <span id="prod-qty-display" aria-live="polite">1</span>
            <button type="button" id="prod-qty-inc" aria-label="Increase quantity">+</button>
          </div>

          <button type="button" class="btn btn-gold product-add-btn" id="prod-add-btn" ${ordersOpen ? '' : 'disabled'}>
            ${ordersOpen ? `Add to Order · ${money(unitPrice(item, currentProductPicks) * currentProductQty)}` : 'Atelier Closed'}
          </button>
        </div>
      </div>
    </div>`;

  function updateProductLiveDisplay() {
    const unit = unitPrice(currentProduct, currentProductPicks);
    const total = unit * currentProductQty;
    const priceEl = productPageCard.querySelector('#prod-live-price');
    if (priceEl) priceEl.textContent = money(total);
    const qtyEl = productPageCard.querySelector('#prod-qty-display');
    if (qtyEl) qtyEl.textContent = String(currentProductQty);
    const btnEl = productPageCard.querySelector('#prod-add-btn');
    if (btnEl && ordersOpen) {
      btnEl.innerHTML = `Add to Order · ${money(total)}`;
    }
  }

  // Bind variant bubbles
  productPageCard.querySelectorAll('[data-bubble-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gi = Number(btn.dataset.bubbleGroup);
      const ci = Number(btn.dataset.bubbleChoice);
      currentProductPicks[gi] = ci === -1 ? [] : [ci];
      productPageCard.querySelectorAll(`[data-bubble-group="${gi}"]`).forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      playClick();
      updateProductLiveDisplay();
    });
  });

  // Bind add-on checkboxes
  productPageCard.querySelectorAll('[data-addon-group]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const gi = Number(chk.dataset.addonGroup);
      currentProductPicks[gi] = [...productPageCard.querySelectorAll(`[data-addon-group="${gi}"]:checked`)]
        .map((c) => Number(c.dataset.addonChoice));
      playClick();
      updateProductLiveDisplay();
    });
  });

  // Bind stepper
  productPageCard.querySelector('#prod-qty-dec')?.addEventListener('click', () => {
    currentProductQty = Math.max(1, currentProductQty - 1);
    playClick();
    updateProductLiveDisplay();
  });
  productPageCard.querySelector('#prod-qty-inc')?.addEventListener('click', () => {
    currentProductQty = Math.min(99, currentProductQty + 1);
    playClick();
    updateProductLiveDisplay();
  });

  // Bind Add to Order
  productPageCard.querySelector('#prod-add-btn')?.addEventListener('click', (e) => {
    if (!ordersOpen) return;
    if (!picksValid(currentProduct, currentProductPicks)) {
      const missing = currentProduct.options.find((g, gi) => g.required && !currentProductPicks[gi].length);
      alert(missing ? `Please select a ${missing.name.toLowerCase()}.` : 'Please check your option selections.');
      return;
    }

    const note = productPageCard.querySelector('#prod-note-input')?.value?.trim();
    if (note && form.notes) {
      const prev = form.notes.value.trim();
      form.notes.value = prev ? `${prev} | ${currentProduct.name}: ${note}` : `${currentProduct.name}: ${note}`;
    }

    addToCart(currentProduct.id, currentProductPicks, currentProductQty, e.currentTarget);

    const btn = e.currentTarget;
    const prevText = btn.innerHTML;
    btn.innerHTML = '<span>✓ Added to Order!</span>';
    setTimeout(() => {
      if (btn) btn.innerHTML = prevText;
    }, 1500);
  });

  updateBreadcrumbs({ view: 'product', category: item.category, product: item });
  switchStageView('view-product');
}

// ---------- Tier 4: Search & Quick Filters View ----------

let activeSearchQuery = '';
let activeQuickFilter = 'all';

function matchesFilter(item) {
  const text = `${item.name} ${item.description} ${item.category}`.toLowerCase();
  if (activeSearchQuery && !text.includes(activeSearchQuery)) return false;
  if (activeQuickFilter === 'popular') return /lava|mirror|kunafa|gift box|fettuccine|flurry/i.test(text);
  if (activeQuickFilter === 'pistachio') return /pistachio|kunafa|hazelnut|praline|nut/i.test(text);
  if (activeQuickFilter === 'dark') return /dark|70%|ganache|mirror|lava|truffle|bark/i.test(text);
  if (activeQuickFilter === 'under10') return fromPrice(item) <= 1000;
  return true;
}

function renderSearchView() {
  const filtered = items.filter(matchesFilter);
  searchTitle.textContent = `Showing ${filtered.length} creation${filtered.length === 1 ? '' : 's'}`;

  if (!filtered.length) {
    searchRowsList.innerHTML = `
      <div class="card empty-state" style="padding: 36px 20px; text-align: center;">
        <p style="margin-bottom: 14px;">No creations match your current search or filter.</p>
        <button type="button" class="btn btn-outline btn-sm" id="reset-empty-search">Show All Categories</button>
      </div>`;
    document.getElementById('reset-empty-search')?.addEventListener('click', resetSearchAndFilters);
  } else {
    searchRowsList.innerHTML = filtered.map(renderRowCard).join('');
  }

  updateBreadcrumbs({ view: 'search' });
  switchStageView('view-search');
}

function resetSearchAndFilters() {
  activeSearchQuery = '';
  activeQuickFilter = 'all';
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.hidden = true;
  filterPills?.querySelectorAll('[data-qfilter]').forEach((b) => b.classList.toggle('active', b.dataset.qfilter === 'all'));
  window.location.hash = '#folders';
}

searchInput?.addEventListener('input', () => {
  activeSearchQuery = searchInput.value.trim().toLowerCase();
  if (searchClear) searchClear.hidden = !activeSearchQuery;
  if (activeSearchQuery || activeQuickFilter !== 'all') {
    renderSearchView();
  } else {
    handleHashRouting();
  }
});

searchClear?.addEventListener('click', () => {
  if (!searchInput) return;
  searchInput.value = '';
  activeSearchQuery = '';
  searchClear.hidden = true;
  if (activeQuickFilter !== 'all') {
    renderSearchView();
  } else {
    handleHashRouting();
  }
});

clearSearchBtn?.addEventListener('click', resetSearchAndFilters);

filterPills?.addEventListener('click', (e) => {
  const pill = e.target.closest('[data-qfilter]');
  if (!pill) return;
  activeQuickFilter = pill.dataset.qfilter;
  filterPills.querySelectorAll('[data-qfilter]').forEach((b) => b.classList.toggle('active', b === pill));
  if (activeQuickFilter !== 'all' || activeSearchQuery) {
    renderSearchView();
  } else {
    handleHashRouting();
  }
});

// ---------- Hash Router Controller ----------

function handleHashRouting() {
  if (activeSearchQuery || activeQuickFilter !== 'all') {
    renderSearchView();
    return;
  }

  const hash = window.location.hash.trim() || '#folders';

  if (hash.startsWith('#product/')) {
    const id = Number(hash.slice('#product/'.length));
    showProductView(id);
    return;
  }

  if (hash.startsWith('#category/')) {
    const raw = hash.slice('#category/'.length);
    const catName = decodeURIComponent(raw);
    showCategoryView(catName);
    return;
  }

  // Default to folder overview
  showFoldersView();
}

window.addEventListener('hashchange', handleHashRouting);

// Back buttons navigation
catBackBtn?.addEventListener('click', () => { window.location.hash = '#folders'; });
catSwitchBtn?.addEventListener('click', () => { window.location.hash = '#folders'; });
prodBackBtn?.addEventListener('click', () => {
  if (currentCategory) {
    window.location.hash = `#category/${encodeURIComponent(currentCategory)}`;
  } else {
    window.location.hash = '#folders';
  }
});

// Row cards clicks (navigates to product page)
document.addEventListener('click', (e) => {
  const rowBtn = e.target.closest('[data-open-product]');
  if (rowBtn) {
    e.preventDefault();
    const id = Number(rowBtn.dataset.openProduct);
    window.location.hash = `#product/${id}`;
    return;
  }

  const quickAdd = e.target.closest('[data-add-quick]');
  if (quickAdd && ordersOpen) {
    const id = Number(quickAdd.dataset.addQuick);
    addToCart(id, [], 1, quickAdd);
    return;
  }

  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  if (inc) changeLine(inc.dataset.inc, 1);
  if (dec) changeLine(dec.dataset.dec, -1);
});

// ---------- Interactive Gift Box Builder Modal ----------

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
  if (boxError) boxError.hidden = true;
  if (boxSlots.length === 0) {
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
    boxSlots[activeBoxSize - 1] = truffle;
  }
  if (boxError) boxError.hidden = true;
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
  if (boxError) boxError.hidden = true;
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
  while (boxSlots.length < activeBoxSize) {
    boxSlots.push(TRUFFLES[boxSlots.length % TRUFFLES.length]);
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

// ---------- Checkout Form & Fulfillment ----------

fulfillment = setupFulfillment(form, settings, renderCart);
const branchOf = await setupBranches(form);

renderCart();
handleHashRouting();

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
  document.getElementById('cart-bar')?.remove();
  confetti();
  playCelebration();
  document.getElementById('page').innerHTML = orderConfirmation(order, {
    name,
    title: 'your order is in!',
    shopName: settings.shop_name,
    links: `<a class="btn btn-gold" href="/track?code=${encodeURIComponent(order.order_code || order.code)}">Track order live</a><a class="btn btn-outline" href="/">Order more from menu</a>`,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Chef's Spotlight Showcase (Duo Carousel) ----------

const duoGrid = document.getElementById('choco-duo-grid');
const spotlightPool = [
  items.find((i) => /lava|muffin/i.test(i.name)) || { id: 0, name: 'Molten Chocolate Lava Crown', price_cents: 650, options: [], artKey: 'cupcake' },
  items.find((i) => /mirror|torte|orange/i.test(i.name)) || { id: 0, name: 'Mirror-Glaze Orange & Dark Torte', price_cents: 2800, options: [], artKey: 'cake' },
  items.find((i) => /kunafa/i.test(i.name)) || { id: 0, name: 'Pistachio Kunafa Chocolate Bar', price_cents: 950, options: [], artKey: 'chocolate' },
  items.find((i) => /crepe/i.test(i.name)) || { id: 0, name: 'Triple Belgian Chocolate Crepe', price_cents: 750, options: [], artKey: 'crepe' },
];
let duoIndex = 0;

function renderDuo() {
  if (!duoGrid) return;
  const pair = [
    spotlightPool[duoIndex % spotlightPool.length],
    spotlightPool[(duoIndex + 1) % spotlightPool.length],
  ];
  duoGrid.innerHTML = pair.map((it) => `
    <div class="choco-showcase-card choco-duo-card">
      <div class="choco-frame choco-duo-frame">
        <span class="choco-price-badge">PRICE<br><strong>${money(it.price_cents)}</strong></span>
        <div class="choco-duo-art">${it.image ? `<img src="/uploads/${esc(it.image)}" alt="${esc(it.name)}">` : (it.artKey ? art(it.artKey) : illustrationFor(it))}</div>
      </div>
      <button type="button" class="choco-title-bar" data-duo-pick="${it.id || ''}">${esc(it.name)}</button>
      <button type="button" class="choco-buy-link" data-duo-pick="${it.id || ''}">BUY NOW</button>
    </div>
  `).join('');
}

renderDuo();

document.getElementById('duo-prev')?.addEventListener('click', () => {
  duoIndex = (duoIndex - 1 + spotlightPool.length) % spotlightPool.length;
  renderDuo();
});
document.getElementById('duo-next')?.addEventListener('click', () => {
  duoIndex = (duoIndex + 1) % spotlightPool.length;
  renderDuo();
});
duoGrid?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-duo-pick]');
  if (!btn) return;
  const id = Number(btn.dataset.duoPick);
  const item = itemsById.get(id);
  if (item) {
    window.location.hash = `#product/${item.id}`;
  } else {
    document.getElementById('menu-stage-wrapper')?.scrollIntoView({ behavior: 'smooth' });
  }
});

// ---------- Featured Products in Dark Cocoa Sawtooth Section ----------

const PRODUCT_LINES = [
  { art: 'cupcake', name: 'Molten Lava Bakes', price: '$ 6.50', href: '#menu' },
  { art: 'cake', name: 'Mirror-Glaze Tortes', price: '$ 28.00', href: '#menu' },
  { art: 'chocolate', name: 'Pistachio Kunafa Bars', price: '$ 9.50', href: '#menu' },
  { art: 'crepe', name: 'Belgian Chocolate Crepes', price: '$ 7.50', href: '#menu' },
  { art: 'icecream', name: 'Savory Oreo Flurry', price: '$ 6.00', href: '#menu' },
  { art: 'shake', name: 'Ferrero Thick Shakes', price: '$ 7.00', href: '#menu' },
];

const linesEl = document.getElementById('product-lines');
if (linesEl) {
  linesEl.innerHTML = PRODUCT_LINES.map((p, i) => `
    <a class="card spotlight product-line choco-square-card" href="${p.href}" data-reveal style="--delay: ${(i % 3) * 0.07}s">
      <div class="choco-square-art">${art(p.art)}</div>
      <h3>${esc(p.name)}</h3>
      <div class="choco-square-price">${esc(p.price)}</div>
    </a>`).join('');
  reveal(linesEl);
}

const ghostL = document.getElementById('wide-ghost-left');
const ghostR = document.getElementById('wide-ghost-right');
if (ghostL) ghostL.innerHTML = art('cake');
if (ghostR) ghostR.innerHTML = art('cupcake');

document.querySelectorAll('[data-open-box]').forEach((btn) => {
  btn.addEventListener('click', () => document.getElementById('open-box-builder')?.click());
});
