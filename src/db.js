import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { CAKE_SEEDS } from './cake-groups.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'app.db');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const isNew = !fs.existsSync(DB_FILE);

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// ---------- Version 1: the original schema ----------

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

if (isNew) seedVersion1();

// ---------- Later versions ----------

const MIGRATIONS = [
  null, // version 1 is the schema above
  migrateToVersion2,
  migrateToVersion3,
];
const LATEST = MIGRATIONS.length;

let version = db.prepare('PRAGMA user_version').get().user_version || 1;
if (version < LATEST && !isNew) backup(version);
while (version < LATEST) {
  transaction(() => {
    MIGRATIONS[version]();
    version += 1;
    db.exec(`PRAGMA user_version = ${version}`);
  });
}

// Copies the database before an upgrade, e.g. data/app.backup-v1-2026-10-16.db
function backup(fromVersion) {
  const target = path.join(DATA_DIR, `app.backup-v${fromVersion}-${new Date().toISOString().slice(0, 10)}.db`);
  if (!fs.existsSync(target)) {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    console.log(`Backed up the database to ${target} before upgrading it.`);
  }
}

// Version 3: bigger cakes cost more to decorate and need more notice.
//   price_scale (sizes): multiplies the extra charge of every add-on that scales with size
//   scales (other choices): 1 = its price grows with the cake size, 0 = fixed price (candles, toppers…)
//   lead_days (sizes): extra days of notice on top of the shop-wide minimum
function migrateToVersion3() {
  db.exec(`
    ALTER TABLE cake_options ADD COLUMN price_scale REAL NOT NULL DEFAULT 1;
    ALTER TABLE cake_options ADD COLUMN scales INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE cake_options ADD COLUMN lead_days INTEGER NOT NULL DEFAULT 0;
    UPDATE cake_options SET scales = 0 WHERE type = 'extras';
  `);

  // Starting point: add-ons scale with the size's price (a size that costs twice as much
  // makes twice as much cake to cover), and the largest size needs one extra day.
  const sizes = db.prepare("SELECT id, price_cents FROM cake_options WHERE type = 'size' ORDER BY price_cents, sort_order").all();
  const smallest = sizes.find((s) => s.price_cents > 0)?.price_cents;
  if (smallest) {
    const update = db.prepare('UPDATE cake_options SET price_scale = ? WHERE id = ?');
    for (const s of sizes) update.run(Math.max(1, Math.round((s.price_cents / smallest) * 4) / 4), s.id);
  }
  if (sizes.length >= 3) db.prepare('UPDATE cake_options SET lead_days = 1 WHERE id = ?').run(sizes[sizes.length - 1].id);
}

