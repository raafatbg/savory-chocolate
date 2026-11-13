// Browser-side API fallback for static Firebase Hosting deployments (Spark plan).
// When the Express backend is not reachable at /api/*, this module serves and persists
// the full SAVORY database (seeded from /seed.json + localStorage) so all 3 sites
// (Cake Studio, Menu, and Admin) work out of the box on *.web.app.

const DB_KEY = 'savory_static_db_v3';
const SESSION_KEY = 'savory_admin_session_v1';

const BOX_TIERS = {
  9: { name: 'SAVORY 9-Piece Assorted Gift Box', price_cents: 1800 },
  16: { name: 'SAVORY 16-Piece Luxury Gift Box', price_cents: 3000 },
  25: { name: 'SAVORY 25-Piece Grand Selection Box', price_cents: 4500 },
};

let seedPromise = null;

async function getDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  if (!seedPromise) {
    seedPromise = fetch('/seed.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  const seed = (await seedPromise) || {
    settings: { shop_name: 'SAVORY', currency: 'USD', orders_open: '1', delivery_enabled: '1', delivery_fee: '500', delivery_min: '0', cake_lead_days: '2', whatsapp: '+961 79 167 464', phone: '05 411 405' },
    branches: [],
    menu_items: [],
    offers: [],
    onboarding_slides: [],
    cake_groups: [],
    cake_options: [],
    gallery_images: [],
    reviews: [],
    faqs: [],
    orders: [],
    messages: [],
    admins: [],
  };
  saveDb(seed);
  return seed;
}

function saveDb(state) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function parseBody(body, form) {
  if (form instanceof FormData) {
    const obj = {};
    for (const [k, v] of form.entries()) {
      if (v instanceof File) continue;
      obj[k] = v;
    }
    return obj;
  }
  return body || {};
}

function makeCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'SAV-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function buildWhatsAppUrl(state, order, itemsSummary) {
  const branchObj = (state.branches || []).find((b) => b.name === order.branch);
  const rawWa = branchObj?.whatsapp || state.settings?.whatsapp || '+96179167464';
  const digits = String(rawWa).replace(/\D/g, '');
  const lines = [
    `New ${order.type === 'cake' ? 'Custom Cake' : 'Menu'} Order *${order.code}*`,
    `Customer: ${order.customer_name} (${order.customer_phone})`,
    `${order.fulfillment === 'delivery' ? `Delivery: ${order.delivery_address}` : `Pickup${order.branch ? ` (${order.branch})` : ''}`} on ${order.pickup_date} at ${order.pickup_time}`,
    '',
    ...itemsSummary,
    '',
    `Total: $${(order.total_cents / 100).toFixed(2)}`,
  ];
  if (order.notes) lines.push(`Notes: ${order.notes}`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export async function serverlessApi(rawPath, { method = 'GET', body, form } = {}) {
  const state = await getDb();
  const url = new URL(rawPath, location.origin);
  const path = url.pathname;
  const data = parseBody(body, form);

  // ---------- Public Endpoints ----------
  if (method === 'GET' && path === '/api/settings') return state.settings || {};
  if (method === 'GET' && path === '/api/branches') return (state.branches || []).filter((b) => b.available !== 0);
  if (method === 'GET' && path === '/api/menu') {
    return (state.menu_items || [])
      .filter((i) => i.available !== 0)
      .map((i) => ({
        ...i,
        featured: i.featured ? 1 : 0,
        offer_badge: i.offer_badge || '',
        compare_price_cents: Number(i.compare_price_cents) || 0,
        options: typeof i.options === 'string' ? JSON.parse(i.options || '[]') : (i.options || []),
      }));
  }
  if (method === 'GET' && path === '/api/offers') {
    return sortRows((state.offers || []).filter((o) => o.available !== 0));
  }
  if (method === 'GET' && path === '/api/onboarding') {
    return sortRows((state.onboarding_slides || []).filter((s) => s.available !== 0));
  }
  if (method === 'GET' && path === '/api/cake-options') {
    const rows = (state.cake_options || []).filter((r) => r.available !== 0);
    return {
      groups: (state.cake_groups || []).map((g) => ({
        key: g.key,
        label: g.label,
        mode: g.mode,
        options: rows.filter((r) => r.type === g.key),
      })),
    };
  }
  if (method === 'GET' && path === '/api/gallery') return state.gallery_images || [];
  if (method === 'GET' && path === '/api/reviews') return (state.reviews || []).filter((r) => r.available !== 0);
  if (method === 'GET' && path === '/api/faqs') return (state.faqs || []).filter((f) => f.available !== 0);

  const trackMatch = path.match(/^\/api\/orders\/track\/([^/]+)$/);
  if (method === 'GET' && trackMatch) {
    const code = decodeURIComponent(trackMatch[1]).trim().toUpperCase();
    const order = (state.orders || []).find((o) => String(o.code).toUpperCase() === code);
    if (!order) {
      const err = new Error('No order found with that code. Please double-check your code.');
      err.status = 404;
      throw err;
    }
    const firstName = String(order.customer_name || '').trim().split(/\s+/)[0] || 'Guest';
    return {
      code: order.code,
      type: order.type,
      status: order.status,
      customer_first_name: firstName,
      pickup_date: order.pickup_date,
      pickup_time: order.pickup_time,
      fulfillment: order.fulfillment,
      branch: order.branch,
      total_cents: order.total_cents,
      delivery_fee_cents: order.delivery_fee_cents || 0,
      created_at: order.created_at,
      items: order.items || [],
      shop_phone: state.settings?.phone || '',
      shop_whatsapp: state.settings?.whatsapp || '',
    };
  }

  if (method === 'POST' && path === '/api/messages') {
    const msg = {
      id: Date.now(),
      name: String(data.name || '').trim(),
      email: String(data.email || '').trim(),
      phone: String(data.phone || '').trim(),
      message: String(data.message || '').trim(),
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    state.messages = [msg, ...(state.messages || [])];
    saveDb(state);
    return { ok: true };
  }

  if (method === 'POST' && path === '/api/orders/cake') {
    const optsById = new Map((state.cake_options || []).map((o) => [Number(o.id), o]));
    const size = optsById.get(Number(data.size));
    const scale = Number(size?.price_scale) || 1;
    const details = {};
    let unitPrice = 0;

    for (const g of state.cake_groups || []) {
      const rawPick = data[g.key];
      if (!rawPick) continue;
      if (g.mode === 'multi') {
        const ids = Array.isArray(rawPick) ? rawPick : String(rawPick).split(',').filter(Boolean);
        const picked = ids.map((id) => optsById.get(Number(id))).filter(Boolean);
        if (picked.length) {
          details[g.key] = picked.map((p) => p.name).join(', ');
          for (const p of picked) {
            unitPrice += p.scales ? Math.round((p.price_cents * scale) / 25) * 25 : p.price_cents;
          }
        }
      } else {
        const p = optsById.get(Number(rawPick));
        if (p) {
          details[g.key] = p.name;
          unitPrice += g.key === 'size' ? p.price_cents : (p.scales ? Math.round((p.price_cents * scale) / 25) * 25 : p.price_cents);
        }
      }
    }
    if (data.message) details.message = String(data.message).trim();
    if (data.design_notes) details.design_notes = String(data.design_notes).trim();

    const qty = Math.max(1, Number(data.quantity) || 1);
    const deliveryFee = data.fulfillment === 'delivery' ? Number(state.settings?.delivery_fee || 0) : 0;
    const totalCents = unitPrice * qty + deliveryFee;
    const branchObj = (state.branches || []).find((b) => String(b.id) === String(data.branch));
    const code = makeCode();
    const item = {
      name: `Custom Cake (${details.size || 'Custom'})`,
      unit_price_cents: unitPrice,
      quantity: qty,
      details,
    };
    const order = {
      id: Date.now(),
      code,
      order_code: code,
      type: 'cake',
      status: 'new',
      customer_name: String(data.customer_name || '').trim(),
      customer_phone: String(data.customer_phone || '').trim(),
      customer_email: String(data.customer_email || '').trim(),
      pickup_date: String(data.pickup_date || ''),
      pickup_time: String(data.pickup_time || ''),
      fulfillment: data.fulfillment === 'delivery' ? 'delivery' : 'pickup',
      delivery_address: String(data.delivery_address || '').trim(),
      delivery_fee_cents: deliveryFee,
      branch: branchObj?.name || '',
      notes: String(data.notes || '').trim(),
      total_cents: totalCents,
      created_at: new Date().toISOString(),
      items: [item],
    };
    order.whatsapp_url = buildWhatsAppUrl(state, order, [`${qty}x ${item.name} - $${((unitPrice * qty) / 100).toFixed(2)}`]);
    state.orders = [order, ...(state.orders || [])];
    saveDb(state);
    return order;
  }

  if (method === 'POST' && path === '/api/orders/menu') {
    const menuById = new Map((state.menu_items || []).map((m) => [Number(m.id), m]));
    const orderItems = [];
    let subtotal = 0;

    for (const line of data.items || []) {
      const qty = Math.max(1, Number(line.quantity) || 1);
      if (line.custom_box && typeof line.custom_box === 'object') {
        const tier = BOX_TIERS[Number(line.custom_box.size)] || BOX_TIERS[9];
        const pieces = Array.isArray(line.custom_box.pieces) ? line.custom_box.pieces : [];
        const counts = new Map();
        for (const p of pieces) counts.set(p, (counts.get(p) || 0) + 1);
        const assortment = [...counts.entries()].map(([n, c]) => `${c}× ${n}`).join(', ')
          || str(line.custom_box.flavors);
        const details = { Assortment: assortment };
        if (line.custom_box.ribbon) details.Ribbon = str(line.custom_box.ribbon);
        if (line.custom_box.note || line.custom_box.card) {
          details['Gift card'] = `“${str(line.custom_box.note || line.custom_box.card)}”`;
        }
        orderItems.push({ name: tier.name, unit_price_cents: tier.price_cents, quantity: qty, details });
        subtotal += tier.price_cents * qty;
      } else {
        const item = menuById.get(Number(line.id));
        if (!item) continue;
        const groups = parseOptions(item.options);
        const picks = Array.isArray(line.choices) ? line.choices : [];
        let extra = 0;
        const details = {};
        groups.forEach((g, gi) => {
          const chosen = Array.isArray(picks[gi]) ? [...new Set(picks[gi])] : [];
          if (!chosen.length) return;
          const names = chosen
            .filter((idx) => Number.isInteger(idx) && g.choices?.[idx])
            .sort((a, b) => a - b)
            .map((idx) => {
              extra += Number(g.choices[idx].price_cents) || 0;
              return g.choices[idx].name;
            });
          if (names.length) details[g.name] = names.join(', ');
        });
        if (line.note && str(line.note)) details.Note = str(line.note);
        const unitPrice = (Number(item.price_cents) || 0) + extra;
        orderItems.push({ name: item.name, unit_price_cents: unitPrice, quantity: qty, details });
        subtotal += unitPrice * qty;
      }
    }

    const deliveryFee = data.fulfillment === 'delivery' ? Number(state.settings?.delivery_fee || 0) : 0;
    const totalCents = subtotal + deliveryFee;
    const branchObj = (state.branches || []).find((b) => String(b.id) === String(data.branch));
    const code = makeCode();
    const order = {
      id: Date.now(),
      code,
      order_code: code,
      type: 'menu',
      status: 'new',
      customer_name: String(data.customer_name || '').trim(),
      customer_phone: String(data.customer_phone || '').trim(),
      customer_email: String(data.customer_email || '').trim(),
      pickup_date: String(data.pickup_date || ''),
      pickup_time: String(data.pickup_time || ''),
      fulfillment: data.fulfillment === 'delivery' ? 'delivery' : 'pickup',
      delivery_address: String(data.delivery_address || '').trim(),
      delivery_fee_cents: deliveryFee,
      branch: branchObj?.name || '',
      notes: String(data.notes || '').trim(),
      total_cents: totalCents,
      created_at: new Date().toISOString(),
      items: orderItems,
    };
    order.whatsapp_url = buildWhatsAppUrl(
      state,
      order,
      orderItems.map((i) => `${i.quantity}x ${i.name} - $${((i.unit_price_cents * i.quantity) / 100).toFixed(2)}`),
    );
    state.orders = [order, ...(state.orders || [])];
    saveDb(state);
    return order;
  }

  // ---------- Admin Endpoints ----------
  if (path === '/api/admin/status') {
    const admins = state.admins || [];
    return {
      setupNeeded: admins.length === 0,
      admin: isLoggedIn() && admins.length ? { id: 1, username: admins[0].username } : null,
    };
  }
  if (method === 'POST' && path === '/api/admin/setup') {
    if ((state.admins || []).length) fail(403, 'An admin account already exists. Please log in.');
    const { username, password } = checkCredentials(data.username, data.password);
    state.admins = [{ id: 1, username, password_hash: await hashPassword(password) }];
    saveDb(state);
    logIn();
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/login') {
    const admin = (state.admins || [])[0];
    const sameUser = admin && admin.username.toLowerCase() === String(data.username || '').trim().toLowerCase();
    if (!sameUser || !(await checkPassword(state, admin, String(data.password || '')))) {
      fail(401, 'Wrong username or password.');
    }
    logIn();
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/logout') {
    logOut();
    return { ok: true };
  }

  // Everything below needs a logged-in admin, like the real server.
  if (path.startsWith('/api/admin/') && !isLoggedIn()) fail(401, 'Please log in.');

  if (method === 'POST' && path === '/api/admin/password') {
    const admin = (state.admins || [])[0];
    if (!admin || !(await checkPassword(state, admin, String(data.current_password || '')))) {
      fail(400, 'Current password is wrong.');
    }
    const { password } = checkCredentials(admin.username, data.new_password);
    admin.password_hash = await hashPassword(password);
    saveDb(state);
    return { ok: true };
  }
  if (path === '/api/admin/counts') {
    return {
      newOrders: (state.orders || []).filter((o) => o.status === 'new').length,
      unreadMessages: (state.messages || []).filter((m) => !m.is_read).length,
    };
  }
  if (method === 'GET' && path === '/api/admin/orders') {
    const filter = url.searchParams.get('status') || 'active';
    const all = state.orders || [];
    const orders = filter === 'active'
      ? all.filter((o) => ['new', 'confirmed', 'baking', 'ready'].includes(o.status))
      : filter === 'all'
        ? all
        : all.filter((o) => o.status === filter);
    const counts = {};
    for (const o of all) counts[o.status] = (counts[o.status] || 0) + 1;
    return { orders, counts };
  }
  const orderPatch = path.match(/^\/api\/admin\/orders\/(\d+)$/);
  if (orderPatch && method === 'PATCH') {
    if (!ORDER_STATUSES.includes(data.status)) fail(400, 'Unknown status.');
    const o = (state.orders || []).find((x) => Number(x.id) === Number(orderPatch[1]));
    if (!o) fail(404, 'Order not found.');
    o.status = data.status;
    saveDb(state);
    return { ok: true };
  }
  if (method === 'GET' && path === '/api/admin/cake-options') {
    return { groups: state.cake_groups || [], options: sortRows(state.cake_options) };
  }
  if (method === 'GET' && path === '/api/admin/settings') return state.settings || {};
  if (method === 'PUT' && path === '/api/admin/settings') {
    state.settings = { ...(state.settings || {}), ...settingsFields(data) };
    saveDb(state);
    return state.settings;
  }
  if (method === 'POST' && path === '/api/admin/gallery') {
    fail(400, 'Photo uploads need the live server. This preview site can\'t store photos.');
  }

  // Lists the dashboard manages: menu items, cake options, gallery, reviews, FAQ, branches, messages.
  const crud = path.match(/^\/api\/admin\/([a-z-]+)(?:\/(\d+))?$/);
  const collection = crud && COLLECTIONS[crud[1]];
  if (collection) {
    const rows = (state[collection.key] ||= []);
    const id = crud[2] ? Number(crud[2]) : null;
    if (id === null) {
      if (method === 'GET') return sortRows(rows, collection.order).map(collection.out || ((r) => r));
      if (method === 'POST' && collection.fields) {
        const row = { id: nextId(rows), ...collection.fields(data) };
        rows.push(row);
        saveDb(state);
        return collection.out ? collection.out(row) : row;
      }
    } else {
      const index = rows.findIndex((r) => Number(r.id) === id);
      if (index === -1) fail(404, `${collection.label} not found.`);
      if (method === 'DELETE') {
        rows.splice(index, 1);
        saveDb(state);
        return { ok: true };
      }
      const update = method === 'PATCH' ? collection.patch : collection.fields;
      if ((method === 'PUT' || method === 'PATCH') && update) {
        Object.assign(rows[index], update(data, rows[index]));
        saveDb(state);
        return collection.out ? collection.out(rows[index]) : rows[index];
      }
    }
  }

  fail(404, 'Not found.');
}

// ---------- Admin helpers ----------

const ORDER_STATUSES = ['new', 'confirmed', 'baking', 'ready', 'completed', 'cancelled'];

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

const isLoggedIn = () => Boolean(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY));
const logIn = () => localStorage.setItem(SESSION_KEY, '1');
function logOut() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
const toCents = (v) => Math.max(0, Math.round(Number(v || 0) * 100)) || 0;
const toInt = (v, fallback = 0) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Math.round(Number(v)) : fallback);
const str = (v) => String(v ?? '').trim();
const nextId = (rows) => rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
const parseOptions = (v) => (typeof v === 'string' ? JSON.parse(v || '[]') : (v || []));

