import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { db, getSettings, DEFAULT_SETTINGS, UPLOAD_DIR } from '../db.js';
import {
  hashPassword, verifyPassword, adminCount, createSession, destroySession, currentAdmin, requireAdmin,
  loginBlocked, recordLoginFailure, clearLoginFailures,
} from '../auth.js';
import { HttpError, bad, text, int, money, bool } from '../validate.js';

export const router = Router();

// ---------- Account ----------

router.get('/status', (req, res) => {
  res.json({ setupNeeded: adminCount() === 0, admin: currentAdmin(req) });
});

// Creates the first admin account. Only works while no admin exists yet.
router.post('/setup', (req, res) => {
  if (adminCount() > 0) throw new HttpError(403, 'An admin account already exists. Please log in.');
  const { username, password } = credentials(req.body);
  const { lastInsertRowid } = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
    .run(username, hashPassword(password));
  createSession(res, Number(lastInsertRowid));
  res.status(201).json({ ok: true });
});

router.post('/login', (req, res) => {
  if (loginBlocked(req.ip)) throw new HttpError(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
  const username = text(req.body?.username, 'Username', { required: true, max: 40 });
  const password = text(req.body?.password, 'Password', { required: true, max: 200 });
  const admin = db.prepare('SELECT id, password_hash FROM admins WHERE username = ?').get(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    recordLoginFailure(req.ip);
    throw new HttpError(401, 'Wrong username or password.');
  }
  clearLoginFailures(req.ip);
  createSession(res, admin.id);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.use(requireAdmin);

router.post('/password', (req, res) => {
  const current = text(req.body?.current_password, 'Current password', { required: true, max: 200 });
  const row = db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(req.admin.id);
  if (!verifyPassword(current, row.password_hash)) throw bad('Current password is wrong.');
  const { password } = credentials({ username: req.admin.username, password: req.body?.new_password });
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(password), req.admin.id);
  db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(req.admin.id);
  createSession(res, req.admin.id);
  res.json({ ok: true });
});

function credentials(body) {
  const username = text(body?.username, 'Username', { required: true, max: 40 });
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw bad('Username must be 3–40 letters, numbers, dots, dashes or underscores.');
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < 8) throw bad('Password must be at least 8 characters.');
  if (password.length > 200) throw bad('Password is too long.');
  return { username, password };
}

// ---------- Orders ----------

const STATUSES = ['new', 'confirmed', 'ready', 'completed', 'cancelled'];

router.get('/orders', (req, res) => {
  const filter = String(req.query.status || 'active');
  let orders;
  if (filter === 'active') {
    orders = db.prepare(`
      SELECT * FROM orders WHERE status IN ('new', 'confirmed', 'ready') ORDER BY pickup_date, pickup_time LIMIT 300
    `).all();
  } else if (STATUSES.includes(filter)) {
    orders = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 300').all(filter);
  } else {
    orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300').all();
  }
  const items = db.prepare('SELECT name, unit_price_cents, quantity, details FROM order_items WHERE order_id = ? ORDER BY id');
  for (const o of orders) {
    o.items = items.all(o.id).map((i) => ({ ...i, details: JSON.parse(i.details) }));
  }
  const counts = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all().map((r) => [r.status, r.n]),
  );
  res.json({ orders, counts });
});

router.patch('/orders/:id', (req, res) => {
  const status = String(req.body?.status);
  if (!STATUSES.includes(status)) throw bad('Unknown status.');
  const { changes } = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, int(req.params.id, 'Order'));
  if (!changes) throw new HttpError(404, 'Order not found.');
  res.json({ ok: true });
});

// ---------- Menu items ----------

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) cb(null, true);
    else cb(bad('Image must be a JPG, PNG, WebP or GIF.'));
  },
});

function removeImage(filename) {
  if (filename && /^[a-f0-9]+\.(jpg|png|webp|gif)$/.test(filename)) {
    fs.rm(path.join(UPLOAD_DIR, filename), { force: true }, () => {});
  }
}

// Runs a handler that may have received an uploaded image, and deletes the
// upload again if the handler rejects the request.
const withImage = (handler) => [
  upload.single('image'),
  (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      removeImage(req.file?.filename);
      throw err;
    }
  },
];

function menuItemFields(body) {
  return {
    name: text(body.name, 'Name', { required: true, max: 100 }),
    description: text(body.description, 'Description', { max: 500 }),
    category: text(body.category, 'Category', { max: 60 }) || 'Other',
    price_cents: money(body.price, 'Price'),
    available: bool(body.available) ? 1 : 0,
    sort_order: body.sort_order === undefined || body.sort_order === '' ? 0 : int(body.sort_order, 'Sort order', { max: 9999 }),
  };
}

