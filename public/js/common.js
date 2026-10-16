// Helpers shared by every public page.

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
    } catch { /* private mode or storage blocked: the cart just won't persist */ }
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

// Loads shop settings, fills any [data-setting] element and renders the footer.
export async function loadSettings() {
  let settings = {};
  try {
    settings = await api('/api/settings');
  } catch {
    return settings;
  }
  currency = settings.currency || 'USD';

  document.querySelectorAll('[data-setting]').forEach((el) => {
    const value = settings[el.dataset.setting];
    if (value) el.textContent = value;
  });

  renderFooter(settings);
  return settings;
}

function renderFooter(s) {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  const phone = s.phone ? `<p><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a></p>` : '';
  const email = s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : '';
  const address = s.address ? `<p class="pre-line">${esc(s.address)}</p>` : '';
  const contact = phone + email + address;

  footer.innerHTML = `
    <div class="container">
      <div class="cols">
        <div>
          <h3>${esc(s.shop_name)}</h3>
          <p>${esc(s.tagline)}</p>
        </div>
        <div>
          <h3>Hours</h3>
          <p class="pre-line">${esc(s.hours)}</p>
        </div>
        <div>
          <h3>${contact ? 'Find us' : 'Order'}</h3>
          ${contact || '<p><a href="/cakes">Custom cakes</a></p><p><a href="/menu">Order from the menu</a></p>'}
        </div>
      </div>
      <p class="fine">&copy; ${new Date().getFullYear()} ${esc(s.shop_name)}. Orders are paid at pickup.</p>
    </div>`;
}
