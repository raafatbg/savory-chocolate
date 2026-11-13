import {
  api, esc, money, storage, isoDate, loadSettings, setupFulfillment, deliveryFee, reveal,
  setupBranches, orderConfirmation, openWhatsApp, applyLanguage,
} from '/js/common.js';
import { illustrationFor } from '/js/illustrations.js';
import { confetti } from '/js/confetti.js';
import { playClick, playPop, playCelebration } from '/js/audio.js';

const CART_KEY = 'sc_cart_v2';

const BOX_TIERS = {
  9: { size: 9, cols: 3, name: 'SAVORY 9-Piece Assorted Gift Box', price_cents: 1800 },
  16: { size: 16, cols: 4, name: 'SAVORY 16-Piece Luxury Gift Box', price_cents: 3000 },
  25: { size: 25, cols: 5, name: 'SAVORY 25-Piece Grand Selection Box', price_cents: 4500 },
};

const TRUFFLES = [
  { id: 'pistachio', name: 'Pistachio Kunafa', color: '#96bc61', accent: '#d9b066' },
  { id: 'hazelnut', name: 'Hazelnut Praline', color: '#5c2c12', accent: '#e3c184' },
  { id: 'caramel', name: 'Salted Caramel', color: '#c67d2d', accent: '#4C2007' },
  { id: 'dark70', name: '70% Dark Ganache', color: '#2b1206', accent: '#d9b066' },
  { id: 'lotus', name: 'Lotus Speculoos', color: '#b56e33', accent: '#f6ead8' },
  { id: 'raspberry', name: 'Raspberry Velvet', color: '#8c1832', accent: '#f4b6c2' },
  { id: 'espresso', name: 'Arabic Coffee Roast', color: '#3b1c0c', accent: '#c9a063' },
  { id: 'white', name: 'Almond Blanc', color: '#f3dfba', accent: '#7A3912' },
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
  Bakes: {
    desc: 'Freshly baked Belgian chocolate brownies, chewy cookies, and afternoon treats.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><circle cx="10" cy="15" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>`,
  },
  Drinks: {
    desc: 'Signature warm Belgian hot chocolate, iced beverages, and specialty roasts.',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  },
};

const CATEGORY_PRIORITY = [
  'Chocolates & Bark',
  'Crepes & Waffles',
  'Savory Flurry & Shakes',
  'Signature Gateaux & Bakes',
  'Cakes by the slice',
  'Bakes',
  'Drinks',
];

const CATEGORY_COVER = {
  'Chocolates & Bark': '/img/onboarding-kunafa.jpg',
  'Crepes & Waffles': '/img/onboarding-crepe.jpg',
  'Savory Flurry & Shakes': '/img/onboarding-flurry.jpg',
  'Signature Gateaux & Bakes': '/img/menu-lava-crown.jpg',
  'Cakes by the slice': '/img/menu-fudge-slice.jpg',
  Bakes: '/img/menu-brownie.jpg',
  Drinks: '/img/menu-hot-choc.jpg',
};

const DEFAULT_CATEGORY_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

function mediaSrc(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/') || /^https?:\/\//i.test(raw)) return raw;
  return `/uploads/${raw}`;
}