function sortRows(rows = [], order = 'sort') {
  const list = [...rows];
  if (order === 'newest') return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.id - b.id));
}

// Field rules mirror src/routes/admin.js, so the preview behaves like the real dashboard.
const COLLECTIONS = {
  'menu-items': {
    key: 'menu_items',
    label: 'Menu item',
    fields: (d, existing) => {
      const f = {
        name: str(d.name),
        description: str(d.description),
        category: str(d.category) || 'Other',
        price_cents: toCents(d.price),
        compare_price_cents: d.compare_price !== undefined && str(d.compare_price) !== '' ? toCents(d.compare_price) : 0,
        featured: bool(d.featured) ? 1 : 0,
        offer_badge: str(d.offer_badge),
        available: bool(d.available) ? 1 : 0,
        sort_order: toInt(d.sort_order),
        options: parseOptions(d.options),
        image: bool(d.remove_image) ? null : (str(d.image_url) || existing?.image || null),
      };
      if (!f.name) fail(400, 'Name is required.');
      if (f.available && f.price_cents === 0) fail(400, `Set a price for "${f.name}" before showing it on the menu.`);
      return f;
    },
    out: (item) => ({ ...item, options: parseOptions(item.options) }),
  },
  offers: {
    key: 'offers',
    label: 'Offer',
    fields: (d, existing) => {
      const target_type = ['product', 'category', 'box', 'none'].includes(str(d.target_type)) ? str(d.target_type) : 'category';
      const f = {
        title: str(d.title),
        subtitle: str(d.subtitle),
        badge: str(d.badge),
        cta_text: str(d.cta_text) || 'Explore',
        target_type,
        target_value: target_type === 'none' ? '' : str(d.target_value),
        image: bool(d.remove_image) ? '' : (str(d.image_url) || existing?.image || ''),
        available: bool(d.available) ? 1 : 0,
        sort_order: toInt(d.sort_order),
      };
      if (!f.title) fail(400, 'Offer title is required.');
      return f;
    },
  },
  onboarding: {
    key: 'onboarding_slides',
    label: 'Onboarding slide',
    fields: (d, existing) => {
      const media_url = str(d.media_url) || existing?.media_url || '';
      if (!media_url) fail(400, 'Please enter a media URL or preset path.');
      const media_type = str(d.media_type) === 'video' || /\.(mp4|webm|mov)$/i.test(media_url) ? 'video' : 'image';
      return {
        media_type,
        media_url,
        caption: str(d.caption),
        available: d.available === undefined ? (existing?.available ?? 1) : (bool(d.available) ? 1 : 0),
        sort_order: d.sort_order !== undefined ? toInt(d.sort_order) : (existing?.sort_order ?? 0),
      };
    },
  },
  'cake-options': {
    key: 'cake_options',
    label: 'Option',
    fields: (d) => {
      const isSize = d.type === 'size';
      const f = {
        type: str(d.type),
        name: str(d.name),
        description: str(d.description),
        price_cents: toCents(d.price),
        color: str(d.color),
        visual: str(d.visual),
        available: bool(d.available) ? 1 : 0,
        sort_order: toInt(d.sort_order),
        price_scale: isSize ? Math.round((Number(d.price_scale) || 1) * 100) / 100 : 1,
        lead_days: isSize ? toInt(d.lead_days) : 0,
        scales: isSize || bool(d.scales) ? 1 : 0,
      };
      if (!f.name) fail(400, 'Name is required.');
      return f;
    },
  },
  gallery: {
    key: 'gallery_images',
    label: 'Photo',
    order: 'sort',
    fields: (d) => ({ caption: str(d.caption), sort_order: toInt(d.sort_order) }),
  },
  reviews: {
    key: 'reviews',
    label: 'Review',
    fields: (d) => {
      const f = {
        name: str(d.name),
        text: str(d.text),
        rating: Math.min(5, Math.max(1, toInt(d.rating, 5))),
        available: bool(d.available) ? 1 : 0,
        sort_order: toInt(d.sort_order),
      };
      if (!f.name || !f.text) fail(400, 'Name and review are required.');
      return f;
    },
  },
  faqs: {
    key: 'faqs',
    label: 'Question',
    fields: (d) => {
      const f = { question: str(d.question), answer: str(d.answer), available: bool(d.available) ? 1 : 0, sort_order: toInt(d.sort_order) };
      if (!f.question || !f.answer) fail(400, 'Question and answer are required.');
      return f;
    },
  },
  branches: {
    key: 'branches',
    label: 'Branch',
    fields: (d) => {
      const f = {
        name: str(d.name),
        address: str(d.address),
        phone: str(d.phone),
        whatsapp: str(d.whatsapp),
        maps_link: str(d.maps_link),
        available: bool(d.available) ? 1 : 0,
        sort_order: toInt(d.sort_order),
      };
      if (!f.name) fail(400, 'Branch name is required.');
      return f;
    },
  },
  messages: {
    key: 'messages',
    label: 'Message',
    order: 'newest',
    patch: (d) => ({ is_read: bool(d.is_read) ? 1 : 0 }),
  },
};

