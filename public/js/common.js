// Helpers shared by every public page. Importing this module also wires up the
// header (scroll state + mobile menu) and the scroll-reveal animations.

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
    throw new Error('Could not reach the server. Check your connection and try again.');
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

// wa.me chat link for the shop's WhatsApp number, with an optional pre-filled message.
export function whatsappLink(settings, message = '') {
  const digits = (settings.whatsapp || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function deliveryFee(settings, fulfillment) {
  return fulfillment === 'delivery' ? Number(settings.delivery_fee) || 0 : 0;
}

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
  root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => {
    if (revealer) revealer.observe(el);
    else el.classList.add('is-visible');
  });
}

reveal();
