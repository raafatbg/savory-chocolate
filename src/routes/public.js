import crypto from 'node:crypto';
import { Router } from 'express';
import { db, getSettings, transaction } from '../db.js';
import { CAKE_GROUPS, scaledPrice } from '../cake-groups.js';
import { parseOptions, priceChoices } from '../menu-options.js';
import { withImage } from '../uploads.js';
import { orderMessage, whatsappLink } from '../whatsapp.js';
import {
  HttpError, bad, text, int, customer, pickupDate, pickupTime, fulfillment, email,
} from '../validate.js';

export const router = Router();

const BOX_TIERS = {
  9: { name: 'SAVORY 9-Piece Assorted Gift Box', price_cents: 1800 },
  16: { name: 'SAVORY 16-Piece Luxury Gift Box', price_cents: 3000 },
  25: { name: 'SAVORY 25-Piece Grand Selection Box', price_cents: 4500 },
};

router.get('/settings', (req, res) => {
  res.json(getSettings());
});

router.get('/menu', (req, res) => {
  const items = db.prepare(`
    SELECT id, name, description, category, price_cents, image, options
    FROM menu_items WHERE available = 1
    ORDER BY sort_order, name
  `).all();
  res.json(items.map((i) => ({ ...i, options: parseOptions(i.options) })));
});

router.get('/cake-options', (req, res) => {
  const rows = db.prepare(`
    SELECT id, type, name, description, price_cents, color, visual, price_scale, scales, lead_days
    FROM cake_options WHERE available = 1
    ORDER BY sort_order, id
  `).all();
  res.json({
    groups: CAKE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      mode: g.mode,
      options: rows.filter((r) => r.type === g.key),
    })),
  });
});

router.get('/gallery', (req, res) => {
  res.json(db.prepare('SELECT id, image, caption FROM gallery_images ORDER BY sort_order, id DESC').all());
});

router.get('/reviews', (req, res) => {
  res.json(db.prepare('SELECT id, name, text, rating FROM reviews WHERE available = 1 ORDER BY sort_order, id DESC').all());
});

router.get('/faqs', (req, res) => {
  res.json(db.prepare('SELECT id, question, answer FROM faqs WHERE available = 1 ORDER BY sort_order, id').all());
});

router.get('/branches', (req, res) => {
  res.json(db.prepare(`
    SELECT id, name, address, phone, whatsapp, maps_link FROM branches WHERE available = 1 ORDER BY sort_order, id
  `).all());
});

// ---------- Live Order Status Tracker ----------

