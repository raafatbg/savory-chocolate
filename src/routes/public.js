import crypto from 'node:crypto';
import { Router } from 'express';
import { db, getSettings, transaction } from '../db.js';
import { CAKE_GROUPS, scaledPrice } from '../cake-groups.js';
import { parseOptions, priceChoices } from '../menu-options.js';
import {
  HttpError, bad, text, int, customer, pickupDate, pickupTime, fulfillment, email,
} from '../validate.js';

export const router = Router();

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

// ---------- Orders ----------

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
    const item = find.get(int(line?.id, 'Item'));
    if (!item) throw bad('One of the items in your order is no longer available. Please refresh the menu.');
    const quantity = int(line.quantity, 'Quantity', { min: 1, max: 99 });
    const { extra, summary } = priceChoices(item.name, parseOptions(item.options), line.choices);
    return { name: item.name, unit_price_cents: item.price_cents + extra, quantity, details: summary };
  });

  const order = saveOrder('menu', { who, date, time, notes, lines, settings, body });
  res.status(201).json({ ...order, currency: settings.currency });
});

router.post('/orders/cake', (req, res) => {
  const settings = assertOrdersOpen();
  const body = req.body ?? {};
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

  const order = saveOrder('cake', { who, date, time, notes, lines: [line], settings, body });
  res.status(201).json({ ...order, currency: settings.currency });
});

function assertOrdersOpen() {
  const settings = getSettings();
  if (settings.orders_open !== '1') {
    throw new HttpError(503, 'We\'re not taking online orders right now. Please call us instead.');
  }
  return settings;
}

function saveOrder(type, { who, date, time, notes, lines, settings, body }) {
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price_cents * l.quantity, 0);
  const delivery = fulfillment(body, settings, subtotal);
  const total = subtotal + delivery.fee_cents;

  return transaction(() => {
    const code = newOrderCode();
    const { lastInsertRowid: orderId } = db.prepare(`
      INSERT INTO orders (code, type, customer_name, customer_phone, customer_email, pickup_date, pickup_time, notes,
                          total_cents, fulfillment, delivery_address, delivery_fee_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, type, who.name, who.phone, who.email, date, time, notes,
      total, delivery.fulfillment, delivery.address, delivery.fee_cents);

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

// Short, readable codes customers can say over the phone, e.g. SC-7KX3QM.
function newOrderCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const exists = db.prepare('SELECT 1 FROM orders WHERE code = ?');
  for (;;) {
    const bytes = crypto.randomBytes(6);
    const code = 'SC-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
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
