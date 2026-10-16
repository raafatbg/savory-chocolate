import { api, esc, money, isoDate, friendlyTime, loadSettings } from '/js/common.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let settings = {};
let currentTab = 'orders';

// Any admin request that comes back 401 means the session ended: show the login form.
async function adminApi(path, options) {
  try {
    return await api(`/api/admin${path}`, options);
  } catch (err) {
    if (err.status === 401) showAuth(false);
    throw err;
  }
}

function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function formError(form, message) {
  const box = $('.form-error', form) || $('#auth-error');
  box.textContent = message || '';
  box.hidden = !message;
}

async function busy(button, work) {
  const label = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.innerHTML = label;
  }
}

// ---------------------------------------------------------------- auth

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
  $('#auth-title').textContent = setup ? 'Create your admin account' : 'Admin login';
  $('#auth-intro').textContent = setup
    ? 'Welcome! Choose a username and password. You\'ll use them to manage your menu, cake options and orders.'
    : '';
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
  const username = form.username.value.trim();
  const password = form.password.value;
  formError(form, '');

  if (setup && password !== form.confirm.value) {
    formError(form, 'The two passwords don\'t match.');
    return;
  }

  try {
    await busy($('#auth-submit'), () => api(`/api/admin/${setup ? 'setup' : 'login'}`, {
      method: 'POST',
      body: { username, password },
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

// ---------------------------------------------------------------- dashboard & tabs

async function showDashboard(admin) {
  $('#auth-view').hidden = true;
  $('#dash-view').hidden = false;
  $('#admin-name').textContent = admin.username;
  settings = await loadSettings();
  const fromHash = location.hash.slice(1);
  selectTab(['orders', 'menu', 'cakes', 'settings'].includes(fromHash) ? fromHash : 'orders');
}

function selectTab(name) {
  currentTab = name;
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  history.replaceState(null, '', `#${name}`);
  ({ orders: loadOrders, menu: loadItems, cakes: loadOptions, settings: fillSettings })[name]();
}

$$('[data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// ---------------------------------------------------------------- orders

const FILTERS = [
  ['active', 'Active'], ['new', 'New'], ['confirmed', 'Confirmed'], ['ready', 'Ready'],
  ['completed', 'Picked up'], ['cancelled', 'Cancelled'], ['all', 'All'],
];
const STATUS_LABELS = {
  new: 'New', confirmed: 'Confirmed', ready: 'Ready for pickup', completed: 'Picked up', cancelled: 'Cancelled',
};
const NEXT_STEP = {
  new: ['confirmed', 'Confirm order'],
  confirmed: ['ready', 'Mark ready'],
  ready: ['completed', 'Mark picked up'],
};
const DETAIL_LABELS = { size: 'Size', flavor: 'Flavor', filling: 'Filling', frosting: 'Frosting', message: 'Message' };

let orderFilter = 'active';

async function loadOrders() {
  let data;
  try {
    data = await adminApi(`/orders?status=${orderFilter}`);
  } catch (err) {
    if (err.status !== 401) $('#orders-list').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    return;
  }
  const { orders, counts } = data;
  const n = (s) => counts[s] || 0;
  const filterCounts = {
    ...counts,
    active: n('new') + n('confirmed') + n('ready'),
    all: Object.values(counts).reduce((a, b) => a + b, 0),
  };

  $('#order-filters').innerHTML = FILTERS.map(([key, label]) => `
    <button type="button" data-filter="${key}" aria-pressed="${key === orderFilter}">
      ${label}<span class="count">${filterCounts[key] || 0}</span>
    </button>`).join('');

  const badge = $('#new-badge');
  badge.hidden = !n('new');
  badge.textContent = n('new');
  document.title = `${n('new') ? `(${n('new')}) ` : ''}Admin · ${settings.shop_name || 'Savory Chocolate'}`;

  $('#orders-list').innerHTML = orders.length
    ? `<div class="orders">${orders.map(orderCard).join('')}</div>`
    : `<div class="card empty-state"><div class="icon" aria-hidden="true">📭</div><p>No ${orderFilter === 'all' ? '' : `${FILTERS.find(([k]) => k === orderFilter)[1].toLowerCase()} `}orders.</p></div>`;

  $('#orders-updated').textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · refreshes automatically`;
}

function orderCard(o) {
  const today = isoDate(0);
  const active = ['new', 'confirmed', 'ready'].includes(o.status);
  const [y, m, d] = o.pickup_date.split('-').map(Number);
  const pickupDay = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  let when = '';
  if (o.pickup_date === today) when = '<span class="pill today">Today</span>';
  else if (active && o.pickup_date < today) when = '<span class="pill overdue">Past pickup date</span>';

  const items = o.items.map((i) => {
    const details = Object.entries(i.details).filter(([, v]) => v);
    return `
      <li>
        <span><span class="q">${i.quantity}×</span>${esc(i.name)}</span>
        <span>${money(i.unit_price_cents * i.quantity)}</span>
      </li>
      ${details.length ? `<dl class="cake-details">${details.map(([k, v]) => `
        <dt>${esc(DETAIL_LABELS[k] || k)}</dt><dd>${k === 'message' ? `“${esc(v)}”` : esc(v)}</dd>`).join('')}</dl>` : ''}`;
  }).join('');

  const next = NEXT_STEP[o.status];
  const phoneHref = o.customer_phone.replace(/[^\d+]/g, '');

  return `
    <article class="card order-card st-${o.status}">
      <div class="order-top">
        <div class="ids">
          <span class="order-code-sm">${esc(o.code)}</span>
          ${o.type === 'cake' ? '<span class="pill cake">🎂 Custom cake</span>' : '<span class="pill">Menu order</span>'}
          <span class="pill st-${o.status}">${STATUS_LABELS[o.status]}</span>
        </div>
        <div class="pickup">${when} Pickup ${esc(pickupDay)} · ${esc(friendlyTime(o.pickup_time))}</div>
      </div>
      <div class="order-body">
        <div class="customer">
          <p class="cname">${esc(o.customer_name)}</p>
          <p><a href="tel:${esc(phoneHref)}">${esc(o.customer_phone)}</a></p>
          ${o.customer_email ? `<p><a href="mailto:${esc(o.customer_email)}">${esc(o.customer_email)}</a></p>` : ''}
          <p class="muted small">Placed ${esc(timeAgo(o.created_at))}</p>
        </div>
        <div>
          <ul class="order-items">${items}</ul>
          ${o.notes ? `<p class="order-notes"><strong>Notes:</strong> ${esc(o.notes)}</p>` : ''}
        </div>
      </div>
      <div class="order-foot">
        <span class="total">Total ${money(o.total_cents)} <span class="muted small">(pay at pickup)</span></span>
        <div class="controls">
          ${next ? `<button type="button" class="btn btn-primary btn-sm" data-order="${o.id}" data-set-status="${next[0]}">${next[1]}</button>` : ''}
          <label class="visually-hidden" for="status-${o.id}">Status</label>
          <select id="status-${o.id}" data-order="${o.id}" data-status-select>
            ${Object.entries(STATUS_LABELS).map(([k, label]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
    </article>`;
}

function timeAgo(sqliteUtc) {
  const then = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return then.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function setOrderStatus(id, status) {
  try {
    await adminApi(`/orders/${id}`, { method: 'PATCH', body: { status } });
    toast(`Order marked as ${STATUS_LABELS[status].toLowerCase()}.`);
  } catch (err) {
    toast(err.message, true);
  }
  loadOrders();
}

$('#order-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  orderFilter = button.dataset.filter;
  loadOrders();
});

$('#orders-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-set-status]');
  if (button) setOrderStatus(button.dataset.order, button.dataset.setStatus);
});

$('#orders-list').addEventListener('change', (event) => {
  const select = event.target.closest('[data-status-select]');
  if (select) setOrderStatus(select.dataset.order, select.value);
});

$('#orders-refresh').addEventListener('click', loadOrders);

// Check for new orders every 30 seconds, unless the admin is in the middle of something.
setInterval(() => {
  if ($('#dash-view').hidden || document.hidden) return;
  if (currentTab === 'orders' && $('#orders-list').contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  if (currentTab === 'orders' || !$('dialog[open]')) loadOrders();
}, 30000);

// ---------------------------------------------------------------- menu items

let menuItems = [];

async function loadItems() {
  try {
    menuItems = await adminApi('/menu-items');
  } catch (err) {
    if (err.status !== 401) $('#items-list').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    return;
  }
  renderItems();
}

function renderItems() {
  if (!menuItems.length) {
    $('#items-list').innerHTML = `
      <div class="card empty-state">
        <div class="icon" aria-hidden="true">🍰</div>
        <p>Your menu is empty. Add your first item and it will appear on the Menu page.</p>
        <button type="button" class="btn btn-primary btn-sm" data-add-item>+ Add item</button>
      </div>`;
    return;
  }

  const groups = new Map();
  for (const item of menuItems) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }

  $('#items-list').innerHTML = [...groups].map(([category, items]) => `
    <div class="card list-card">
      <div class="list-head"><h2>${esc(category)}</h2><span class="muted small">${items.length} item${items.length === 1 ? '' : 's'}</span></div>
      ${items.map((item) => `
        <div class="row ${item.available ? '' : 'hidden-item'}">
          <div class="thumb-sm">${item.image ? `<img src="/uploads/${esc(item.image)}" alt="">` : esc(item.name.charAt(0))}</div>
          <div class="row-main">
            <div class="name">${esc(item.name)} ${item.available ? '' : '<span class="pill">Hidden</span>'}</div>
            <div class="desc">${esc(item.description)}</div>
          </div>
          <div class="price">${money(item.price_cents)}</div>
          <div class="row-actions">
            <label class="switch" title="Show on the menu"><input type="checkbox" data-toggle-item="${item.id}" ${item.available ? 'checked' : ''}> Shown</label>
            <button type="button" class="btn btn-ghost btn-sm" data-edit-item="${item.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-item="${item.id}">Delete</button>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

function itemFormData(item, { available = Boolean(item.available) } = {}) {
  const fd = new FormData();
  fd.append('name', item.name);
  fd.append('description', item.description);
  fd.append('category', item.category);
  fd.append('price', (item.price_cents / 100).toFixed(2));
  fd.append('sort_order', item.sort_order);
  if (available) fd.append('available', 'on');
  return fd;
}

const itemDialog = $('#item-dialog');
const itemForm = $('#item-form');
let editingItem = null;

function openItemDialog(item = null) {
  editingItem = item;
  itemForm.reset();
  formError(itemForm, '');
  $('#item-dialog-title').textContent = item ? 'Edit menu item' : 'Add menu item';
  $('#category-list').innerHTML = [...new Set(menuItems.map((i) => i.category))]
    .map((c) => `<option value="${esc(c)}"></option>`).join('');

  $('#i-name').value = item?.name ?? '';
  itemForm.category.value = item?.category ?? '';
  itemForm.price.value = item ? (item.price_cents / 100).toFixed(2) : '';
  itemForm.description.value = item?.description ?? '';
  itemForm.sort_order.value = item?.sort_order ?? 0;
  itemForm.available.checked = item ? Boolean(item.available) : true;
  $('#i-remove-wrap').hidden = !item?.image;
  setPreview(item?.image ? `/uploads/${item.image}` : null);
  itemDialog.showModal();
}

function setPreview(src) {
  $('#i-preview').innerHTML = src ? `<img src="${esc(src)}" alt="">` : '';
}

$('#i-image').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) setPreview(URL.createObjectURL(file));
  else setPreview(editingItem?.image ? `/uploads/${editingItem.image}` : null);
});

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError(itemForm, '');
  const fd = new FormData(itemForm);
  // An empty file input still sends a blank part, which the server would reject as "not an image".
  if (!fd.get('image')?.size) fd.delete('image');

  try {
    await busy($('button[type="submit"]', itemForm), () => adminApi(
      editingItem ? `/menu-items/${editingItem.id}` : '/menu-items',
      { method: editingItem ? 'PUT' : 'POST', form: fd },
    ));
    itemDialog.close();
    toast(editingItem ? 'Item updated.' : 'Item added to the menu.');
    loadItems();
  } catch (err) {
    formError(itemForm, err.message);
  }
});

$('#add-item-btn').addEventListener('click', () => openItemDialog());

$('#items-list').addEventListener('click', async (event) => {
  if (event.target.closest('[data-add-item]')) return openItemDialog();

  const edit = event.target.closest('[data-edit-item]');
  if (edit) return openItemDialog(menuItems.find((i) => i.id === Number(edit.dataset.editItem)));

  const del = event.target.closest('[data-delete-item]');
  if (del) {
    const item = menuItems.find((i) => i.id === Number(del.dataset.deleteItem));
    if (!confirm(`Delete "${item.name}" from the menu? This can't be undone.\n\nTip: untick "Shown" instead to hide it temporarily.`)) return;
    try {
      await adminApi(`/menu-items/${item.id}`, { method: 'DELETE' });
      toast('Item deleted.');
      loadItems();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

$('#items-list').addEventListener('change', async (event) => {
  const toggle = event.target.closest('[data-toggle-item]');
  if (!toggle) return;
  const item = menuItems.find((i) => i.id === Number(toggle.dataset.toggleItem));
  try {
    await adminApi(`/menu-items/${item.id}`, { method: 'PUT', form: itemFormData(item, { available: toggle.checked }) });
    toast(toggle.checked ? `${item.name} is now on the menu.` : `${item.name} is hidden from the menu.`);
  } catch (err) {
    toast(err.message, true);
  }
  loadItems();
});

// ---------------------------------------------------------------- cake options

const OPTION_TYPES = [
  { type: 'size', title: 'Sizes', single: 'size' },
  { type: 'flavor', title: 'Cake flavors', single: 'flavor' },
  { type: 'filling', title: 'Fillings', single: 'filling' },
  { type: 'frosting', title: 'Frostings', single: 'frosting' },
];

let cakeOptions = [];

async function loadOptions() {
  try {
    cakeOptions = await adminApi('/cake-options');
  } catch (err) {
    if (err.status !== 401) $('#options-list').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    return;
  }
  renderOptions();
}

function optionPrice(o) {
  if (o.type === 'size') return money(o.price_cents);
  return o.price_cents ? `+ ${money(o.price_cents)}` : '<span class="muted">Included</span>';
}

function renderOptions() {
  $('#options-list').innerHTML = OPTION_TYPES.map(({ type, title, single }) => {
    const list = cakeOptions.filter((o) => o.type === type);
    const shown = list.filter((o) => o.available).length;
    return `
      <div class="card list-card">
        <div class="list-head">
          <h2>${title}</h2>
          <button type="button" class="btn btn-outline btn-sm" data-add-option="${type}">+ Add ${single}</button>
        </div>
        ${shown ? '' : `<p class="alert alert-error" style="margin: 0 18px 14px;">Customers can't order a cake until at least one ${single} is available.</p>`}
        ${list.map((o) => `
          <div class="row no-thumb ${o.available ? '' : 'hidden-item'}">
            <div class="row-main">
              <div class="name">${esc(o.name)} ${o.available ? '' : '<span class="pill">Hidden</span>'}</div>
              ${o.description ? `<div class="desc">${esc(o.description)}</div>` : ''}
            </div>
            <div class="price">${optionPrice(o)}</div>
            <div class="row-actions">
              <label class="switch" title="Available in the cake builder"><input type="checkbox" data-toggle-option="${o.id}" ${o.available ? 'checked' : ''}> Shown</label>
              <button type="button" class="btn btn-ghost btn-sm" data-edit-option="${o.id}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-option="${o.id}">Delete</button>
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');
}

const optionDialog = $('#option-dialog');
const optionForm = $('#option-form');
let editingOption = null;

function openOptionDialog(type, option = null) {
  editingOption = option;
  optionForm.reset();
  formError(optionForm, '');
  const { single } = OPTION_TYPES.find((t) => t.type === type);
  $('#option-dialog-title').textContent = option ? `Edit ${single}` : `Add ${single}`;
  $('#o-price-label').textContent = type === 'size' ? 'Price' : 'Extra charge';
  $('#o-price-hint').textContent = type === 'size' ? 'The starting price of the cake.' : 'Added to the cake price. Use 0 if included.';
  optionForm.type.value = type;
  $('#o-name').value = option?.name ?? '';
  optionForm.description.value = option?.description ?? '';
  optionForm.price.value = option ? (option.price_cents / 100).toFixed(2) : (type === 'size' ? '' : '0.00');
  optionForm.sort_order.value = option?.sort_order ?? cakeOptions.filter((o) => o.type === type).length;
  optionForm.available.checked = option ? Boolean(option.available) : true;
  optionDialog.showModal();
}

function optionBody(o, overrides = {}) {
  return {
    type: o.type,
    name: o.name,
    description: o.description,
    price: (o.price_cents / 100).toFixed(2),
    sort_order: o.sort_order,
    available: Boolean(o.available),
    ...overrides,
  };
}

optionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError(optionForm, '');
  const body = Object.fromEntries(new FormData(optionForm));
  body.available = optionForm.available.checked;

  try {
    await busy($('button[type="submit"]', optionForm), () => adminApi(
      editingOption ? `/cake-options/${editingOption.id}` : '/cake-options',
      { method: editingOption ? 'PUT' : 'POST', body },
    ));
    optionDialog.close();
    toast(editingOption ? 'Option updated.' : 'Option added.');
    loadOptions();
  } catch (err) {
    formError(optionForm, err.message);
  }
});

$('#options-list').addEventListener('click', async (event) => {
  const add = event.target.closest('[data-add-option]');
  if (add) return openOptionDialog(add.dataset.addOption);

  const edit = event.target.closest('[data-edit-option]');
  if (edit) {
    const option = cakeOptions.find((o) => o.id === Number(edit.dataset.editOption));
    return openOptionDialog(option.type, option);
  }

  const del = event.target.closest('[data-delete-option]');
  if (del) {
    const option = cakeOptions.find((o) => o.id === Number(del.dataset.deleteOption));
    if (!confirm(`Delete "${option.name}"? This can't be undone.`)) return;
    try {
      await adminApi(`/cake-options/${option.id}`, { method: 'DELETE' });
      toast('Option deleted.');
      loadOptions();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

$('#options-list').addEventListener('change', async (event) => {
  const toggle = event.target.closest('[data-toggle-option]');
  if (!toggle) return;
  const option = cakeOptions.find((o) => o.id === Number(toggle.dataset.toggleOption));
  try {
    await adminApi(`/cake-options/${option.id}`, { method: 'PUT', body: optionBody(option, { available: toggle.checked }) });
    toast(toggle.checked ? `${option.name} is available again.` : `${option.name} is hidden.`);
  } catch (err) {
    toast(err.message, true);
  }
  loadOptions();
});

// ---------------------------------------------------------------- settings

const settingsForm = $('#settings-form');
const passwordForm = $('#password-form');

function fillSettings() {
  for (const el of settingsForm.elements) {
    if (!el.name || !(el.name in settings)) continue;
    if (el.type === 'checkbox') el.checked = settings[el.name] === '1';
    else el.value = settings[el.name];
  }
}

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError(settingsForm, '');
  const body = Object.fromEntries(new FormData(settingsForm));
  body.orders_open = settingsForm.orders_open.checked;

  try {
    await busy($('button[type="submit"]', settingsForm), () => adminApi('/settings', { method: 'PUT', body }));
    settings = await loadSettings();
    fillSettings();
    toast('Settings saved.');
  } catch (err) {
    formError(settingsForm, err.message);
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError(passwordForm, '');
  if (passwordForm.new_password.value !== passwordForm.confirm.value) {
    formError(passwordForm, 'The new passwords don\'t match.');
    return;
  }
  try {
    await busy($('button[type="submit"]', passwordForm), () => adminApi('/password', {
      method: 'POST',
      body: {
        current_password: passwordForm.current_password.value,
        new_password: passwordForm.new_password.value,
      },
    }));
    passwordForm.reset();
    toast('Password updated.');
  } catch (err) {
    formError(passwordForm, err.message);
  }
});

init();
