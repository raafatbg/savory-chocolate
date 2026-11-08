// Browser-side API fallback for static Firebase Hosting deployments (Spark plan).
// When the Express backend is not reachable at /api/*, this module serves and persists
// the full SAVORY database (seeded from /seed.json + localStorage) so all 3 sites
// (Cake Studio, Menu, and Admin) work out of the box on *.web.app.

const DB_KEY = 'savory_static_db_v2';
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
        options: typeof i.options === 'string' ? JSON.parse(i.options || '[]') : (i.options || []),
      }));
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
      if (line.custom_box) {
        const tier = BOX_TIERS[Number(line.custom_box.size)] || BOX_TIERS[9];
        const details = { Assortment: String(line.custom_box.flavors || '').trim() };
        if (line.custom_box.ribbon) details.Ribbon = String(line.custom_box.ribbon).trim();
        if (line.custom_box.card) details['Gift Card'] = String(line.custom_box.card).trim();
        orderItems.push({ name: tier.name, unit_price_cents: tier.price_cents, quantity: qty, details });
        subtotal += tier.price_cents * qty;
      } else {
        const item = menuById.get(Number(line.id));
        if (!item) continue;
        orderItems.push({ name: item.name, unit_price_cents: item.price_cents, quantity: qty, details: line.choices || {} });
        subtotal += item.price_cents * qty;
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
    const loggedIn = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return {
      setupNeeded: admins.length === 0,
      admin: loggedIn && admins.length ? { id: 1, username: admins[0].username } : null,
    };
  }
  if (method === 'POST' && path === '/api/admin/setup') {
    state.admins = [{ id: 1, username: String(data.username || 'admin').trim(), password: String(data.password || '') }];
    saveDb(state);
    localStorage.setItem(SESSION_KEY, '1');
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/login') {
    const admin = (state.admins || [])[0];
    if (!admin || (admin.username.toLowerCase() !== String(data.username || '').trim().toLowerCase() || admin.password !== String(data.password || ''))) {
      const err = new Error('Wrong username or password.');
      err.status = 401;
      throw err;
    }
    localStorage.setItem(SESSION_KEY, '1');
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/logout') {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
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
    const id = Number(orderPatch[1]);
    const o = (state.orders || []).find((x) => Number(x.id) === id);
    if (o && data.status) o.status = data.status;
    saveDb(state);
    return { ok: true };
  }
  if (orderPatch && method === 'DELETE') {
    const id = Number(orderPatch[1]);
    state.orders = (state.orders || []).filter((x) => Number(x.id) !== id);
    saveDb(state);
    return { ok: true };
  }
  if (method === 'GET' && path === '/api/admin/menu') {
    return (state.menu_items || []).map((i) => ({
      ...i,
      options: typeof i.options === 'string' ? JSON.parse(i.options || '[]') : (i.options || []),
    }));
  }
  if (method === 'POST' && path === '/api/admin/menu') {
    const next = {
      id: Date.now(),
      name: String(data.name || '').trim(),
      description: String(data.description || '').trim(),
      category: String(data.category || 'Other').trim(),
      price_cents: Math.round(Number(data.price || 0) * 100),
      available: data.available === '0' || data.available === false ? 0 : 1,
      sort_order: Number(data.sort_order || 0),
      options: typeof data.options === 'string' ? JSON.parse(data.options || '[]') : (data.options || []),
    };
    state.menu_items = [...(state.menu_items || []), next];
    saveDb(state);
    return next;
  }
  const menuMatch = path.match(/^\/api\/admin\/menu\/(\d+)$/);
  if (menuMatch && (method === 'PUT' || method === 'POST')) {
    const id = Number(menuMatch[1]);
    const item = (state.menu_items || []).find((x) => Number(x.id) === id);
    if (item) {
      if (data.name !== undefined) item.name = String(data.name).trim();
      if (data.description !== undefined) item.description = String(data.description).trim();
      if (data.category !== undefined) item.category = String(data.category).trim();
      if (data.price !== undefined) item.price_cents = Math.round(Number(data.price) * 100);
      if (data.available !== undefined) item.available = data.available === '0' || data.available === false ? 0 : 1;
      if (data.options !== undefined) item.options = typeof data.options === 'string' ? JSON.parse(data.options || '[]') : data.options;
      saveDb(state);
    }
    return item || { ok: true };
  }
  if (menuMatch && method === 'DELETE') {
    const id = Number(menuMatch[1]);
    state.menu_items = (state.menu_items || []).filter((x) => Number(x.id) !== id);
    saveDb(state);
    return { ok: true };
  }
  if (method === 'GET' && path === '/api/admin/cake-options') {
    return { groups: state.cake_groups || [], options: state.cake_options || [] };
  }
  if (method === 'GET' && path === '/api/admin/gallery') return state.gallery_images || [];
  if (method === 'GET' && path === '/api/admin/reviews') return state.reviews || [];
  if (method === 'GET' && path === '/api/admin/faqs') return state.faqs || [];
  if (method === 'GET' && path === '/api/admin/messages') return state.messages || [];
  if (method === 'GET' && path === '/api/admin/branches') return state.branches || [];
  if (method === 'GET' && path === '/api/admin/settings') return state.settings || {};
  if (method === 'PUT' && path === '/api/admin/settings') {
    state.settings = { ...(state.settings || {}), ...data };
    saveDb(state);
    return state.settings;
  }

  return { ok: true };
}