function isVideoSlide(slide) {
  return slide?.media_type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(String(slide?.media_url || ''));
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- DOM References ----------
const viewOnboarding = document.getElementById('view-onboarding');
const onboardingBg = document.getElementById('onboarding-bg');
const onboardingSlogan = document.getElementById('onboarding-slogan');
const onboardingCaption = document.getElementById('onboarding-caption');
const onboardingDots = document.getElementById('onboarding-dots');
const onboardCartBtn = document.getElementById('onboard-cart-btn');
const onboardCartCount = document.getElementById('onboard-cart-count');

const storefrontShell = document.getElementById('storefront-shell');
const visitSection = document.getElementById('visit-section');

const viewMenu = document.getElementById('view-menu');
const viewCategory = document.getElementById('view-category');
const viewProduct = document.getElementById('view-product');
const viewCart = document.getElementById('view-cart');
const viewSearch = document.getElementById('view-search');

const featuredSliderEl = document.getElementById('featured-slider');
const sliderViewport = document.getElementById('slider-viewport');
const sliderTrack = document.getElementById('slider-track');
const sliderCounter = document.getElementById('slider-counter');
const sliderPrev = document.getElementById('slider-prev');
const sliderNext = document.getElementById('slider-next');
const sliderDots = document.getElementById('slider-dots');

const categoriesSection = document.getElementById('categories-section');
const boxBanner = document.getElementById('box-banner');

const breadcrumb = document.getElementById('menu-breadcrumb');
const bcSepCat = document.getElementById('bc-sep-cat');
const bcCat = document.getElementById('bc-cat');
const bcSepProd = document.getElementById('bc-sep-prod');
const bcProd = document.getElementById('bc-prod');

const foldersGrid = document.getElementById('folders-grid');
const categoryRowsList = document.getElementById('category-rows-list');
const searchRowsList = document.getElementById('search-rows-list');
const productPageCard = document.getElementById('product-page-card');
const productRelatedSection = document.getElementById('product-related-section');
const productRelatedGrid = document.getElementById('product-related-grid');

const catBannerTitle = document.getElementById('cat-banner-title');
const catBannerDesc = document.getElementById('cat-banner-desc');
const catBannerIcon = document.getElementById('cat-banner-icon');
const catBackBtn = document.getElementById('cat-back-btn');
const catPillsNav = document.getElementById('cat-pills-nav');
const catProductsCount = document.getElementById('cat-products-count');

const prodBackBtn = document.getElementById('prod-back-btn');
const prodBackCatName = document.getElementById('prod-back-cat-name');
const prodHeaderBadge = document.getElementById('prod-header-badge');

const searchInput = document.getElementById('menu-search');
const searchClear = document.getElementById('menu-search-clear');
const filterPills = document.getElementById('menu-filter-pills');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchTitle = document.getElementById('search-title');

const headerCartBtn = document.getElementById('header-cart-btn');
const headerCartCount = document.getElementById('header-cart-count');
const clearCartBtn = document.getElementById('clear-cart-btn');
const cartConfirmation = document.getElementById('cart-confirmation');
const cartEmpty = document.getElementById('cart-empty');
const cartContent = document.getElementById('cart-content');
const cartItemsCountLabel = document.getElementById('cart-items-count-label');
const cartLinesEl = document.getElementById('cart-lines');

const form = document.getElementById('checkout-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('form-error');

// Avoid onboarding flash on direct deep-link navigation (e.g. /#menu, /#category/..., /#cart).
const initialHash = window.location.hash.trim();
if (initialHash && initialHash !== '#welcome') {
  document.body.classList.remove('is-onboarding');
  if (viewOnboarding) viewOnboarding.hidden = true;
  if (storefrontShell) storefrontShell.hidden = false;
  if (initialHash === '#cart') {
    document.body.classList.add('is-cart-page');
    [viewMenu, viewCategory, viewProduct, viewCart].forEach((el) => {
      if (el) el.hidden = el.id !== 'view-cart';
    });
  }
}

// ---------- Parallel Data Fetch ----------
const [settings, loadedItems, loadedOffers, loadedSlides] = await Promise.all([
  loadSettings(),
  api('/api/menu').catch((err) => {
    if (foldersGrid) foldersGrid.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    return [];
  }),
  api('/api/offers').catch(() => []),
  api('/api/onboarding').catch(() => []),
]);

const items = Array.isArray(loadedItems) ? loadedItems : [];
const offers = Array.isArray(loadedOffers) ? loadedOffers : [];
const onboardingSlides = Array.isArray(loadedSlides) ? loadedSlides : [];
const itemsById = new Map(items.map((i) => [i.id, i]));

const ordersOpen = settings.orders_open !== '0';
if (!ordersOpen) {
  const closedNotice = document.getElementById('closed-notice');
  if (closedNotice) closedNotice.hidden = false;
  if (submitBtn) submitBtn.disabled = true;
}

if (form?.pickup_date) {
  form.pickup_date.min = isoDate(0);
  form.pickup_date.max = isoDate(180);
  form.pickup_date.value = isoDate(0);
}

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
  if (item.compare_price_cents > item.price_cents) {
    badges.push({ label: `Save ${money(item.compare_price_cents - item.price_cents)}`, cls: 'badge-offer' });
  }
  if (item.offer_badge) {
    badges.push({ label: item.offer_badge, cls: 'badge-chef' });
  } else if (/lava|mirror|kunafa|gift box|fettuccine|flurry/i.test(text)) {
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
    return 'Enjoy warm with a scoop of Madagascar vanilla gelato or a cup of velvety Belgian hot chocolate.';
  }
  if (/flurry|shake/.test(text)) {
    return 'Pairs effortlessly with a warm fudge brownie or hand-broken roasted almond bark.';
  }
  if (/box|praline|truffle|bark|nut/.test(text)) {
    return 'Hand-tempered in small batches — pairs wonderfully with freshly roasted Arabic coffee.';
  }
  return 'Freshly crafted to order in our Aramoun & Aley kitchens.';
}

// ---------- Screen 0: Cinematic Onboarding Controller ----------

if (onboardingSlogan) {
  onboardingSlogan.textContent = settings.slogan || 'Where every bite is a Savory moment';
}

const activeOnboardingSlides = onboardingSlides.length
  ? onboardingSlides
  : [{ media_type: 'image', media_url: '/img/onboarding-box.jpg', caption: 'Handcrafted in Aramoun & Aley' }];

let onboardIdx = 0;
let onboardTimer = null;
let onboardSlideEls = [];
let onboardDotEls = [];

function setupOnboardingMedia() {
  if (!onboardingBg) return;
  onboardingBg.innerHTML = '';
  onboardSlideEls = activeOnboardingSlides.map((slide, i) => {
    const wrap = document.createElement('div');
    wrap.className = `onboarding-slide${i === 0 ? ' is-active' : ''}`;
    if (isVideoSlide(slide)) {
      const video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.preload = 'metadata';
      video.src = mediaSrc(slide.media_url);
      video.addEventListener('error', () => {
        const fallback = document.createElement('img');
        fallback.src = '/img/onboarding-box.jpg';
        fallback.alt = '';
        wrap.innerHTML = '';
        wrap.append(fallback);
      }, { once: true });
      wrap.append(video);
    } else {
      const img = document.createElement('img');
      img.src = mediaSrc(slide.media_url);
      img.alt = '';
      img.decoding = 'async';
      wrap.append(img);
    }
    onboardingBg.append(wrap);
    return wrap;
  });

  if (onboardingDots) {
    onboardingDots.innerHTML = activeOnboardingSlides.length > 1
      ? activeOnboardingSlides.map((_, i) => `
          <button type="button" class="onboarding-dot${i === 0 ? ' is-active' : ''}" data-onboard-slide="${i}" aria-label="Show highlight ${i + 1}"></button>
        `).join('')
      : '';
    onboardDotEls = [...onboardingDots.querySelectorAll('.onboarding-dot')];
  }
}

function setOnboardingSlide(nextIdx) {
  if (!onboardSlideEls.length) return;
  onboardIdx = ((nextIdx % onboardSlideEls.length) + onboardSlideEls.length) % onboardSlideEls.length;

  onboardSlideEls.forEach((el, i) => {
    const active = i === onboardIdx;
    el.classList.toggle('is-active', active);
    const vid = el.querySelector('video');
    if (vid) {
      if (active && document.body.classList.contains('is-onboarding') && !document.hidden) {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }
  });

  onboardDotEls.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === onboardIdx);
  });

  if (onboardingCaption) {
    onboardingCaption.textContent = activeOnboardingSlides[onboardIdx]?.caption || '';
  }

  scheduleOnboardingAdvance();
}

function scheduleOnboardingAdvance() {
  clearTimeout(onboardTimer);
  onboardTimer = null;
  if (
    activeOnboardingSlides.length <= 1
    || !document.body.classList.contains('is-onboarding')
    || document.hidden
    || reducedMotion()
  ) {
    return;
  }
  const current = activeOnboardingSlides[onboardIdx];
  const delay = isVideoSlide(current) ? 8500 : 5000;
  onboardTimer = setTimeout(() => {
    setOnboardingSlide(onboardIdx + 1);
  }, delay);
}

function pauseOnboardingMedia() {
  clearTimeout(onboardTimer);
  onboardTimer = null;
  onboardSlideEls.forEach((el) => el.querySelector('video')?.pause());
}

function resumeOnboardingMedia() {
  if (!onboardSlideEls.length) return;
  setOnboardingSlide(onboardIdx);
}

onboardingDots?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-onboard-slide]');
  if (!btn) return;
  setOnboardingSlide(Number(btn.dataset.onboardSlide));
});

setupOnboardingMedia();

// ---------- Screen 1: Featured Items & Admin Offers Carousel Slider ----------

const sliderSlides = [
  ...offers.map((offer) => ({ kind: 'offer', data: offer })),
  ...items.filter((m) => Number(m.featured) === 1).map((item) => ({ kind: 'item', data: item })),
];

let sliderIdx = 0;
let sliderTimer = null;
let sliderHoverPaused = false;