// Version 2: richer cake builder, menu add-ons, delivery, gallery, reviews, FAQ, contact messages.
function migrateToVersion2() {
  // cake_options: drop the fixed type list (validated in code now) and add color + visual.
  db.exec(`
    CREATE TABLE cake_options_v2 (
      id          INTEGER PRIMARY KEY,
      type        TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0,
      color       TEXT NOT NULL DEFAULT '',
      visual      TEXT NOT NULL DEFAULT '',
      available   INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO cake_options_v2 (id, type, name, description, price_cents, available, sort_order)
      SELECT id, type, name, description, price_cents, available, sort_order FROM cake_options;
    DROP TABLE cake_options;
    ALTER TABLE cake_options_v2 RENAME TO cake_options;

    -- Per-item choices, e.g. [{"name":"Size","type":"single","required":true,"choices":[{"name":"Large","price_cents":100}]}]
    ALTER TABLE menu_items ADD COLUMN options TEXT NOT NULL DEFAULT '[]';

    ALTER TABLE orders ADD COLUMN fulfillment TEXT NOT NULL DEFAULT 'pickup';
    ALTER TABLE orders ADD COLUMN delivery_address TEXT NOT NULL DEFAULT '';
    ALTER TABLE orders ADD COLUMN delivery_fee_cents INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE gallery_images (
      id         INTEGER PRIMARY KEY,
      image      TEXT NOT NULL,
      caption    TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE reviews (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      text       TEXT NOT NULL,
      rating     INTEGER NOT NULL DEFAULT 5,
      available  INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE faqs (
      id         INTEGER PRIMARY KEY,
      question   TEXT NOT NULL,
      answer     TEXT NOT NULL,
      available  INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE messages (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL DEFAULT '',
      phone      TEXT NOT NULL DEFAULT '',
      message    TEXT NOT NULL,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insertOption = db.prepare(`
    INSERT INTO cake_options (type, name, description, price_cents, color, visual, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const groupCount = db.prepare('SELECT COUNT(*) AS n FROM cake_options WHERE type = ?');
  for (const [type, rows] of Object.entries(CAKE_SEEDS)) {
    if (groupCount.get(type).n > 0) continue;
    rows.forEach(([name, desc, price, color, visual], i) => insertOption.run(type, name, desc, price, color, visual, i));
  }

  // Example add-ons on the sample items, if they're still there.
  const addOptions = db.prepare("UPDATE menu_items SET options = ? WHERE name = ? AND options = '[]'");
  addOptions.run(JSON.stringify([
    { name: 'Size', type: 'single', required: true, choices: [{ name: 'Regular', price_cents: 0 }, { name: 'Large', price_cents: 100 }] },
    { name: 'Extras', type: 'multi', required: false, choices: [{ name: 'Whipped cream', price_cents: 50 }, { name: 'Marshmallows', price_cents: 50 }] },
  ]), 'Hot chocolate');
  addOptions.run(JSON.stringify([
    { name: 'Serve it with', type: 'single', required: false, choices: [{ name: 'Vanilla ice cream', price_cents: 200 }, { name: 'Whipped cream', price_cents: 100 }] },
  ]), 'Chocolate fudge slice');

  const faq = db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)');
  [
    ['How far ahead should I order a custom cake?', 'Custom cakes need a few days\' notice. The cake builder shows the earliest date you can choose. For large or tiered cakes, earlier is always better.'],
    ['How do I pay?', 'You pay when you collect your order, or when it\'s delivered. There\'s nothing to pay online.'],
    ['Do you deliver?', 'Yes, within our delivery area. Choose "Delivery" at checkout to see the fee.'],
    ['Can you cater for allergies or dietary needs?', 'We offer vegan, gluten-free, nut-free and eggless options in the cake builder. Our kitchen handles nuts, gluten, dairy and eggs, so we can\'t guarantee a cake is completely allergen-free. Please tell us about any allergies in the notes.'],
    ['Can I change or cancel my order?', 'Please call us as soon as possible with your order number and we\'ll do our best to help.'],
    ['Can you recreate a design from a photo?', 'Often, yes! Describe it in the design notes when you order, or send us a message through the Contact page.'],
  ].forEach(([q, a], i) => faq.run(q, a, i));
}

function seedVersion1() {
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

// ---------- Settings ----------

// Defaults describe the real shop (from its public Facebook and Google Maps listings).
// Everything here can be changed in Admin → Settings.
export const DEFAULT_SETTINGS = {
  shop_name: 'Savory Chocolate',
  hero_title: 'Cakes as beautiful as your moments',
  slogan: 'Where every bite is a Savory moment',
  tagline: 'Chocolates, cakes and ice cream, made in Aramoun, Aley.',
  about: 'Savory Chocolate is a chocolate and sweets maker in Aramoun, Aley. We make chocolates, cakes, éclairs and ice cream, carry a wide selection of mixed nuts, and prepare chocolate favors for weddings and new arrivals.',
  about_story: 'Savory Chocolate is a chocolate and sweets maker in Aramoun, in the Aley district of Mount Lebanon.\n\nWe make chocolates, ice cream, éclairs and cakes, from classic gateaux to custom designs. Tell us your idea, or leave the design to our chef.\n\nFor weddings, baby showers and every kind of celebration we prepare wrapped chocolate favors, and during Ramadan and Eid you\'ll find Arabic sweets alongside our chocolates.\n\nCome and visit us in Aramoun, or send us a message on WhatsApp.',
  phone: '05 411 405',
  whatsapp: '+961 79 167 464',
  email: '',
  address: 'Aramoun, Aley\nMount Lebanon, Lebanon',
  maps_link: 'https://maps.google.com/?cid=4880834083851702817',
  hours: 'Call or WhatsApp us for today\'s opening hours.',
  instagram: 'https://www.instagram.com/savory.chocolate/',
  facebook: 'https://www.facebook.com/SavoryChocolate/',
  currency: 'USD',
  cake_lead_days: '2',
  orders_open: '1',
  delivery_enabled: '1',
  delivery_fee: '500',
  delivery_min: '0',
  delivery_area: 'Delivery is available in our local area. Message us on WhatsApp to check yours.',
};

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
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
