import { Router } from 'express';
import { db, getSettings, DEFAULT_SETTINGS } from '../db.js';
import { withImage, removeImage } from '../uploads.js';
import {
  hashPassword, verifyPassword, adminCount, createSession, destroySession, currentAdmin, requireAdmin,
  loginBlocked, recordLoginFailure, clearLoginFailures,
} from '../auth.js';
import { CAKE_GROUPS } from '../cake-groups.js';
import { normalizeOptions, parseOptions } from '../menu-options.js';
import { HttpError, bad, text, int, money, bool, hexColor, url, email, whatsappNumber } from '../validate.js';

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

// Badge counts for the dashboard tabs.
router.get('/counts', (req, res) => {
  res.json({
    newOrders: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'").get().n,
    unreadMessages: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0').get().n,
  });
});

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

// Image uploads (menu items and gallery) use the shared helpers in src/uploads.js.

const sortOrder = (value) => (value === undefined || value === '' ? 0 : int(value, 'Sort order', { max: 9999 }));

// ---------- Menu items ----------

function menuItemFields(body) {
  const f = {
    name: text(body.name, 'Name', { required: true, max: 100 }),
    description: text(body.description, 'Description', { max: 500 }),
    category: text(body.category, 'Category', { max: 60 }) || 'Other',
    price_cents: money(body.price, 'Price'),
    available: bool(body.available) ? 1 : 0,
    sort_order: sortOrder(body.sort_order),
    options: JSON.stringify(normalizeOptions(body.options ?? '[]')),
  };
  // Draft items start at 0.00; don't let one go live without a real price.
  if (f.available && f.price_cents === 0) throw bad(`Set a price for "${f.name}" before showing it on the menu.`);
  return f;
}

const withParsedOptions = (item) => item && { ...item, options: parseOptions(item.options) };

router.get('/menu-items', (req, res) => {
  // Same order as the public menu, so categories appear in the order customers see them.
  res.json(db.prepare('SELECT * FROM menu_items ORDER BY sort_order, name').all().map(withParsedOptions));
});