function buildSliderCard(entry) {
  if (entry.kind === 'offer') {
    const o = entry.data;
    const badgeText = o.badge || 'LIMITED OFFER';
    const targetProduct = o.target_type === 'product' ? itemsById.get(Number(o.target_value)) : null;
    const savingsCents = targetProduct && targetProduct.compare_price_cents > targetProduct.price_cents
      ? targetProduct.compare_price_cents - targetProduct.price_cents
      : 0;
    const priceSnippet = targetProduct
      ? `<div class="slider-price-row">
           ${targetProduct.compare_price_cents > targetProduct.price_cents ? `<del class="slider-compare-price">${money(targetProduct.compare_price_cents)}</del>` : ''}
           <span class="slider-live-price">${money(targetProduct.price_cents)}</span>
           ${savingsCents > 0 ? `<span class="slider-save-pill">Save ${money(savingsCents)}</span>` : ''}
         </div>`
      : '';

    let ctaHtml = `<a href="#categories-section" class="btn btn-gold slider-cta-btn">${esc(o.cta_text || 'Explore')} <span class="arrow" aria-hidden="true">→</span></a>`;
    if (o.target_type === 'product' && targetProduct) {
      ctaHtml = `<a href="#product/${targetProduct.id}" class="btn btn-gold slider-cta-btn" data-open-product="${targetProduct.id}">${esc(o.cta_text || 'View Product')} <span class="arrow" aria-hidden="true">→</span></a>`;
    } else if (o.target_type === 'category' && o.target_value) {
      ctaHtml = `<a href="#category/${encodeURIComponent(o.target_value)}" class="btn btn-gold slider-cta-btn">${esc(o.cta_text || 'Explore Category')} <span class="arrow" aria-hidden="true">→</span></a>`;
    } else if (o.target_type === 'box') {
      ctaHtml = `<button type="button" class="btn btn-gold slider-cta-btn" data-open-offer-box="${esc(o.target_value || '9')}">${esc(o.cta_text || 'Curate a Box')} <span class="arrow" aria-hidden="true">→</span></button>`;
    }

    const visualHtml = o.image
      ? `<img src="${esc(mediaSrc(o.image))}" alt="${esc(o.title)}" loading="eager">`
      : targetProduct?.image
        ? `<img src="${esc(mediaSrc(targetProduct.image))}" alt="${esc(targetProduct.name)}" loading="eager">`
        : targetProduct
          ? illustrationFor(targetProduct)
          : `<img src="/img/onboarding-box.jpg" alt="${esc(o.title)}" loading="eager">`;

    return `
      <article class="slider-slide">
        <div class="slider-slide-copy">
          <div class="slider-badge-row">
            <span class="slider-badge">${esc(badgeText)}</span>
          </div>
          <h3>${esc(o.title)}</h3>
          ${o.subtitle ? `<p class="slider-slide-desc">${esc(o.subtitle)}</p>` : ''}
          ${priceSnippet}
          <div class="slider-actions">
            ${ctaHtml}
          </div>
        </div>
        <div class="slider-slide-media">
          ${visualHtml}
        </div>
      </article>`;
  }

  const item = entry.data;
  const from = item.options.length && fromPrice(item) !== item.price_cents;
  const displayPrice = from ? fromPrice(item) : item.price_cents;
  const canQuickAdd = ordersOpen && !item.options.some((g) => g.required);
  const badgeText = item.offer_badge || "★ Chef's Signature";
  const savingsCents = item.compare_price_cents > item.price_cents
    ? item.compare_price_cents - item.price_cents
    : 0;

  return `
    <article class="slider-slide">
      <div class="slider-slide-copy">
        <div class="slider-badge-row">
          <span class="slider-badge">${esc(badgeText)}</span>
          <span class="slider-cat-pill">${esc(item.category)}</span>
        </div>
        <h3>${esc(item.name)}</h3>
        ${item.description ? `<p class="slider-slide-desc">${esc(item.description)}</p>` : ''}
        <div class="slider-price-row">
          ${item.compare_price_cents > item.price_cents ? `<del class="slider-compare-price">${money(item.compare_price_cents)}</del>` : ''}
          <span class="slider-live-price">${from ? '<small>from </small>' : ''}${money(displayPrice)}</span>
          ${savingsCents > 0 ? `<span class="slider-save-pill">Save ${money(savingsCents)}</span>` : ''}
        </div>
        <div class="slider-actions">
          <a href="#product/${item.id}" class="btn btn-gold slider-cta-btn" data-open-product="${item.id}">
            <span>View &amp; Customize</span>
            <span class="arrow" aria-hidden="true">→</span>
          </a>
          ${canQuickAdd ? `<button type="button" class="btn slider-quick-btn" data-add-quick="${item.id}">+ Quick Add</button>` : ''}
        </div>
      </div>
      <div class="slider-slide-media">
        ${item.image ? `<img src="${esc(mediaSrc(item.image))}" alt="${esc(item.name)}" loading="eager">` : illustrationFor(item)}
      </div>
    </article>`;
}

function setSliderIndex(idx) {
  if (!sliderSlides.length || !sliderTrack) return;
  sliderIdx = ((idx % sliderSlides.length) + sliderSlides.length) % sliderSlides.length;
  sliderTrack.style.transform = `translateX(-${sliderIdx * 100}%)`;
  if (sliderCounter) {
    const pad = (n) => String(n).padStart(2, '0');
    sliderCounter.textContent = `${pad(sliderIdx + 1)} / ${pad(sliderSlides.length)}`;
  }
  sliderDots?.querySelectorAll('.slider-dot').forEach((d, i) => {
    const active = i === sliderIdx;
    d.classList.toggle('is-active', active);
    d.setAttribute('aria-selected', String(active));
  });
}

function stopSliderAutoplay() {
  clearInterval(sliderTimer);
  sliderTimer = null;
}

function startSliderAutoplay() {
  stopSliderAutoplay();
  if (
    sliderSlides.length <= 1
    || sliderHoverPaused
    || document.hidden
    || document.body.classList.contains('is-onboarding')
    || viewMenu?.hidden
    || !viewSearch?.hidden
    || reducedMotion()
  ) {
    return;
  }
  sliderTimer = setInterval(() => {
    setSliderIndex(sliderIdx + 1);
  }, 5500);
}

function initFeaturedSlider() {
  if (!featuredSliderEl || !sliderTrack) return;
  if (!sliderSlides.length) {
    featuredSliderEl.hidden = true;
    return;
  }

  featuredSliderEl.hidden = false;
  sliderTrack.innerHTML = sliderSlides.map(buildSliderCard).join('');

  if (sliderSlides.length > 1) {
    if (sliderDots) {
      sliderDots.hidden = false;
      sliderDots.innerHTML = sliderSlides.map((_, i) => `
        <button type="button" class="slider-dot${i === 0 ? ' is-active' : ''}" data-slider-dot="${i}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="Show offer ${i + 1}"></button>
      `).join('');
    }
    const controls = featuredSliderEl.querySelector('.slider-controls-group');
    if (controls) controls.hidden = false;
  } else {
    if (sliderDots) sliderDots.hidden = true;
    const controls = featuredSliderEl.querySelector('.slider-controls-group');
    if (controls) controls.hidden = true;
  }

  setSliderIndex(0);
}

sliderPrev?.addEventListener('click', () => {
  setSliderIndex(sliderIdx - 1);
  startSliderAutoplay();
});
sliderNext?.addEventListener('click', () => {
  setSliderIndex(sliderIdx + 1);
  startSliderAutoplay();
});
sliderDots?.addEventListener('click', (e) => {
  const dot = e.target.closest('[data-slider-dot]');
  if (!dot) return;
  setSliderIndex(Number(dot.dataset.sliderDot));
  startSliderAutoplay();
});

featuredSliderEl?.addEventListener('mouseenter', () => { sliderHoverPaused = true; stopSliderAutoplay(); });
featuredSliderEl?.addEventListener('mouseleave', () => { sliderHoverPaused = false; startSliderAutoplay(); });
featuredSliderEl?.addEventListener('focusin', () => { sliderHoverPaused = true; stopSliderAutoplay(); });
featuredSliderEl?.addEventListener('focusout', () => { sliderHoverPaused = false; startSliderAutoplay(); });

// Touch swipe support on slider viewport
let swipeStartX = 0;
sliderViewport?.addEventListener('touchstart', (e) => {
  swipeStartX = e.changedTouches[0]?.clientX || 0;
}, { passive: true });
sliderViewport?.addEventListener('touchend', (e) => {
  if (!swipeStartX || sliderSlides.length <= 1) return;
  const dx = (e.changedTouches[0]?.clientX || 0) - swipeStartX;
  swipeStartX = 0;
  if (Math.abs(dx) < 42) return;
  setSliderIndex(dx < 0 ? sliderIdx + 1 : sliderIdx - 1);
  startSliderAutoplay();
}, { passive: true });