router.get('/orders/track/:code', (req, res) => {
  const raw = String(req.params.code || '').trim().toUpperCase();
  if (!raw || raw.length > 24) throw bad('Please enter a valid order code.');
  const order = db.prepare(`
    SELECT id, code, type, status, customer_name, pickup_date, pickup_time,
           total_cents, fulfillment, delivery_fee_cents, branch, created_at
    FROM orders WHERE UPPER(code) = ?
  `).get(raw);
  if (!order) throw new HttpError(404, 'No order found with that code. Please double-check your code.');

  const items = db.prepare(`
    SELECT name, unit_price_cents, quantity, details
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(order.id).map((it) => {
    let details = {};
    try { details = JSON.parse(it.details || '{}'); } catch { details = {}; }
    return { name: it.name, unit_price_cents: it.unit_price_cents, quantity: it.quantity, details };
  });

  const firstName = String(order.customer_name || '').trim().split(/\s+/)[0] || 'Guest';
  const settings = getSettings();
  res.json({
    code: order.code,
    type: order.type,
    status: order.status,
    customer_first_name: firstName,
    pickup_date: order.pickup_date,
    pickup_time: order.pickup_time,
    total_cents: order.total_cents,
    delivery_fee_cents: order.delivery_fee_cents,
    fulfillment: order.fulfillment,
    branch: order.branch,
    created_at: order.created_at,
    currency: settings.currency || 'USD',
    items,
  });
});

// ---------- Orders ----------

// The branch the customer picked. With a single branch it's chosen automatically.
function pickBranch(body) {
  const branches = db.prepare('SELECT * FROM branches WHERE available = 1 ORDER BY sort_order, id').all();
  if (!branches.length) return null;
  const branch = branches.find((b) => b.id === Number(body.branch)) || (branches.length === 1 ? branches[0] : null);
  if (!branch) throw bad('Please choose a branch.');
  return branch;
}

// A light brake on scripted spam: at most 20 orders per visitor per hour.
const recentOrders = new Map();
function limitOrders(req) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const times = (recentOrders.get(req.ip) || []).filter((t) => t > hourAgo);
  if (times.length >= 20) throw new HttpError(429, 'You\'ve placed several orders already. Please call or message us instead.');
  recentOrders.set(req.ip, [...times, Date.now()]);
}

// Sends the saved order back with a ready-made WhatsApp message to the branch.
function respondWithOrder(req, res, { type, order, who, lines, notes, branch, photo, settings }) {
  const photoUrl = photo ? `${req.protocol}://${req.get('host')}/uploads/${photo}` : '';
  const text = orderMessage({ type, order, who, lines, notes, branch, photoUrl, currency: settings.currency });
  res.status(201).json({
    ...order,
    order_code: order.code,
    currency: settings.currency,
    branch: branch?.name || '',
    whatsapp_url: whatsappLink(branch?.whatsapp || settings.whatsapp, text),
  });
}

router.post('/orders/menu', (req, res) => {
  const settings = assertOrdersOpen();
  const body = req.body ?? {};
  const who = customer(body);
  const date = pickupDate(body.pickup_date);
  const time = pickupTime(body.pickup_time, date);
  const notes = text(body.notes, 'Notes', { max: 1000 });

  if (!Array.isArray(body.items) || body.items.length === 0) throw bad('Your order is empty.');
  if (body.items.length > 50) throw bad('Too many different items in one order.');

  const find = db.prepare('SELECT id, name, price_cents, options FROM menu_items WHERE id = ? AND available = 1');
  const lines = body.items.map((line) => {
    const quantity = int(line?.quantity, 'Quantity', { min: 1, max: 99 });
    if (line?.custom_box && typeof line.custom_box === 'object') {
      const box = line.custom_box;
      const tier = BOX_TIERS[Number(box.size)];
      if (!tier) throw bad('Invalid gift box size.');
      const pieces = Array.isArray(box.pieces) ? box.pieces.slice(0, 25).map((p) => text(p, 'Chocolate piece', { max: 60 })).filter(Boolean) : [];
      if (!pieces.length) throw bad('Please choose the chocolates for your gift box.');
      const counts = new Map();
      for (const p of pieces) counts.set(p, (counts.get(p) || 0) + 1);
      const assortment = [...counts.entries()].map(([name, n]) => `${n}× ${name}`).join(', ');
      const ribbon = text(box.ribbon, 'Ribbon', { max: 40 });
      const giftNote = text(box.note, 'Gift card note', { max: 120 });
      const details = { Assortment: assortment };
      if (ribbon) details.Ribbon = ribbon;
      if (giftNote) details['Gift card'] = `“${giftNote}”`;
      return { name: tier.name, unit_price_cents: tier.price_cents, quantity, details };
    }
    const item = find.get(int(line?.id, 'Item'));
    if (!item) throw bad('One of the items in your order is no longer available. Please refresh the menu.');
    const { extra, summary } = priceChoices(item.name, parseOptions(item.options), line.choices);
    return { name: item.name, unit_price_cents: item.price_cents + extra, quantity, details: summary };
  });

  const branch = pickBranch(body);
  limitOrders(req);
  const order = saveOrder('menu', { who, date, time, notes, lines, settings, body, branch });
  respondWithOrder(req, res, { type: 'menu', order, who, lines, notes, branch, settings });
});

router.post('/orders/cake', ...withImage((req, res) => {
  const settings = assertOrdersOpen();
  const body = parseOrderBody(req);
  const who = customer(body);
  const notes = text(body.notes, 'Design notes', { max: 1000 });
  const message = text(body.message, 'Message on the cake', { max: 60 });

  const available = db.prepare(
    'SELECT id, type, name, price_cents, price_scale, scales, lead_days FROM cake_options WHERE available = 1',
  ).all();

  // The size sets the multiplier for add-on prices and may need extra days of notice.
  const sizes = available.filter((o) => o.type === 'size');
  const size = sizes.find((o) => o.id === Number(body.size));
  if (sizes.length && !size) throw bad('Please choose a size.');
  const scale = size?.price_scale || 1;
  const leadDays = (Number(settings.cake_lead_days) || 0) + (size?.lead_days || 0);
  const date = pickupDate(body.pickup_date, { minDaysAhead: leadDays });
  const time = pickupTime(body.pickup_time, date);
  const cost = (o) => (o.type === 'size' || !o.scales ? o.price_cents : scaledPrice(o.price_cents, scale));

  const details = {};
  let price = 0;

  for (const group of CAKE_GROUPS) {
    const options = available.filter((o) => o.type === group.key);
    if (!options.length) continue;
    const byId = new Map(options.map((o) => [o.id, o]));

    if (group.mode === 'single') {
      const option = byId.get(Number(body[group.key]));
      if (!option) throw bad(`Please choose a ${group.label.toLowerCase()}.`);
      details[group.key] = option.name;
      price += cost(option);
    } else {
      const ids = body[group.key] === undefined ? [] : body[group.key];
      if (!Array.isArray(ids) || ids.length > 20) throw bad(`Your ${group.label.toLowerCase()} choice is not valid.`);
      const chosen = [...new Set(ids.map(Number))].map((id) => {
        const option = byId.get(id);
        if (!option) throw bad(`One of the ${group.label.toLowerCase()} you picked is no longer available. Please refresh the page.`);
        return option;
      });
      if (chosen.length) details[group.key] = chosen.map((o) => o.name).join(', ');
      price += chosen.reduce((sum, o) => sum + cost(o), 0);
    }
  }
  if (message) details.message = message;

  const title = [details.size, details.tiers].filter(Boolean).join(', ');
  const line = { name: `Custom cake${title ? ` (${title})` : ''}`, unit_price_cents: price, quantity: 1, details };

  const branch = pickBranch(body);
  limitOrders(req);
  const photo = req.file?.filename || '';
  const order = saveOrder('cake', { who, date, time, notes, lines: [line], settings, body, branch, photo });
  respondWithOrder(req, res, { type: 'cake', order, who, lines: [line], notes, branch, photo, settings });
}, 'photo'));

function parseOrderBody(req) {
  if (!req.is('multipart/form-data')) return req.body ?? {};
  try {
    return JSON.parse(req.body?.data || '{}');
  } catch {
    throw bad('The order could not be read. Please try again.');
  }
}

function assertOrdersOpen() {
  const settings = getSettings();
  if (settings.orders_open !== '1') {
    throw new HttpError(503, 'We\'re not taking online orders right now. Please call us instead.');
  }
  return settings;
}

function saveOrder(type, { who, date, time, notes, lines, settings, body, branch = null, photo = '' }) {
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price_cents * l.quantity, 0);
  const delivery = fulfillment(body, settings, subtotal);
  const total = subtotal + delivery.fee_cents;

  return transaction(() => {
    const code = newOrderCode();
    const { lastInsertRowid: orderId } = db.prepare(`
      INSERT INTO orders (code, type, customer_name, customer_phone, customer_email, pickup_date, pickup_time, notes,
                          total_cents, fulfillment, delivery_address, delivery_fee_cents, branch, reference_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, type, who.name, who.phone, who.email, date, time, notes,
      total, delivery.fulfillment, delivery.address, delivery.fee_cents, branch?.name || '', photo);

    const insertLine = db.prepare(`
      INSERT INTO order_items (order_id, name, unit_price_cents, quantity, details) VALUES (?, ?, ?, ?, ?)
    `);
    for (const l of lines) insertLine.run(orderId, l.name, l.unit_price_cents, l.quantity, JSON.stringify(l.details));

    return {
      code,
      total_cents: total,
      delivery_fee_cents: delivery.fee_cents,
      fulfillment: delivery.fulfillment,
      delivery_address: delivery.address,
      pickup_date: date,
      pickup_time: time,
    };
  });
}

// Short, readable codes customers can say over the phone, e.g. SAV-7KX3QM.
function newOrderCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const exists = db.prepare('SELECT 1 FROM orders WHERE code = ?');
  for (;;) {
    const bytes = crypto.randomBytes(6);
    const code = 'SAV-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    if (!exists.get(code)) return code;
  }
}

// ---------- Contact form ----------

const recentMessages = new Map();

router.post('/messages', (req, res) => {
  const body = req.body ?? {};
  // Hidden "website" field: people never fill it in, spam bots usually do.
  if (body.website) return res.status(201).json({ ok: true });

  const hourAgo = Date.now() - 60 * 60 * 1000;
  const times = (recentMessages.get(req.ip) || []).filter((t) => t > hourAgo);
  if (times.length >= 5) throw new HttpError(429, 'You\'ve sent several messages already. Please try again later or give us a call.');

  const name = text(body.name, 'Name', { required: true, max: 100 });
  const from = email(body.email, 'Email', { required: true });
  const phone = text(body.phone, 'Phone', { max: 40 });
  const message = text(body.message, 'Message', { required: true, max: 3000 });

  db.prepare('INSERT INTO messages (name, email, phone, message) VALUES (?, ?, ?, ?)').run(name, from, phone, message);
  recentMessages.set(req.ip, [...times, Date.now()]);
  res.status(201).json({ ok: true });
});
