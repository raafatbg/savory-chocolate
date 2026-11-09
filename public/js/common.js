// Helpers shared by every public page. Importing this module also wires up the
// header (scroll state + mobile menu + bilingual AR/EN switcher) and scroll-reveal animations.

import { serverlessApi } from '/js/serverless-api.js';

export async function api(path, { method = 'GET', body, form } = {}) {
  const options = { method, headers: {} };
  if (form) {
    options.body = form;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    return serverlessApi(path, { method, body, form });
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return serverlessApi(path, { method, body, form });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

let currency = 'USD';
export function money(cents) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* private mode or storage blocked: it just won't persist */ }
  },
};

// YYYY-MM-DD in the visitor's local time, `daysAhead` from today.
export function isoDate(daysAhead = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function friendlyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function friendlyTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export async function loadSettings() {
  try {
    const settings = await api('/api/settings');
    currency = settings.currency || 'USD';
    return settings;
  } catch {
    return {};
  }
}

// Wires a Pickup / Delivery toggle inside `root`: shows the address fields and swaps labels.
// Returns a function that reports the current choice.
export function setupFulfillment(root, settings, onChange = () => {}) {
  const toggle = root.querySelector('[data-fulfillment]');
  const address = root.querySelector('[data-delivery-fields]');
  const addressInput = address?.querySelector('textarea');
  if (settings.delivery_enabled !== '1') {
    toggle.hidden = true;
    address.hidden = true;
    return () => 'pickup';
  }
  root.querySelector('[data-delivery-area]').textContent = [
    settings.delivery_area,
    Number(settings.delivery_fee) ? `Delivery fee: ${money(Number(settings.delivery_fee))}.` : 'Free delivery.',
    Number(settings.delivery_min) ? `Minimum order ${money(Number(settings.delivery_min))}.` : '',
  ].filter(Boolean).join(' ');

  const current = () => toggle.querySelector('input:checked')?.value || 'pickup';
  const apply = () => {
    const delivery = current() === 'delivery';
    address.hidden = !delivery;
    addressInput.required = delivery;
    root.querySelectorAll('[data-when-label]').forEach((el) => {
      el.textContent = `${delivery ? 'Delivery' : 'Pickup'} ${el.dataset.whenLabel}`;
    });
    onChange(current());
  };
  toggle.addEventListener('change', apply);
  apply();
  return current;
}

// Fills the branch picker inside `root` (from the fulfillment partial). With one branch it's chosen
// automatically and the picker stays hidden. Returns a function giving the chosen branch (or null).
export async function setupBranches(root, onChange = () => {}) {
  const field = root.querySelector('[data-branch-field]');
  const choices = root.querySelector('[data-branch-choices]');
  let branches = [];
  try {
    branches = await api('/api/branches');
  } catch { /* no picker: the order goes to the shop's main number */ }
  const byId = new Map(branches.map((b) => [String(b.id), b]));
  if (branches.length > 1) {
    choices.innerHTML = branches.map((b) => `
      <label class="choice">
        <input type="radio" name="branch" value="${b.id}" required>
        <span class="name">${esc(b.name)}</span>
        ${b.address ? `<span class="meta">${esc(b.address)}</span>` : ''}
      </label>`).join('');
    field.hidden = false;
    choices.addEventListener('change', () => onChange());
  }
  return () => (branches.length === 1 ? branches[0] : byId.get(root.querySelector('input[name="branch"]:checked')?.value) || null);
}

// wa.me chat link for the shop's WhatsApp number, with an optional pre-filled message.
export function whatsappLink(settings, message = '') {
  const digits = (settings.whatsapp || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function deliveryFee(settings, fulfillment) {
  return fulfillment === 'delivery' ? Number(settings.delivery_fee) || 0 : 0;
}

// ---------- Bilingual Arabic / English (AR / EN) + RTL ----------

const I18N = {
  en: {
    nav_home: 'Cake Studio',
    nav_cakes: '3D Cake Builder',
    nav_menu: 'Menu',
    nav_boxes: 'Gift Boxes',
    nav_specialties: 'Specialties',
    nav_gallery: 'Gallery',
    nav_track: 'Track Order',
    nav_about: 'About',
    nav_faq: 'FAQ',
    nav_contact: 'Contact',
    cta_design: 'Design a cake',
    cta_order: 'Your order',
    foot_order: 'Order',
    foot_bakery: 'Bakery',
    foot_visit: 'Visit',
  },
  ar: {
    nav_home: 'استوديو الكيك',
    nav_cakes: 'صمّم قالبك 3D',
    nav_menu: 'القائمة',
    nav_boxes: 'علب الهدايا',
    nav_specialties: 'أصنافنا',
    nav_gallery: 'المعرض',
    nav_track: 'تتبّع طلبك',
    nav_about: 'قصتنا',
    nav_faq: 'الأسئلة الشائعة',
    nav_contact: 'تواصل معنا',
    cta_design: 'صمّم قالبك',
    cta_order: 'سلّة الطلب',
    foot_order: 'الطلب',
    foot_bakery: 'المتجر',
    foot_visit: 'فروعنا',
  },
};

const PHRASE_AR = new Map([
  ['Made from scratch', 'محضّر يدوياً بعناية'],
  ['Baked to order', 'يُخبز طازجاً عند الطلب'],
  ['Pickup or delivery', 'استلام من الفرع أو توصيل'],
  ['Order from the menu', 'اطلب من القائمة'],
  ['Two ways to order', 'طريقتان للطلب'],
  ['Custom cakes', 'قوالب الكيك المخصّصة'],
  ["Today's menu", 'قائمة اليوم'],
  ['What we make', 'ماذا نُحضّر'],
  ['Signature designs', 'تصاميمنا المميزة'],
  ['Made your way', 'على ذوقك'],
  ['Design every detail', 'صمّم كل تفصيل'],
  ['How it works', 'كيف تطلب'],
  ['Ordering is a piece of cake', 'الطلب ولا أسهل'],
  ['Kind words', 'آراء زبائننا'],
  ['Loved by our customers', 'ثقة ومحبة زبائننا'],
  ['From our kitchen', 'من مطبخنا'],
  ['Recent creations', 'أحدث إبداعاتنا'],
  ['Follow us on Instagram', 'تابعنا على إنستغرام'],
  ['Our story', 'قصتنا'],
  ['Visit us', 'تفضّل بزيارتنا'],
  ['Opening hours', 'ساعات العمل'],
  ['Cut a slice', 'اقطع شريحة'],
  ['Whole cake', 'القالب كاملاً'],
  ['Make a wish', 'تمنَّ أمنية'],
  ['Lights on', 'إضاءة كاملة'],
  ['Surprise me', 'فاجئني بتصميم'],
  ['Share 3D link', 'مشاركة الرابط'],
  ['Save card', 'حفظ الصورة'],
  ['Place cake order', 'تأكيد طلب الكيك'],
  ['Place order', 'تأكيد الطلب'],
  ['Your order', 'طلبك'],
  ['Track order', 'تتبّع الطلب'],
  ['Curate a gift box →', 'صمّم علبة هدايا ←'],
  ['Curate a gift box', 'صمّم علبة هدايا'],
  ['All Creations', 'كافة الإبداعات'],
  ["★ Chef's Picks", '★ مختارات الشيف'],
  ['Pistachio & Kunafa', 'فستق وكنافة'],
  ['Belgian Dark', 'شوكولاتة داكنة بلجيكية'],
  ['Under $10', 'أقل من 10$'],
  ['Quick-start from a chef preset:', 'ابدأ سريعاً من تصاميم الشيف:'],
  ['Recent orders on this device:', 'طلباتك الأخيرة على هذا الجهاز:'],
  ['Tasting Note', 'ملاحظة التذوّق'],
  ['Richness', 'كثافة النكهة'],
  ['Sweetness', 'درجة الحلاوة'],
  ['✦ Complete your treat', '✦ أكمل تحليتك'],
  ['Add gift box to order', 'إضافة علبة الهدايا للطلب'],
  ['OPEN DAILY', 'يومياً نفتح أبوابنا'],
  ['Wedding & 3-Tier', 'أعراس وتصاميم متعددة الطبقات'],
  ['Chocolate & Pistachio', 'شوكولاتة وفستق'],
  ['Heart & Celebration', 'قلوب ومناسبات خاصة'],
]);

const origTextMap = new WeakMap();

function applyLanguage(lang) {
  const isAr = lang === 'ar';
  document.documentElement.lang = isAr ? 'ar' : 'en';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = isAr ? 'EN' : 'عربي';

  const dict = I18N[isAr ? 'ar' : 'en'];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    if (dict[k]) el.textContent = dict[k];
  });

  // Translate matching standalone phrases cleanly and reversibly
  document.querySelectorAll('.eyebrow, .trust span, .step h3, .section-head h2, .card h2, .card h3, .btn, dt, .tool-btn span, .menu-filter-pill, .recent-orders-label, .portion-badge, .cart-upsell-head, .occasion-label').forEach((el) => {
    if (el.hasAttribute('data-i18n') || el.children.length > 0) return;
    if (!origTextMap.has(el)) origTextMap.set(el, el.textContent.trim());
    const orig = origTextMap.get(el);
    if (isAr && PHRASE_AR.has(orig)) {
      el.textContent = PHRASE_AR.get(orig);
    } else if (!isAr && orig) {
      el.textContent = orig;
    }
  });
}

let activeLang = storage.get('sc_lang', 'en');
applyLanguage(activeLang);

document.getElementById('lang-toggle')?.addEventListener('click', () => {
  activeLang = activeLang === 'ar' ? 'en' : 'ar';
  storage.set('sc_lang', activeLang);
  applyLanguage(activeLang);
});

// ---------- Page chrome ----------

const header = document.getElementById('site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

const toggle = document.getElementById('nav-toggle');
if (toggle) {
  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
  document.getElementById('site-nav')?.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

// Cards with .spotlight glow where the cursor is.
let spotFrame = 0;
document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || spotFrame) return;
  spotFrame = requestAnimationFrame(() => {
    spotFrame = 0;
    const card = e.target.closest?.('.spotlight');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
}, { passive: true });

// Splits a heading into words that rise in one after another. The last `accent` words turn gold.
export function splitHeadline(el, { accent = 1 } = {}) {
  if (!el) return;
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.classList.add('split');
  el.innerHTML = words.map((word, i) => {
    const gold = i >= words.length - accent ? ' class="gold-text accent"' : '';
    return `<span class="w" aria-hidden="true"><span${gold} style="--i:${i}">${esc(word)}</span></span>`;
  }).join(' ');
}

// Fades sections in as they scroll into view. Call again after adding new [data-reveal] elements.
const revealer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  : null;

export function reveal(root = document) {
  const items = root.querySelectorAll('[data-reveal]:not(.is-visible)');
  items.forEach((el, idx) => {
    if (!el.style.getPropertyValue('--delay') && idx > 0 && el.parentElement?.children.length > 1) {
      const siblingIdx = [...el.parentElement.children].indexOf(el);
      if (siblingIdx > 0 && siblingIdx < 8) {
        el.style.setProperty('--delay', `${(siblingIdx * 0.055).toFixed(3)}s`);
      }
    }
    if (revealer) revealer.observe(el);
    else el.classList.add('is-visible');
  });
}

reveal();

// Floating WhatsApp button with a branch menu (when the shop has more than one branch).
const waMenu = document.querySelector('[data-wa-menu]');
if (waMenu) {
  const button = waMenu.querySelector('.wa-float');
  const menu = waMenu.querySelector('.wa-menu');
  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', (e) => { if (!waMenu.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

const WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.04c0-5.22 4.25-9.46 9.48-9.46a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.69c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.33 11.33 0 0 0 12.04.62C5.76.62.65 5.73.65 12.01c0 2 .52 3.96 1.52 5.69L.55 23.6l6.03-1.58a11.36 11.36 0 0 0 5.45 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z"/></svg>';

const RECENT_ORDERS_KEY = 'sc_recent_orders_v1';

export function getRecentOrders() {
  return storage.get(RECENT_ORDERS_KEY, []);
}

export function rememberOrderCode(code, label = '') {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return;
  const list = getRecentOrders().filter((o) => o.code !== clean);
  list.unshift({ code: clean, label: label || 'SAVORY Order', ts: Date.now() });
  storage.set(RECENT_ORDERS_KEY, list.slice(0, 5));
  syncHeaderOrderPill();
}

function syncHeaderOrderPill() {
  const pill = document.getElementById('header-order-pill');
  if (!pill) return;
  const recent = getRecentOrders()[0];
  if (!recent?.code) {
    pill.hidden = true;
    return;
  }
  const baseHref = pill.getAttribute('href')?.includes('site=menu')
    ? `/track?site=menu&code=${encodeURIComponent(recent.code)}`
    : `/track?code=${encodeURIComponent(recent.code)}`;
  pill.href = baseHref;
  pill.innerHTML = `<span class="choco-live-dot" aria-hidden="true"></span><span>${esc(recent.code)}</span>`;
  pill.hidden = false;
}

syncHeaderOrderPill();

// The screen after an order is placed. Its main action sends the order to the branch on WhatsApp
// (the message is written by the server, with every detail of the order).
export function orderConfirmation(order, { name, title, shopName, links = '' }) {
  rememberOrderCode(order.code || order.order_code, title);
  const firstName = name.trim().split(/\s+/)[0];
  const delivery = order.fulfillment === 'delivery';
  const to = [shopName, order.branch].filter(Boolean).join(' ');
  return `
    <div class="card confirm">
      <span class="script" style="font-size: 2.4rem;">Thank you</span>
      <h1 style="font-size: 2.4rem;">${esc(firstName)}, ${esc(title)}</h1>
      ${order.whatsapp_url ? `
        <div class="wa-step">
          <span class="wa-step-label">Last step</span>
          <p>Send your order to <strong>${esc(to || 'us')}</strong> on WhatsApp so we can confirm it. The message is already written for you.</p>
          <a class="btn btn-lg btn-block wa-send" href="${esc(order.whatsapp_url)}" target="_blank" rel="noopener">${WA_SVG} Send order on WhatsApp</a>
        </div>` : ''}
      <p class="muted">Your order number is</p>
      <div class="order-code">${esc(order.code)}</div>
      <p>${order.branch ? `<strong>Branch:</strong> ${esc(order.branch)}<br>` : ''}
        <strong>${delivery ? 'Delivery' : 'Pickup'}:</strong> ${esc(friendlyDate(order.pickup_date))} at ${esc(friendlyTime(order.pickup_time))}
        ${delivery ? `<br><span class="muted">${esc(order.delivery_address)}</span>` : ''}<br>
        <strong>Total due on ${delivery ? 'delivery' : 'pickup'}:</strong> ${money(order.total_cents)}</p>
      <div class="hero-actions" style="justify-content: center; margin-top: 24px;">${links}</div>
    </div>`;
}

// Opens the WhatsApp message straight away. Browsers may block this, which is why the
// confirmation also has a big "Send order on WhatsApp" button.
export function openWhatsApp(url) {
  if (!url) return;
  const tab = window.open(url, '_blank');
  if (tab) {
    try { tab.opener = null; } catch { /* cross-origin already */ }
  }
}
