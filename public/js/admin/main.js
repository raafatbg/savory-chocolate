import { api } from '/js/common.js';
import { $, $$, esc, formError, busy, adminApi, loadSettings, setUnauthorizedHandler } from './core.js';
import * as orders from './orders.js';
import * as messages from './messages.js';
import * as menu from './menu-items.js';
import * as offers from './offers.js';
import * as cakes from './cake-options.js';
import * as gallery from './gallery.js';
import * as reviews from './reviews.js';
import * as faq from './faq.js';
import * as settingsPanel from './settings.js';

const PANELS = { orders, messages, menu, offers, cakes, gallery, reviews, faq, settings: settingsPanel };
export const state = { tab: 'orders', settings: {} };

setUnauthorizedHandler(() => showAuth(false));

// ---------- auth ----------

async function init() {
  let status;
  try {
    status = await api('/api/admin/status');
  } catch (err) {
    document.body.innerHTML = `<p class="alert alert-error" style="margin: 24px;">${esc(err.message)}</p>`;
    return;
  }
  if (status.admin) showDashboard(status.admin);
  else showAuth(status.setupNeeded);
}

function showAuth(setup) {
  $('#dash-view').hidden = true;
  $('#auth-view').hidden = false;
  $('#auth-title').textContent = setup ? 'Create your admin account' : 'Kitchen & Patisserie Desk';
  $('#auth-intro').textContent = setup
    ? 'Welcome! Choose a username and password. You\'ll use them to manage your orders, menu, cake builder and pages.'
    : 'Sign in to manage custom cake orders, menu specials, and branch settings.';
  $('#auth-confirm-field').hidden = !setup;
  $('#auth-confirm').required = setup;
  $('#auth-password').autocomplete = setup ? 'new-password' : 'current-password';
  $('#auth-password').minLength = setup ? 8 : 0;
  $('#auth-submit').textContent = setup ? 'Create account' : 'Log in';
  $('#auth-form').dataset.mode = setup ? 'setup' : 'login';
  formError($('#auth-form'), '');
  $('#auth-username').focus();
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const setup = form.dataset.mode === 'setup';
  formError(form, '');
  if (setup && form.password.value !== form.confirm.value) {
    formError(form, 'The two passwords don\'t match.');
    return;
  }
  try {
    await busy($('#auth-submit'), () => api(`/api/admin/${setup ? 'setup' : 'login'}`, {
      method: 'POST',
      body: { username: form.username.value.trim(), password: form.password.value },
    }));
    form.reset();
    init();
  } catch (err) {
    formError(form, err.message);
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  showAuth(false);
});

// ---------- dashboard ----------

async function showDashboard(admin) {
  $('#auth-view').hidden = true;
  $('#dash-view').hidden = false;
  $('#admin-name').textContent = admin.username;
  state.settings = await loadSettings();
  const fromHash = location.hash.slice(1);
  selectTab(fromHash in PANELS ? fromHash : 'orders');
  refreshCounts();
}

export function selectTab(name) {
  state.tab = name;
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  history.replaceState(null, '', `#${name}`);
  PANELS[name].load(state);
}

$$('[data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

export async function refreshCounts() {
  try {
    const { newOrders, unreadMessages } = await adminApi('/counts');
    const set = (id, n) => { const el = $(id); el.hidden = !n; el.textContent = n; };
    set('#badge-orders', newOrders);
    set('#badge-messages', unreadMessages);
    document.title = `${newOrders ? `(${newOrders}) ` : ''}Admin · ${state.settings.shop_name || 'SAVORY'}`;
  } catch { /* the next poll will try again */ }
}

// Check for new orders and messages every 30 seconds while the dashboard is open.
setInterval(() => {
  if ($('#dash-view').hidden || document.hidden) return;
  refreshCounts();
  if (state.tab === 'orders' && !$('dialog[open]') && document.activeElement?.tagName !== 'SELECT') orders.load(state);
}, 30000);

document.addEventListener('admin:changed', refreshCounts);

init();