router.get('/menu-items', (req, res) => {
  // Same order as the public menu, so categories appear in the order customers see them.
  res.json(db.prepare('SELECT * FROM menu_items ORDER BY sort_order, name').all());
});

router.post('/menu-items', ...withImage((req, res) => {
  const f = menuItemFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO menu_items (name, description, category, price_cents, available, sort_order, image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(f.name, f.description, f.category, f.price_cents, f.available, f.sort_order, req.file?.filename ?? null);
  res.status(201).json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(lastInsertRowid));
}));

router.put('/menu-items/:id', ...withImage((req, res) => {
  const id = int(req.params.id, 'Item');
  const existing = db.prepare('SELECT image FROM menu_items WHERE id = ?').get(id);
  if (!existing) throw new HttpError(404, 'Menu item not found.');
  const f = menuItemFields(req.body ?? {});

  let image = existing.image;
  if (req.file || bool(req.body?.remove_image)) {
    removeImage(existing.image);
    image = req.file?.filename ?? null;
  }

  db.prepare(`
    UPDATE menu_items SET name = ?, description = ?, category = ?, price_cents = ?, available = ?, sort_order = ?, image = ?
    WHERE id = ?
  `).run(f.name, f.description, f.category, f.price_cents, f.available, f.sort_order, image, id);
  res.json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id));
}));

router.delete('/menu-items/:id', (req, res) => {
  const id = int(req.params.id, 'Item');
  const existing = db.prepare('SELECT image FROM menu_items WHERE id = ?').get(id);
  if (!existing) throw new HttpError(404, 'Menu item not found.');
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  removeImage(existing.image);
  res.json({ ok: true });
});

// ---------- Cake options ----------

const CAKE_TYPES = ['size', 'flavor', 'filling', 'frosting'];

function cakeOptionFields(body) {
  const type = String(body.type);
  if (!CAKE_TYPES.includes(type)) throw bad('Unknown option type.');
  return {
    type,
    name: text(body.name, 'Name', { required: true, max: 80 }),
    description: text(body.description, 'Description', { max: 200 }),
    price_cents: money(body.price, type === 'size' ? 'Price' : 'Extra charge'),
    available: bool(body.available) ? 1 : 0,
    sort_order: body.sort_order === undefined || body.sort_order === '' ? 0 : int(body.sort_order, 'Sort order', { max: 9999 }),
  };
}

router.get('/cake-options', (req, res) => {
  res.json(db.prepare('SELECT * FROM cake_options ORDER BY type, sort_order, id').all());
});

router.post('/cake-options', (req, res) => {
  const f = cakeOptionFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO cake_options (type, name, description, price_cents, available, sort_order) VALUES (?, ?, ?, ?, ?, ?)
  `).run(f.type, f.name, f.description, f.price_cents, f.available, f.sort_order);
  res.status(201).json(db.prepare('SELECT * FROM cake_options WHERE id = ?').get(lastInsertRowid));
});

router.put('/cake-options/:id', (req, res) => {
  const id = int(req.params.id, 'Option');
  const f = cakeOptionFields(req.body ?? {});
  const { changes } = db.prepare(`
    UPDATE cake_options SET type = ?, name = ?, description = ?, price_cents = ?, available = ?, sort_order = ? WHERE id = ?
  `).run(f.type, f.name, f.description, f.price_cents, f.available, f.sort_order, id);
  if (!changes) throw new HttpError(404, 'Option not found.');
  res.json(db.prepare('SELECT * FROM cake_options WHERE id = ?').get(id));
});

router.delete('/cake-options/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM cake_options WHERE id = ?').run(int(req.params.id, 'Option'));
  if (!changes) throw new HttpError(404, 'Option not found.');
  res.json({ ok: true });
});

// ---------- Settings ----------

router.put('/settings', (req, res) => {
  const body = req.body ?? {};
  const limits = { shop_name: 80, tagline: 200, about: 2000, phone: 40, email: 200, address: 300, hours: 500 };
  const updates = {};

  for (const [key, max] of Object.entries(limits)) {
    if (key in body) updates[key] = text(body[key], key.replace('_', ' '), { max, required: key === 'shop_name' });
  }
  if ('currency' in body) {
    const currency = text(body.currency, 'Currency', { required: true, max: 3 }).toUpperCase();
    try {
      new Intl.NumberFormat('en', { style: 'currency', currency });
    } catch {
      throw bad('Currency must be a 3-letter code like USD, EUR or GBP.');
    }
    updates.currency = currency;
  }
  if ('cake_lead_days' in body) updates.cake_lead_days = String(int(body.cake_lead_days, 'Days of notice', { max: 60 }));
  if ('orders_open' in body) updates.orders_open = bool(body.orders_open) ? '1' : '0';

  const save = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  for (const [key, value] of Object.entries(updates)) {
    if (key in DEFAULT_SETTINGS) save.run(value, key);
  }
  res.json(getSettings());
});