initFeaturedSlider();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseOnboardingMedia();
    stopSliderAutoplay();
  } else {
    if (document.body.classList.contains('is-onboarding')) resumeOnboardingMedia();
    else startSliderAutoplay();
  }
});

// ---------- Cart State & Persistence ----------

const lineKey = (id, picks, customBox = null, note = '') => (
  customBox ? `box:${JSON.stringify(customBox)}` : `${id}:${JSON.stringify(picks)}:${note}`
);

let cart = storage.get(CART_KEY, [])
  .filter((l) => {
    if (l.custom_box) return Boolean(BOX_TIERS[Number(l.custom_box.size)]) && l.quantity > 0;
    return itemsById.has(l.id) && l.quantity > 0 && picksValid(itemsById.get(l.id), l.picks);
  })
  .map((l) => {
    const cleanNote = l.custom_box ? '' : String(l.note || '').trim();
    return { ...l, note: cleanNote, key: lineKey(l.id, l.picks, l.custom_box, cleanNote) };
  });

function saveCart() {
  storage.set(CART_KEY, cart.map(({ id, quantity, picks, custom_box, note }) => {
    if (custom_box) return { quantity, custom_box };
    return note ? { id, quantity, picks, note } : { id, quantity, picks };
  }));
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
  if (!from || reducedMotion()) return;
  const bar = document.getElementById('cart-bar');
  const barVisible = bar && bar.classList.contains('show') && getComputedStyle(bar).display !== 'none';
  const target = barVisible ? bar : headerCartBtn;
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!a.width || !b.width) return;

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
  ], { duration: 700, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' }).onfinish = () => {
    dot.remove();
    target.classList.remove('bump');
    void target.offsetWidth;
    target.classList.add('bump');
  };
  setTimeout(() => dot.remove(), 1400);
}