router.post('/menu-items', ...withImage((req, res) => {
  const f = menuItemFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO menu_items (name, description, category, price_cents, available, sort_order, options, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(f.name, f.description, f.category, f.price_cents, f.available, f.sort_order, f.options, req.file?.filename ?? null);
  res.status(201).json(withParsedOptions(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(lastInsertRowid)));
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
    UPDATE menu_items SET name = ?, description = ?, category = ?, price_cents = ?, available = ?, sort_order = ?,
                          options = ?, image = ?
    WHERE id = ?
  `).run(f.name, f.description, f.category, f.price_cents, f.available, f.sort_order, f.options, image, id);
  res.json(withParsedOptions(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id)));
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

function cakeOptionFields(body) {
  const group = CAKE_GROUPS.find((g) => g.key === String(body.type));
  if (!group) throw bad('Unknown option type.');
  const visual = text(body.visual, 'Look in 3D', { max: 20 });
  if (visual && !(group.visuals || []).includes(visual)) throw bad('That 3D look isn\'t available for this group.');
  return {
    type: group.key,
    name: text(body.name, 'Name', { required: true, max: 80 }),
    description: text(body.description, 'Description', { max: 200 }),
    price_cents: money(body.price, group.key === 'size' ? 'Price' : 'Extra charge'),
    color: group.color ? hexColor(body.color, 'Color') : '',
    visual,
    available: bool(body.available) ? 1 : 0,
    sort_order: sortOrder(body.sort_order),
    ...sizeRules(group.key, body),
  };
}

// Sizes carry a price multiplier for add-ons and extra days of notice; other choices say
// whether their price grows with the size.
function sizeRules(type, body) {
  if (type !== 'size') return { price_scale: 1, lead_days: 0, scales: bool(body.scales) ? 1 : 0 };
  const scale = Number(body.price_scale ?? 1);
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 10) throw bad('Add-on price multiplier must be between 0.25 and 10, like 1.5.');
  return {
    price_scale: Math.round(scale * 100) / 100,
    lead_days: body.lead_days === undefined || body.lead_days === '' ? 0 : int(body.lead_days, 'Extra days of notice', { max: 60 }),
    scales: 1,
  };
}

router.get('/cake-options', (req, res) => {
  res.json({
    groups: CAKE_GROUPS,
    options: db.prepare('SELECT * FROM cake_options ORDER BY sort_order, id').all(),
  });
});

router.post('/cake-options', (req, res) => {
  const f = cakeOptionFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO cake_options (type, name, description, price_cents, color, visual, available, sort_order, price_scale, scales, lead_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(f.type, f.name, f.description, f.price_cents, f.color, f.visual, f.available, f.sort_order, f.price_scale, f.scales, f.lead_days);
  res.status(201).json(db.prepare('SELECT * FROM cake_options WHERE id = ?').get(lastInsertRowid));
});

router.put('/cake-options/:id', (req, res) => {
  const id = int(req.params.id, 'Option');
  const f = cakeOptionFields(req.body ?? {});
  const { changes } = db.prepare(`
    UPDATE cake_options SET type = ?, name = ?, description = ?, price_cents = ?, color = ?, visual = ?, available = ?,
                            sort_order = ?, price_scale = ?, scales = ?, lead_days = ?
    WHERE id = ?
  `).run(f.type, f.name, f.description, f.price_cents, f.color, f.visual, f.available, f.sort_order,
    f.price_scale, f.scales, f.lead_days, id);
  if (!changes) throw new HttpError(404, 'Option not found.');
  res.json(db.prepare('SELECT * FROM cake_options WHERE id = ?').get(id));
});

router.delete('/cake-options/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM cake_options WHERE id = ?').run(int(req.params.id, 'Option'));
  if (!changes) throw new HttpError(404, 'Option not found.');
  res.json({ ok: true });
});

// ---------- Gallery ----------

router.get('/gallery', (req, res) => {
  res.json(db.prepare('SELECT * FROM gallery_images ORDER BY sort_order, id DESC').all());
});

router.post('/gallery', ...withImage((req, res) => {
  if (!req.file) throw bad('Please choose a photo to upload.');
  const caption = text(req.body?.caption, 'Caption', { max: 200 });
  const { lastInsertRowid } = db.prepare('INSERT INTO gallery_images (image, caption, sort_order) VALUES (?, ?, ?)')
    .run(req.file.filename, caption, sortOrder(req.body?.sort_order));
  res.status(201).json(db.prepare('SELECT * FROM gallery_images WHERE id = ?').get(lastInsertRowid));
}));

router.put('/gallery/:id', (req, res) => {
  const id = int(req.params.id, 'Photo');
  const caption = text(req.body?.caption, 'Caption', { max: 200 });
  const { changes } = db.prepare('UPDATE gallery_images SET caption = ?, sort_order = ? WHERE id = ?')
    .run(caption, sortOrder(req.body?.sort_order), id);
  if (!changes) throw new HttpError(404, 'Photo not found.');
  res.json(db.prepare('SELECT * FROM gallery_images WHERE id = ?').get(id));
});

router.delete('/gallery/:id', (req, res) => {
  const id = int(req.params.id, 'Photo');
  const existing = db.prepare('SELECT image FROM gallery_images WHERE id = ?').get(id);
  if (!existing) throw new HttpError(404, 'Photo not found.');
  db.prepare('DELETE FROM gallery_images WHERE id = ?').run(id);
  removeImage(existing.image);
  res.json({ ok: true });
});

// ---------- Reviews ----------

function reviewFields(body) {
  return {
    name: text(body.name, 'Name', { required: true, max: 80 }),
    text: text(body.text, 'Review', { required: true, max: 600 }),
    rating: int(body.rating ?? 5, 'Rating', { min: 1, max: 5 }),
    available: bool(body.available) ? 1 : 0,
    sort_order: sortOrder(body.sort_order),
  };
}

router.get('/reviews', (req, res) => {
  res.json(db.prepare('SELECT * FROM reviews ORDER BY sort_order, id DESC').all());
});

router.post('/reviews', (req, res) => {
  const f = reviewFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare('INSERT INTO reviews (name, text, rating, available, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(f.name, f.text, f.rating, f.available, f.sort_order);
  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(lastInsertRowid));
});

router.put('/reviews/:id', (req, res) => {
  const id = int(req.params.id, 'Review');
  const f = reviewFields(req.body ?? {});
  const { changes } = db.prepare('UPDATE reviews SET name = ?, text = ?, rating = ?, available = ?, sort_order = ? WHERE id = ?')
    .run(f.name, f.text, f.rating, f.available, f.sort_order, id);
  if (!changes) throw new HttpError(404, 'Review not found.');
  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(id));
});

router.delete('/reviews/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM reviews WHERE id = ?').run(int(req.params.id, 'Review'));
  if (!changes) throw new HttpError(404, 'Review not found.');
  res.json({ ok: true });
});

// ---------- FAQ ----------

function faqFields(body) {
  return {
    question: text(body.question, 'Question', { required: true, max: 200 }),
    answer: text(body.answer, 'Answer', { required: true, max: 2000 }),
    available: bool(body.available) ? 1 : 0,
    sort_order: sortOrder(body.sort_order),
  };
}

router.get('/faqs', (req, res) => {
  res.json(db.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all());
});

router.post('/faqs', (req, res) => {
  const f = faqFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare('INSERT INTO faqs (question, answer, available, sort_order) VALUES (?, ?, ?, ?)')
    .run(f.question, f.answer, f.available, f.sort_order);
  res.status(201).json(db.prepare('SELECT * FROM faqs WHERE id = ?').get(lastInsertRowid));
});

router.put('/faqs/:id', (req, res) => {
  const id = int(req.params.id, 'Question');
  const f = faqFields(req.body ?? {});
  const { changes } = db.prepare('UPDATE faqs SET question = ?, answer = ?, available = ?, sort_order = ? WHERE id = ?')
    .run(f.question, f.answer, f.available, f.sort_order, id);
  if (!changes) throw new HttpError(404, 'Question not found.');
  res.json(db.prepare('SELECT * FROM faqs WHERE id = ?').get(id));
});

router.delete('/faqs/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM faqs WHERE id = ?').run(int(req.params.id, 'Question'));
  if (!changes) throw new HttpError(404, 'Question not found.');
  res.json({ ok: true });
});

// ---------- Branches ----------

function branchFields(body) {
  return {
    name: text(body.name, 'Branch name', { required: true, max: 60 }),
    address: text(body.address, 'Address', { max: 300 }),
    phone: text(body.phone, 'Phone', { max: 40 }),
    whatsapp: whatsappNumber(body.whatsapp),
    maps_link: url(body.maps_link, 'Google Maps link'),
    available: bool(body.available) ? 1 : 0,
    sort_order: sortOrder(body.sort_order),
  };
}

router.get('/branches', (req, res) => {
  res.json(db.prepare('SELECT * FROM branches ORDER BY sort_order, id').all());
});

router.post('/branches', (req, res) => {
  const f = branchFields(req.body ?? {});
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO branches (name, address, phone, whatsapp, maps_link, available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(f.name, f.address, f.phone, f.whatsapp, f.maps_link, f.available, f.sort_order);
  res.status(201).json(db.prepare('SELECT * FROM branches WHERE id = ?').get(lastInsertRowid));
});

router.put('/branches/:id', (req, res) => {
  const id = int(req.params.id, 'Branch');
  const f = branchFields(req.body ?? {});
  const { changes } = db.prepare(`
    UPDATE branches SET name = ?, address = ?, phone = ?, whatsapp = ?, maps_link = ?, available = ?, sort_order = ?
    WHERE id = ?
  `).run(f.name, f.address, f.phone, f.whatsapp, f.maps_link, f.available, f.sort_order, id);
  if (!changes) throw new HttpError(404, 'Branch not found.');
  res.json(db.prepare('SELECT * FROM branches WHERE id = ?').get(id));
});

router.delete('/branches/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM branches WHERE id = ?').run(int(req.params.id, 'Branch'));
  if (!changes) throw new HttpError(404, 'Branch not found.');
  res.json({ ok: true });
});

// ---------- Contact messages ----------

router.get('/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC, id DESC LIMIT 300').all());
});

router.patch('/messages/:id', (req, res) => {
  const { changes } = db.prepare('UPDATE messages SET is_read = ? WHERE id = ?')
    .run(bool(req.body?.is_read) ? 1 : 0, int(req.params.id, 'Message'));
  if (!changes) throw new HttpError(404, 'Message not found.');
  res.json({ ok: true });
});

router.delete('/messages/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM messages WHERE id = ?').run(int(req.params.id, 'Message'));
  if (!changes) throw new HttpError(404, 'Message not found.');
  res.json({ ok: true });
});

// ---------- Settings ----------

router.put('/settings', (req, res) => {
  const body = req.body ?? {};
  const limits = {
    shop_name: 80, hero_title: 120, slogan: 120, tagline: 200, about: 2000, about_story: 5000,
    phone: 40, address: 300, hours: 500, delivery_area: 300,
  };
  const labels = {
    shop_name: 'Shop name', hero_title: 'Headline', about_story: 'Our story', delivery_area: 'Delivery area',
  };
  const updates = {};

  for (const [key, max] of Object.entries(limits)) {
    if (key in body) updates[key] = text(body[key], labels[key] || key.replace('_', ' '), { max, required: key === 'shop_name' });
  }
  if ('email' in body) updates.email = email(body.email);
  if ('instagram' in body) updates.instagram = url(body.instagram, 'Instagram link');
  if ('facebook' in body) updates.facebook = url(body.facebook, 'Facebook link');
  if ('maps_link' in body) updates.maps_link = url(body.maps_link, 'Google Maps link');
  if ('whatsapp' in body) updates.whatsapp = whatsappNumber(body.whatsapp);
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
  if ('delivery_enabled' in body) updates.delivery_enabled = bool(body.delivery_enabled) ? '1' : '0';
  if ('delivery_fee' in body) updates.delivery_fee = String(money(body.delivery_fee, 'Delivery fee'));
  if ('delivery_min' in body) updates.delivery_min = String(money(body.delivery_min === '' ? '0' : body.delivery_min, 'Minimum order for delivery'));

  const save = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  for (const [key, value] of Object.entries(updates)) {
    if (key in DEFAULT_SETTINGS) save.run(value, key);
  }
  res.json(getSettings());
});
