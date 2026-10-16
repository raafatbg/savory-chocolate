import crypto from 'node:crypto';
import { Router } from 'express';
import { db, getSettings, transaction } from '../db.js';
import { HttpError, bad, text, int, customer, pickupDate, pickupTime } from '../validate.js';

export const router = Router();

const CAKE_TYPES = ['size', 'flavor', 'filling', 'frosting'];

router.get('/settings', (req, res) => {
  res.json(getSettings());
});

router.get('/menu', (req, res) => {
  const items = db.prepare(`
    SELECT id, name, description, category, price_cents, image
    FROM menu_items WHERE available = 1
    ORDER BY sort_order, name
  `).all();
  res.json(items);
});

router.get('/cake-options', (req, res) => {
  const rows = db.prepare(`
    SELECT id, type, name, description, price_cents
    FROM cake_options WHERE available = 1
    ORDER BY sort_order, id
  `).all();
  const grouped = Object.fromEntries(CAKE_TYPES.map((t) => [t, []]));
  for (const row of rows) grouped[row.type].push(row);
  res.json(grouped);
});

router.post('/orders/menu', (req, res) => {
  const settings = assertOrdersOpen();
  const body = req.body ?? {};
  const who = customer(body);
  const date = pickupDate(body.pickup_date);
  const time = pickupTime(body.pickup_time, date);
  const notes = text(body.notes, 'Notes', { max: 1000 });

  if (!Array.isArray(body.items) || body.items.length === 0) throw bad('Your cart is empty.');
  if (body.items.length > 50) throw bad('Too many different items in one order.');

  const find = db.prepare('SELECT id, name, price_cents FROM menu_items WHERE id = ? AND available = 1');
  const lines = body.items.map((line) => {
    const item = find.get(int(line.id, 'Item'));
    if (!item) throw bad('One of the items in your cart is no longer available. Please refresh the menu.');
    const quantity = int(line.quantity, 'Quantity', { min: 1, max: 99 });
    return { name: item.name, unit_price_cents: item.price_cents, quantity, details: {} };
  });

  const order = saveOrder('menu', who, date, time, notes, lines);
  res.status(201).json({ ...order, currency: settings.currency });
});

router.post('/orders/cake', (req, res) => {
  const settings = assertOrdersOpen();
  const body = req.body ?? {};
  const who = customer(body);
  const date = pickupDate(body.pickup_date, { minDaysAhead: Number(settings.cake_lead_days) || 0 });
  const time = pickupTime(body.pickup_time, date);
  const notes = text(body.notes, 'Design notes', { max: 1000 });
  const message = text(body.message, 'Message on the cake', { max: 60 });

  const find = db.prepare('SELECT name, price_cents FROM cake_options WHERE id = ? AND type = ? AND available = 1');
  const chosen = {};
  let price = 0;
  for (const type of CAKE_TYPES) {
    const option = find.get(int(body[type], `Cake ${type}`), type);
    if (!option) throw bad(`Please choose a ${type}.`);
    chosen[type] = option.name;
    price += option.price_cents;
  }

  const line = {
    name: `Custom cake (${chosen.size})`,
    unit_price_cents: price,
    quantity: 1,
    details: { ...chosen, message },
  };

  const order = saveOrder('cake', who, date, time, notes, [line]);
  res.status(201).json({ ...order, currency: settings.currency });
});

function assertOrdersOpen() {
  const settings = getSettings();
  if (settings.orders_open !== '1') {
    throw new HttpError(503, 'We\'re not taking online orders right now. Please call us instead.');
  }
  return settings;
}

function saveOrder(type, who, date, time, notes, lines) {
  const total = lines.reduce((sum, l) => sum + l.unit_price_cents * l.quantity, 0);
  return transaction(() => {
    const code = newOrderCode();
    const { lastInsertRowid: orderId } = db.prepare(`
      INSERT INTO orders (code, type, customer_name, customer_phone, customer_email, pickup_date, pickup_time, notes, total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, type, who.name, who.phone, who.email, date, time, notes, total);

    const insertLine = db.prepare(`
      INSERT INTO order_items (order_id, name, unit_price_cents, quantity, details) VALUES (?, ?, ?, ?, ?)
    `);
    for (const l of lines) insertLine.run(orderId, l.name, l.unit_price_cents, l.quantity, JSON.stringify(l.details));

    return { code, total_cents: total, pickup_date: date, pickup_time: time };
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