function addToCart(id, picks, quantity, from = null, customBox = null, note = '') {
  playPop();
  const cleanNote = customBox ? '' : String(note || '').trim();
  const key = lineKey(id, picks, customBox, cleanNote);
  const line = cart.find((l) => l.key === key);
  if (line) line.quantity = Math.min(99, line.quantity + quantity);
  else cart.push({ key, id, picks, quantity, custom_box: customBox, note: cleanNote });
  if (cartConfirmation) {
    cartConfirmation.hidden = true;
    cartConfirmation.innerHTML = '';
  }
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

function removeLine(key) {
  playClick();
  cart = cart.filter((l) => l.key !== key);
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

// ---------- Cart Page & Chrome Rendering ----------

let fulfillment = () => 'pickup';

function renderCartThumb(line) {
  if (line.custom_box) {
    return `
      <div class="cart-box-mini" aria-hidden="true">
        <span style="background:#4C2007"></span>
        <span style="background:#96bc61"></span>
        <span style="background:#d9b066"></span>
        <span style="background:#c67d2d"></span>
      </div>`;
  }
  const item = itemsById.get(line.id);
  if (!item) return '';
  if (item.image) return `<img src="${esc(mediaSrc(item.image))}" alt="${esc(item.name)}" loading="lazy">`;
  return illustrationFor(item);
}

let cartFormInteracted = false;

function syncCartProgressSteps(confirmationVisible) {
  const steps = document.querySelectorAll('#view-cart .cart-steps-trail li');
  if (!steps.length) return;
  const currentStep = confirmationVisible ? 3 : cartFormInteracted ? 2 : 1;
  steps.forEach((li, idx) => {
    const stepNum = idx + 1;
    li.classList.toggle('is-active', stepNum === currentStep);
    li.classList.toggle('is-done', stepNum < currentStep);
  });
}

function renderCart() {
  const count = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((sum, l) => sum + l.quantity * lineUnitPrice(l), 0);
  const fee = deliveryFee(settings, fulfillment());
  const confirmationVisible = Boolean(cartConfirmation && !cartConfirmation.hidden);
  if (count === 0 && !confirmationVisible) cartFormInteracted = false;

  // Sync header badge & onboarding utility cart pill
  if (headerCartCount) {
    headerCartCount.textContent = String(count);
    headerCartCount.hidden = count === 0;
  }
  if (onboardCartBtn && onboardCartCount) {
    onboardCartCount.textContent = String(count);
    onboardCartBtn.hidden = count === 0;
  }
  if (clearCartBtn) {
    clearCartBtn.hidden = count === 0 || confirmationVisible;
  }
  if (cartItemsCountLabel) {
    cartItemsCountLabel.textContent = count ? `(${count} item${count === 1 ? '' : 's'})` : '';
  }

  // Also refresh product page inline View Cart pill if open
  const prodViewCartBtn = document.getElementById('prod-view-cart-btn');
  if (prodViewCartBtn) {
    prodViewCartBtn.hidden = count === 0;
    if (count > 0) prodViewCartBtn.textContent = `View Cart (${count}) →`;
  }

  syncCartProgressSteps(confirmationVisible);

  if (cartEmpty) cartEmpty.hidden = count > 0 || confirmationVisible;
  if (cartContent) cartContent.hidden = count === 0 || confirmationVisible;

  if (cartLinesEl) {
    cartLinesEl.innerHTML = cart.map((l) => {
      const { name, extras } = lineDisplay(l);
      const unitCents = lineUnitPrice(l);
      return `
        <li class="cart-line-item">
          <a class="cart-line-thumb" href="${l.custom_box ? '#gift-box' : `#product/${l.id}`}" aria-label="View ${esc(name)}">
            ${renderCartThumb(l)}
          </a>
          <div class="cart-line-info">
            <div class="cart-line-head">
              <span class="name">${esc(name)}</span>
              <span class="line-total">${money(unitCents * l.quantity)}</span>
            </div>
            ${l.quantity > 1 ? `<div class="cart-line-unit">${money(unitCents)} each</div>` : ''}
            ${extras ? `<div class="choices">${esc(extras)}</div>` : ''}
            ${l.note ? `<div class="cart-line-note">Note: “${esc(l.note)}”</div>` : ''}
            <div class="cart-line-actions">
              ${stepper(l.key, l.quantity, name)}
              <div class="cart-line-btns">
                ${!l.custom_box ? `<a href="#product/${l.id}" class="cart-edit-link">Edit</a>` : ''}
                <button type="button" class="cart-remove-btn" data-remove-line="${esc(l.key)}" aria-label="Remove ${esc(name)}">Remove</button>
              </div>
            </div>
          </div>
        </li>`;
    }).join('');
  }

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
              <a href="#product/${u.id}" class="cart-upsell-left" data-open-product="${u.id}">
                <span class="cart-upsell-thumb">
                  ${u.image ? `<img src="${esc(mediaSrc(u.image))}" alt="${esc(u.name)}" loading="lazy">` : illustrationFor(u)}
                </span>
                <span class="cart-upsell-info">
                  <strong>${esc(u.name)}</strong>
                  <span>${money(u.price_cents)}</span>
                </span>
              </a>
              <button type="button" class="btn btn-outline btn-sm" data-add-quick="${u.id}">+ Add</button>
            </div>
          `).join('')}
        </div>`;
    } else {
      upsellEl.hidden = true;
      upsellEl.innerHTML = '';
    }
  }

  const sumRows = document.getElementById('sum-rows');
  if (sumRows) {
    sumRows.innerHTML = fee
      ? `<div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
         <div class="sum-row"><span>Delivery</span><span>${money(fee)}</span></div>`
      : '';
  }
  const cartTotalEl = document.getElementById('cart-total');
  if (cartTotalEl) cartTotalEl.textContent = money(subtotal + fee);

  const bar = document.getElementById('cart-bar');
  if (bar) {
    bar.classList.toggle('show', count > 0);
    const barCount = document.getElementById('cart-bar-count');
    const barTotal = document.getElementById('cart-bar-total');
    if (barCount) barCount.textContent = `View cart · ${count} item${count === 1 ? '' : 's'}`;
    if (barTotal) barTotal.textContent = money(subtotal + fee);
  }
}

clearCartBtn?.addEventListener('click', () => {
  playClick();
  cart = [];
  saveCart();
  renderCart();
});

// ---------- Stage & Screen Router Helpers ----------

let currentCategory = null;
let currentProduct = null;
let currentProductPicks = [];
let currentProductQty = 1;

function syncNavHighlight(activeKey) {
  const menuLink = document.querySelector('#site-nav [data-page="menu"]');
  const cartLink = document.querySelector('#site-nav [data-nav-cart]');
  if (menuLink) {
    if (activeKey === 'menu') menuLink.setAttribute('aria-current', 'page');
    else menuLink.removeAttribute('aria-current');
  }
  if (cartLink) {
    if (activeKey === 'cart') cartLink.setAttribute('aria-current', 'page');
    else cartLink.removeAttribute('aria-current');
  }
}

function enterStorefrontShell({ isCart = false, showVisit = false } = {}) {
  document.body.classList.remove('is-onboarding');
  document.body.classList.toggle('is-cart-page', isCart);
  if (viewOnboarding) viewOnboarding.hidden = true;
  if (storefrontShell) storefrontShell.hidden = false;
  if (visitSection) visitSection.hidden = !showVisit;
  pauseOnboardingMedia();
  syncNavHighlight(isCart ? 'cart' : 'menu');
}

function enterOnboardingScreen() {
  document.body.classList.add('is-onboarding');
  document.body.classList.remove('is-cart-page');
  if (viewOnboarding) viewOnboarding.hidden = false;
  if (storefrontShell) storefrontShell.hidden = true;
  stopSliderAutoplay();
  resumeOnboardingMedia();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function switchStageView(targetId, { scrollTop = true } = {}) {
  [viewMenu, viewCategory, viewProduct, viewCart].forEach((el) => {
    if (el) el.hidden = el.id !== targetId;
  });

  if (targetId === 'view-menu') {
    startSliderAutoplay();
  } else {
    stopSliderAutoplay();
  }

  if (scrollTop) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function updateBreadcrumbs(state) {
  if (!breadcrumb) return;

  if (state.view === 'menu' || state.view === 'cart' || state.view === 'onboarding') {
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
  }
}

// ---------- Screen 1: Inside Menu Home (Slider + Search + Categories) ----------

function getCategoryMap() {
  const raw = new Map();
  for (const item of items) {
    if (!raw.has(item.category)) raw.set(item.category, []);
    raw.get(item.category).push(item);
  }
  const sorted = new Map();
  for (const catName of CATEGORY_PRIORITY) {
    if (raw.has(catName)) sorted.set(catName, raw.get(catName));
  }
  const extras = [...raw.keys()].filter((k) => !sorted.has(k)).sort((a, b) => a.localeCompare(b));
  for (const catName of extras) {
    sorted.set(catName, raw.get(catName));
  }
  return sorted;
}

function getCategoryCover(catName, catItems) {
  const withImg = catItems.find((i) => i.image)?.image;
  return withImg || CATEGORY_COVER[catName] || '';
}

function showMenuHomeView({ scrollTarget = null, scrollTop = true } = {}) {
  enterStorefrontShell({ isCart: false, showVisit: true });
  setSearchModeUI(false);

  if (foldersGrid) {
    const categories = getCategoryMap();
    const cardsHtml = [...categories.entries()].map(([catName, catItems]) => {
      const meta = CATEGORY_META[catName] || {
        desc: 'Handcrafted atelier specialties and gourmet recipes.',
        icon: DEFAULT_CATEGORY_ICON,
      };
      const coverSrc = getCategoryCover(catName, catItems);
      const minPrice = Math.min(...catItems.map(fromPrice));
      return `
        <a class="folder-card" href="#category/${encodeURIComponent(catName)}" data-nav-cat="${esc(catName)}">
          <div class="folder-cover">
            ${coverSrc
              ? `<img src="${esc(mediaSrc(coverSrc))}" alt="${esc(catName)}" loading="lazy">`
              : `<div class="folder-cover-fallback">${meta.icon}</div>`}
            <div class="folder-cover-scrim" aria-hidden="true"></div>
            <div class="folder-cover-top">
              <span class="folder-icon">${meta.icon}</span>
              <div class="folder-meta-pills">
                <span class="folder-count-badge">${catItems.length} item${catItems.length === 1 ? '' : 's'}</span>
                <span class="folder-price-badge">from ${money(minPrice)}</span>
              </div>
            </div>
          </div>
          <div class="folder-card-body">
            <h3 class="folder-title">${esc(catName)}</h3>
            <p class="folder-desc">${esc(meta.desc)}</p>
            <div class="folder-action">
              <span>Explore Collection</span>
              <span class="folder-arrow arrow" aria-hidden="true">→</span>
            </div>
          </div>
        </a>`;
    }).join('');

    const boxCardHtml = `
      <a class="folder-card folder-card-bespoke" href="#gift-box" id="folder-box-builder">
        <div class="folder-cover">
          <img src="/img/onboarding-box.jpg" alt="SAVORY Luxury Gift Boxes" loading="lazy">
          <div class="folder-cover-scrim" aria-hidden="true"></div>
          <div class="folder-cover-top">
            <span class="folder-icon folder-icon-bespoke">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M12 8C10.5 5 8 5 8 6.5s2 1.5 4 1.5c2 0 4 0 4-1.5S13.5 5 12 8z"/></svg>
            </span>
            <div class="folder-meta-pills">
              <span class="folder-count-badge folder-badge-bespoke">✦ Bespoke Studio</span>
              <span class="folder-price-badge">from $18.00</span>
            </div>
          </div>
        </div>
        <div class="folder-card-body">
          <h3 class="folder-title">Luxury Gift Boxes</h3>
          <p class="folder-desc">Hand-pick 9, 16, or 25 artisan truffles in an embossed keepsake box with personalized satin ribbon.</p>
          <div class="folder-action">
            <span>Curate a Gift Box</span>
            <span class="folder-arrow arrow" aria-hidden="true">→</span>
          </div>
        </div>
      </a>`;

    foldersGrid.innerHTML = cardsHtml + boxCardHtml;
  }

  updateBreadcrumbs({ view: 'menu' });
  switchStageView('view-menu', { scrollTop: !scrollTarget && scrollTop });
  applyLanguage();

  if (scrollTarget) {
    requestAnimationFrame(() => {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ---------- Screen 2: Category Products List ----------

function renderRowCard(item) {
  const from = item.options.length && fromPrice(item) !== item.price_cents;
  const displayPrice = from ? fromPrice(item) : item.price_cents;
  const badges = inferMenuBadges(item);
  const optTag = item.options.length ? '✦ Customizable' : '✦ Ready to order';
  const showCompare = item.compare_price_cents > item.price_cents;
  const canQuickAdd = ordersOpen && !item.options.some((g) => g.required);

  return `
    <article class="menu-product-card" data-open-product="${item.id}" role="button" tabindex="0" aria-label="View ${esc(item.name)} details">
      <div class="prod-card-media">
        ${item.image
          ? `<img src="${esc(mediaSrc(item.image))}" alt="${esc(item.name)}" loading="lazy">`
          : `<div class="prod-card-svg-fallback">${illustrationFor(item)}</div>`}
        <div class="prod-card-media-scrim" aria-hidden="true"></div>
        ${badges.length ? `
          <div class="prod-card-badges">
            ${badges.slice(0, 2).map((b) => `<span class="menu-badge ${b.cls}">${esc(b.label)}</span>`).join('')}
          </div>` : ''}
      </div>
      <div class="prod-card-body">
        <div class="prod-card-kicker">${esc(item.category)}</div>
        <h3 class="prod-card-title">${esc(item.name)}</h3>
        <p class="prod-card-desc">${esc(item.description)}</p>
        <div class="prod-card-meta">
          <div class="prod-card-price-wrap">
            ${showCompare ? `<del class="row-compare-price">${money(item.compare_price_cents)}</del>` : ''}
            <span class="prod-card-price">${from ? '<small>from </small>' : ''}${money(displayPrice)}</span>
          </div>
          <span class="prod-card-opt-tag">${optTag}</span>
        </div>
        <div class="prod-card-actions">
          <a href="#product/${item.id}" class="btn btn-gold btn-sm prod-card-cta" data-open-product="${item.id}">
            ${item.options.length ? 'Customize &amp; Order →' : 'View Details →'}
          </a>
          ${canQuickAdd ? `<button type="button" class="btn btn-outline btn-sm prod-card-quick" data-add-quick="${item.id}" aria-label="Quick add ${esc(item.name)} to cart">+ Add</button>` : ''}
        </div>
      </div>
    </article>`;
}

function renderCategoryPills(activeCat) {
  if (!catPillsNav) return;
  const categories = [...getCategoryMap().keys()];
  catPillsNav.innerHTML = [
    ...categories.map((cat) => `
      <a href="#category/${encodeURIComponent(cat)}" class="cat-pill${cat === activeCat ? ' active' : ''}">${esc(cat)}</a>
    `),
    '<a href="#gift-box" class="cat-pill cat-pill-box">✦ Gift Boxes</a>',
  ].join('');

  const activePill = catPillsNav.querySelector('.cat-pill.active');
  if (activePill) {
    const left = activePill.offsetLeft - Math.max(0, (catPillsNav.clientWidth - activePill.offsetWidth) / 2);
    catPillsNav.scrollLeft = Math.max(0, left);
  }
}

function showCategoryView(catName) {
  const catItems = items.filter((i) => i.category === catName);
  if (!catItems.length) {
    window.location.hash = '#menu';
    return;
  }
  currentCategory = catName;
  enterStorefrontShell({ isCart: false, showVisit: false });

  const meta = CATEGORY_META[catName] || {
    desc: 'Handcrafted atelier specialties and gourmet recipes.',
    icon: DEFAULT_CATEGORY_ICON,
  };
  const coverSrc = getCategoryCover(catName, catItems);
  const minPrice = Math.min(...catItems.map(fromPrice));

  if (catBannerTitle) catBannerTitle.textContent = catName;
  if (catBannerDesc) catBannerDesc.textContent = meta.desc;
  if (catBannerIcon) {
    catBannerIcon.innerHTML = coverSrc
      ? `<img src="${esc(mediaSrc(coverSrc))}" alt="${esc(catName)}" loading="eager">`
      : meta.icon;
  }
  if (catProductsCount) {
    catProductsCount.textContent = `${catItems.length} creation${catItems.length === 1 ? '' : 's'} · from ${money(minPrice)}`;
  }

  renderCategoryPills(catName);
  if (categoryRowsList) categoryRowsList.innerHTML = catItems.map(renderRowCard).join('');

  updateBreadcrumbs({ view: 'category', category: catName });
  switchStageView('view-category');
  applyLanguage();
}

// ---------- Screen 3: Dedicated Product Page ----------

function renderRelatedProducts(item) {
  if (!productRelatedSection || !productRelatedGrid) return;
  const related = [];
  const pickedIds = new Set([item.id]);
  const usedCats = new Set();

  for (const candidate of items) {
    if (pickedIds.has(candidate.id) || candidate.category === item.category || usedCats.has(candidate.category)) continue;
    usedCats.add(candidate.category);
    pickedIds.add(candidate.id);
    related.push(candidate);
    if (related.length === 3) break;
  }
  for (const candidate of items) {
    if (related.length >= 3) break;
    if (pickedIds.has(candidate.id)) continue;
    pickedIds.add(candidate.id);
    related.push(candidate);
  }

  if (!related.length) {
    productRelatedSection.hidden = true;
    productRelatedGrid.innerHTML = '';
    return;
  }

  productRelatedSection.hidden = false;
  productRelatedGrid.innerHTML = related.map((r) => {
    const rFrom = r.options.length && fromPrice(r) !== r.price_cents;
    const rPrice = rFrom ? fromPrice(r) : r.price_cents;
    const rQuick = ordersOpen && !r.options.some((g) => g.required);
    return `
      <article class="related-pair-card" data-open-product="${r.id}" role="button" tabindex="0">
        <div class="related-pair-media">
          ${r.image
            ? `<img src="${esc(mediaSrc(r.image))}" alt="${esc(r.name)}" loading="lazy">`
            : `<div class="prod-card-svg-fallback">${illustrationFor(r)}</div>`}
        </div>
        <div class="related-pair-body">
          <span class="related-pair-cat">${esc(r.category)}</span>
          <h4>${esc(r.name)}</h4>
          <div class="related-pair-foot">
            <span class="related-pair-price">${rFrom ? '<small>from </small>' : ''}${money(rPrice)}</span>
            ${rQuick
              ? `<button type="button" class="btn btn-outline btn-xs" data-add-quick="${r.id}">+ Quick Add</button>`
              : `<span class="related-pair-link">Explore →</span>`}
          </div>
        </div>
      </article>`;
  }).join('');
}

function showProductView(productId) {
  const item = itemsById.get(Number(productId));
  if (!item) {
    window.location.hash = '#menu';
    return;
  }

  enterStorefrontShell({ isCart: false, showVisit: false });

  currentProduct = item;
  currentCategory = item.category;
  currentProductQty = 1;

  currentProductPicks = item.options.map((g) => {
    if (g.type === 'single' && g.required && g.choices.length > 0) return [0];
    return [];
  });

  if (prodBackCatName) prodBackCatName.textContent = item.category;
  if (prodHeaderBadge) {
    prodHeaderBadge.textContent = '✦ Handcrafted to Order';
  }

  const badges = inferMenuBadges(item);
  const showCompare = item.compare_price_cents > item.price_cents;
  const savingsCents = showCompare ? item.compare_price_cents - item.price_cents : 0;
  const cartCountNow = cart.reduce((n, l) => n + l.quantity, 0);

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
            <span class="option-group-req">${note}</span>
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
          <span class="option-group-req">${note}</span>
        </div>
        <div class="addon-options-list">
          ${g.choices.map((c, ci) => {
            const isChecked = currentProductPicks[gi].includes(ci);
            return `
              <label class="addon-option-row${isChecked ? ' is-checked' : ''}">
                <span>
                  <input type="checkbox" data-addon-group="${gi}" data-addon-choice="${ci}" ${isChecked ? 'checked' : ''}>
                  <span>${esc(c.name)}</span>
                </span>
                <span class="addon-option-price">${c.price_cents ? `+${money(c.price_cents)}` : 'Included'}</span>
              </label>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  productPageCard.innerHTML = `
    <div class="product-page-grid">
      <div class="product-page-visual-col">
        <div class="product-page-visual">
          ${item.offer_badge ? `<span class="product-visual-ribbon">✦ ${esc(item.offer_badge)}</span>` : ''}
          ${item.image ? `<img src="${esc(mediaSrc(item.image))}" alt="${esc(item.name)}">` : illustrationFor(item)}
        </div>
        <div class="product-craft-strip">
          <span>✦ Freshly Prepared</span>
          <span>✦ Belgian Couverture</span>
          <span>✦ Aramoun &amp; Aley</span>
        </div>
      </div>

      <div class="product-page-body">
        <div class="product-kicker">${esc(item.category)}</div>
        <h2 class="product-page-title">${esc(item.name)}</h2>

        <div class="product-page-price-row">
          <span class="product-live-price" id="prod-live-price">${money(unitPrice(item, currentProductPicks) * currentProductQty)}</span>
          ${showCompare ? `<del class="product-compare-price">${money(item.compare_price_cents)}</del>` : ''}
          ${savingsCents > 0 ? `<span class="menu-badge badge-offer">Save ${money(savingsCents)}</span>` : ''}
          ${badges.filter((b) => b.cls !== 'badge-offer' && b.label !== item.offer_badge).map((b) => `<span class="menu-badge ${b.cls}">${esc(b.label)}</span>`).join('')}
        </div>

        <p class="product-page-desc">${esc(item.description)}</p>

        <div class="product-tasting-box">
          <strong>✦ Tasting Note:</strong> ${esc(inferPairing(item))}
        </div>

        <div id="product-options-root">
          ${optionsHtml}
        </div>

        <div class="option-group-box option-group-note">
          <label for="prod-note-input" class="option-group-title" style="margin-bottom:6px;">
            <span>Special Requests &amp; Notes</span>
            <span class="option-group-req">Optional</span>
          </label>
          <input type="text" id="prod-note-input" maxlength="200" placeholder="Candle request, packaging notes, allergies…">
        </div>

        <div class="product-page-actions">
          <div class="qty product-qty">
            <button type="button" id="prod-qty-dec" aria-label="Decrease quantity">−</button>
            <span id="prod-qty-display" aria-live="polite">1</span>
            <button type="button" id="prod-qty-inc" aria-label="Increase quantity">+</button>
          </div>

          <button type="button" class="btn btn-gold product-add-btn" id="prod-add-btn" ${ordersOpen ? '' : 'disabled'}>
            ${ordersOpen ? `Add to Order · ${money(unitPrice(item, currentProductPicks) * currentProductQty)}` : 'Atelier Closed'}
          </button>

          <a href="#cart" class="btn btn-outline product-view-cart-btn" id="prod-view-cart-btn" ${cartCountNow > 0 ? '' : 'hidden'}>
            ${cartCountNow > 0 ? `View Cart (${cartCountNow}) →` : 'View Cart →'}
          </a>
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
      btnEl.textContent = `Add to Order · ${money(total)}`;
    }
  }

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

  productPageCard.querySelectorAll('[data-addon-group]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const gi = Number(chk.dataset.addonGroup);
      currentProductPicks[gi] = [...productPageCard.querySelectorAll(`[data-addon-group="${gi}"]:checked`)]
        .map((c) => Number(c.dataset.addonChoice));
      chk.closest('.addon-option-row')?.classList.toggle('is-checked', chk.checked);
      playClick();
      updateProductLiveDisplay();
    });
  });

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

  productPageCard.querySelector('#prod-add-btn')?.addEventListener('click', (e) => {
    if (!ordersOpen) return;
    if (!picksValid(currentProduct, currentProductPicks)) {
      const missing = currentProduct.options.find((g, gi) => g.required && !currentProductPicks[gi].length);
      alert(missing ? `Please select a ${missing.name.toLowerCase()}.` : 'Please check your option selections.');
      return;
    }

    const note = productPageCard.querySelector('#prod-note-input')?.value?.trim() || '';
    addToCart(currentProduct.id, currentProductPicks, currentProductQty, e.currentTarget, null, note);

    const viewCartBtn = productPageCard.querySelector('#prod-view-cart-btn');
    if (viewCartBtn) {
      const count = cart.reduce((n, l) => n + l.quantity, 0);
      viewCartBtn.textContent = `View Cart (${count}) →`;
      viewCartBtn.hidden = false;
    }

    const btn = e.currentTarget;
    btn.textContent = '✓ Added to Order!';
    setTimeout(() => {
      if (btn && ordersOpen) updateProductLiveDisplay();
    }, 1500);
  });

  renderRelatedProducts(item);
  updateBreadcrumbs({ view: 'product', category: item.category, product: item });
  switchStageView('view-product');
  applyLanguage();
}

// ---------- Screen 4: Dedicated Cart & Checkout Page ----------

function showCartView() {
  enterStorefrontShell({ isCart: true, showVisit: false });
  renderCart();
  updateBreadcrumbs({ view: 'cart' });
  switchStageView('view-cart');
  applyLanguage();
}

// ---------- Search & Quick Filters (Inline Inside Screen 1) ----------

let activeSearchQuery = '';
let activeQuickFilter = 'all';

function setSearchModeUI(searching) {
  if (viewSearch) viewSearch.hidden = !searching;
  if (featuredSliderEl) featuredSliderEl.hidden = searching || sliderSlides.length === 0;
  if (categoriesSection) categoriesSection.hidden = searching;
  if (boxBanner) boxBanner.hidden = searching;
  if (searching) stopSliderAutoplay();
  else if (!viewMenu?.hidden) startSliderAutoplay();
}

function matchesFilter(item) {
  const text = `${item.name} ${item.description} ${item.category} ${item.offer_badge || ''}`.toLowerCase();
  if (activeSearchQuery && !text.includes(activeSearchQuery)) return false;
  if (activeQuickFilter === 'popular') return Boolean(item.featured) || /lava|mirror|kunafa|gift box|fettuccine|flurry/i.test(text);
  if (activeQuickFilter === 'pistachio') return /pistachio|kunafa|hazelnut|praline|nut/i.test(text);
  if (activeQuickFilter === 'dark') return /dark|70%|ganache|mirror|lava|truffle|bark/i.test(text);
  if (activeQuickFilter === 'under10') return fromPrice(item) <= 1000;
  return true;
}

function renderSearchView() {
  enterStorefrontShell({ isCart: false, showVisit: false });
  switchStageView('view-menu', { scrollTop: false });
  setSearchModeUI(true);

  const filtered = items.filter(matchesFilter);
  if (searchTitle) {
    searchTitle.textContent = `Showing ${filtered.length} creation${filtered.length === 1 ? '' : 's'}`;
  }

  if (searchRowsList) {
    if (!filtered.length) {
      searchRowsList.innerHTML = `
        <div class="card empty-state" style="grid-column: 1 / -1; padding: 36px 20px; text-align: center;">
          <p style="margin-bottom: 14px;">No creations match your current search or filter.</p>
          <button type="button" class="btn btn-outline btn-sm" id="reset-empty-search">Show All Categories</button>
        </div>`;
      document.getElementById('reset-empty-search')?.addEventListener('click', resetSearchAndFilters);
    } else {
      searchRowsList.innerHTML = filtered.map(renderRowCard).join('');
    }
  }
  updateBreadcrumbs({ view: 'menu' });
  applyLanguage();
}

function resetSearchAndFilters({ navigate = true } = {}) {
  activeSearchQuery = '';
  activeQuickFilter = 'all';
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.hidden = true;
  filterPills?.querySelectorAll('[data-qfilter]').forEach((b) => b.classList.toggle('active', b.dataset.qfilter === 'all'));
  setSearchModeUI(false);
  if (navigate) {
    if (window.location.hash !== '#menu') window.location.hash = '#menu';
    else handleHashRouting();
  }
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

clearSearchBtn?.addEventListener('click', () => resetSearchAndFilters({ navigate: true }));

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

function clearSearchSilent() {
  activeSearchQuery = '';
  activeQuickFilter = 'all';
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.hidden = true;
  filterPills?.querySelectorAll('[data-qfilter]').forEach((b) => b.classList.toggle('active', b.dataset.qfilter === 'all'));
  setSearchModeUI(false);
}

function handleHashRouting() {
  const hash = window.location.hash.trim();

  if (!hash || hash === '#welcome') {
    clearSearchSilent();
    if (cartConfirmation && !cartConfirmation.hidden) cartConfirmation.hidden = true;
    enterOnboardingScreen();
    return;
  }

  if (hash === '#cart') {
    clearSearchSilent();
    showCartView();
    return;
  }

  if (hash.startsWith('#product/')) {
    const id = Number(hash.slice('#product/'.length));
    showProductView(id);
    return;
  }

  if (hash.startsWith('#category/')) {
    clearSearchSilent();
    const catName = decodeURIComponent(hash.slice('#category/'.length));
    showCategoryView(catName);
    return;
  }

  if (activeSearchQuery || activeQuickFilter !== 'all') {
    renderSearchView();
    return;
  }

  if (cartConfirmation && !cartConfirmation.hidden) {
    cartConfirmation.hidden = true;
    renderCart();
  }

  if (hash === '#gift-box') {
    showMenuHomeView();
    openBoxBuilderModal();
    return;
  }

  if (hash === '#visit' || hash === '#visit-section') {
    showMenuHomeView({ scrollTarget: visitSection });
    return;
  }

  if (hash === '#categories-section') {
    showMenuHomeView({ scrollTarget: categoriesSection });
    return;
  }

  if (hash === '#box-banner') {
    showMenuHomeView({ scrollTarget: boxBanner });
    return;
  }

  // Default inside view: Screen 1 (#menu / #folders / #omvi)
  showMenuHomeView();
}

window.addEventListener('hashchange', handleHashRouting);

// Back buttons navigation
catBackBtn?.addEventListener('click', () => { window.location.hash = '#menu'; });
prodBackBtn?.addEventListener('click', () => {
  if (currentCategory) {
    window.location.hash = `#category/${encodeURIComponent(currentCategory)}`;
  } else {
    window.location.hash = '#menu';
  }
});

// Delegated interactions across all screens
document.addEventListener('click', (e) => {
  const quickAdd = e.target.closest('[data-add-quick]');
  if (quickAdd && ordersOpen) {
    e.preventDefault();
    e.stopPropagation();
    const id = Number(quickAdd.dataset.addQuick);
    addToCart(id, [], 1, quickAdd);
    return;
  }

  const offerBoxBtn = e.target.closest('[data-open-offer-box]');
  if (offerBoxBtn) {
    e.preventDefault();
    const size = Number(offerBoxBtn.dataset.openOfferBox);
    openBoxBuilderModal([9, 16, 25].includes(size) ? size : null);
    return;
  }

  const rowBtn = e.target.closest('[data-open-product]');
  if (rowBtn) {
    e.preventDefault();
    const id = Number(rowBtn.dataset.openProduct);
    window.location.hash = `#product/${id}`;
    return;
  }

  const removeBtn = e.target.closest('[data-remove-line]');
  if (removeBtn) {
    removeLine(removeBtn.dataset.removeLine);
    return;
  }

  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  if (inc) changeLine(inc.dataset.inc, 1);
  if (dec) changeLine(dec.dataset.dec, -1);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.menu-product-card[data-open-product], .related-pair-card[data-open-product], .menu-row-card[data-open-product]');
  if (!card || e.target.closest('button, a, input, label')) return;
  e.preventDefault();
  const id = Number(card.dataset.openProduct);
  window.location.hash = `#product/${id}`;
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
  if (boxProgress) boxProgress.textContent = `${boxSlots.length} / ${activeBoxSize} pieces selected`;
  if (boxPriceLabel) boxPriceLabel.textContent = money(tier.price_cents);
}

function setBoxSize(size) {
  if (!BOX_TIERS[size]) return;
  activeBoxSize = size;
  boxDialog?.querySelectorAll('[data-box-size]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.boxSize) === activeBoxSize);
  });
  if (boxSlots.length > activeBoxSize) boxSlots = boxSlots.slice(0, activeBoxSize);
  renderBoxTray();
}

function openBoxBuilderModal(requestedSize = null) {
  if (!boxDialog) return;
  if (requestedSize && BOX_TIERS[requestedSize]) setBoxSize(requestedSize);
  if (boxError) boxError.hidden = true;
  if (boxSlots.length === 0) {
    boxSlots = Array.from({ length: activeBoxSize }, (_, i) => TRUFFLES[i % TRUFFLES.length]);
  }
  renderBoxTray();
  if (!boxDialog.open) boxDialog.showModal();
}

renderBoxFlavors();
renderBoxTray();

document.getElementById('open-box-builder')?.addEventListener('click', () => openBoxBuilderModal());

boxDialog?.querySelectorAll('[data-box-size]').forEach((btn) => {
  btn.addEventListener('click', () => setBoxSize(Number(btn.dataset.boxSize)));
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
boxDialog?.addEventListener('close', () => {
  if (window.location.hash === '#gift-box') {
    history.replaceState(null, '', '#menu');
  }
});

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
  addToCart(0, [], 1, document.getElementById('open-box-builder') || headerCartBtn, customBox);
});

// ---------- Checkout Form & Confirmation ----------

fulfillment = setupFulfillment(form, settings, renderCart);
const branchOf = await setupBranches(form);

const markFormStep = () => {
  if (!cartFormInteracted) {
    cartFormInteracted = true;
    syncCartProgressSteps(false);
  }
};
form?.addEventListener('focusin', markFormStep);
form?.addEventListener('change', markFormStep);

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
      : l.note
        ? { id: l.id, quantity: l.quantity, choices: l.picks, note: l.note }
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
  } finally {
    submitBtn.disabled = !ordersOpen;
    submitBtn.textContent = 'Place order';
  }
});

function showConfirmation(order, name) {
  confetti();
  playCelebration();
  if (cartConfirmation) {
    cartConfirmation.innerHTML = orderConfirmation(order, {
      name,
      title: 'your order is in!',
      shopName: settings.shop_name,
      links: `<a class="btn btn-gold" href="/track?site=menu&code=${encodeURIComponent(order.order_code || order.code)}">Track order live</a><a class="btn btn-outline" href="#menu">Order more from menu</a>`,
    });
    cartConfirmation.hidden = false;
  }
  renderCart();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