function settingsFields(d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (['orders_open', 'delivery_enabled'].includes(k)) out[k] = bool(v) ? '1' : '0';
    else if (['delivery_fee', 'delivery_min'].includes(k)) out[k] = String(toCents(v));
    else if (k === 'currency') out[k] = str(v).toUpperCase();
    else out[k] = str(v);
  }
  return out;
}

function checkCredentials(rawUsername, rawPassword) {
  const username = str(rawUsername);
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) fail(400, 'Username must be 3–40 letters, numbers, dots, dashes or underscores.');
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  if (password.length < 8) fail(400, 'Password must be at least 8 characters.');
  if (password.length > 200) fail(400, 'Password is too long.');
  return { username, password };
}

// Passwords are stored as salted PBKDF2-SHA256 hashes, never as plain text.
const PBKDF2_ROUNDS = 210000;
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

async function derive(password, salt, rounds) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ROUNDS}$${toHex(salt)}$${await derive(password, salt, PBKDF2_ROUNDS)}`;
}

async function checkPassword(state, admin, password) {
  // Accounts made by the old preview stored the password as plain text: check it once, then hash it.
  if (admin.password !== undefined && !admin.password_hash) {
    if (admin.password !== password) return false;
    admin.password_hash = await hashPassword(password);
    delete admin.password;
    saveDb(state);
    return true;
  }
  const [scheme, rounds, saltHex, hashHex] = String(admin.password_hash || '').split('$');
  if (scheme !== 'pbkdf2') return false;
  return (await derive(password, fromHex(saltHex), Number(rounds))) === hashHex;
}
