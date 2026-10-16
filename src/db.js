import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const isNew = !fs.existsSync(path.join(DATA_DIR, 'app.db'));

export const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'Other',
    price_cents INTEGER NOT NULL,
    image       TEXT,
    available   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Choices for the cake builder. For sizes the price is the base price;
  -- for flavors, fillings and frostings it is an add-on (often 0).
  CREATE TABLE IF NOT EXISTS cake_options (
    id          INTEGER PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('size', 'flavor', 'filling', 'frosting')),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0,
    available   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    type           TEXT NOT NULL CHECK (type IN ('menu', 'cake')),
    status         TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'confirmed', 'ready', 'completed', 'cancelled')),
    customer_name  TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    pickup_date    TEXT NOT NULL,
    pickup_time    TEXT NOT NULL,
    notes          TEXT NOT NULL DEFAULT '',
    total_cents    INTEGER NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Names and prices are copied onto the order so later menu edits
  -- never change what a customer already ordered.
  CREATE TABLE IF NOT EXISTS order_items (
    id               INTEGER PRIMARY KEY,
    order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity         INTEGER NOT NULL,
    details          TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
`);

export const DEFAULT_SETTINGS = {
  shop_name: 'Savory Chocolate',
  tagline: 'Handmade cakes and chocolate treats, baked to order.',
  about: 'We are a small bakery making everything from scratch with real butter, good chocolate and a lot of care. Order a custom cake for your next celebration, or pick something from today\'s menu.',
  phone: '',
  email: '',
  address: '',
  hours: 'Tue–Sat 9am–6pm\nSun 10am–3pm\nClosed Mondays',
  currency: 'USD',
  cake_lead_days: '2',
  orders_open: '1',
};

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

if (isNew) seedSamples();

// Starter content so the site isn't empty on first run. The admin can edit or delete all of it.
function seedSamples() {
  const opt = db.prepare('INSERT INTO cake_options (type, name, description, price_cents, sort_order) VALUES (?, ?, ?, ?, ?)');
  const options = [
    ['size', '6" round', 'Serves 8–10', 4500],
    ['size', '8" round', 'Serves 12–16', 6000],
    ['size', '10" round', 'Serves 20–25', 8500],
    ['flavor', 'Dark chocolate', 'Rich cocoa sponge', 0],
    ['flavor', 'Vanilla bean', 'Classic and light', 0],
    ['flavor', 'Red velvet', '', 500],
    ['filling', 'No filling', '', 0],
    ['filling', 'Chocolate ganache', '', 500],
    ['filling', 'Salted caramel', '', 600],
    ['filling', 'Fresh strawberry', '', 700],
    ['frosting', 'Chocolate buttercream', '', 0],
    ['frosting', 'Vanilla buttercream', '', 0],
    ['frosting', 'Cream cheese', '', 400],
  ];
  options.forEach(([type, name, desc, price], i) => opt.run(type, name, desc, price, i));

  const item = db.prepare('INSERT INTO menu_items (name, description, category, price_cents, sort_order) VALUES (?, ?, ?, ?, ?)');
  const items = [
    ['Chocolate fudge slice', 'A thick slice of our house chocolate cake.', 'Cakes by the slice', 550],
    ['Carrot cake slice', 'Spiced carrot cake with cream cheese frosting.', 'Cakes by the slice', 500],
    ['Brownie', 'Dense, fudgy and dark.', 'Bakes', 350],
    ['Chocolate chip cookie', 'Crisp edges, soft middle.', 'Bakes', 250],
    ['Hot chocolate', 'Made with melted dark chocolate and steamed milk.', 'Drinks', 450],
  ];
  items.forEach(([name, desc, cat, price], i) => item.run(name, desc, cat, price, i));
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
