# Savory Chocolate

A luxury bakery website with a real-time 3D cake builder, online ordering for pickup or delivery, and an admin dashboard.

| Page | URL | What it does |
| --- | --- | --- |
| Home | `/` | 3D cake hero, two ways to order, builder showcase, favorites, reviews, gallery, visit info |
| Custom Cakes | `/cakes` | Cake builder with a **live 3D preview**: shape, size, tiers, flavor, filling, frosting, color, drip, toppings, extras, dietary needs and a message on a chocolate plaque |
| Menu | `/menu` | Menu by category, item add-ons (sizes, extras), cart, pickup or delivery checkout |
| Gallery | `/gallery` | Photo gallery with a lightbox |
| About | `/about` | Your story, values and visit info |
| FAQ | `/faq` | Questions and answers |
| Contact | `/contact` | Contact details and a message form (messages go to the admin) |
| Admin | `/admin` | Everything below |

Customers pay on pickup or delivery. There's no online payment yet.

## Running it

You need [Node.js](https://nodejs.org) 22.13 or newer. The database is Node's built-in SQLite, so there's nothing else to install.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first visit to http://localhost:3000/admin asks you to **create the admin account**. Do this before the site goes online.

## The admin dashboard

- **Orders**: new orders get a red badge (checked every 30 seconds). Move them through *New → Confirmed → Ready → Completed* in one click. Delivery orders show the address and fee, and cakes with dietary needs are flagged.
- **Messages**: from the Contact page. Reply by email, mark as read, delete.
- **Menu**: items with photos, categories and **add-ons**. For example, a "Size" group (pick one, required: Regular / Large +$1.00) or "Extras" (pick any: whipped cream +$0.50).
- **Cake builder**: every choice in the builder, with its price. Colors and drips have a color picker; shapes, tiers, toppings and extras have a **3D look** that controls what the live preview draws.
- **Gallery**: upload photos (several at once) and add captions.
- **Reviews**: real customer reviews for the home page. The section stays hidden until you add one.
- **FAQ**: questions for the FAQ page. Six starter questions are included; edit them to match how you work.
- **Settings**: shop details, home page headline, your story, Instagram/Facebook links, pausing orders, days of notice for cakes, currency, **delivery** (on/off, fee, minimum order, area), and your password.

## How it's built

```
server.js                Express app: security headers, page routes, API, error handling
src/db.js                SQLite schema + versioned upgrades (backs up the database before upgrading)
src/cake-groups.js       The cake builder steps and their starter options
src/menu-options.js      Menu add-on validation and pricing
src/pages.js             Fills views/*.html with the header, footer and shop details
src/auth.js              Password hashing (scrypt), sessions, login rate limit
src/validate.js          Input checks
src/routes/public.js     Menu, cake options, gallery, reviews, FAQ, orders, contact form
src/routes/admin.js      Everything behind the admin login
views/                   Page templates and shared partials (header, footer, forms)
public/js/cake3d.js      The Three.js 3D cake (shapes, tiers, drips, toppings, candles, plaque)
public/js/admin/         One module per admin tab
public/css/              styles.css (dark & gold site), admin.css (light dashboard)
data/                    Created on first run: app.db + uploads/ (photos) + backups
```

- **Prices are always calculated on the server**, never trusted from the browser.
- Orders keep a copy of every name and price, so editing the menu never changes past orders.
- Same-day orders need 30 minutes' notice. Custom cakes need the days of notice set in Settings.
- The 3D preview pauses when it's off screen, respects "reduce motion", and falls back to an illustration on devices without WebGL.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `DATA_DIR` | `./data` | Where the database, photos and backups live |
| `NODE_ENV` | — | Set to `production` when hosting over HTTPS (secure cookie, cached pages) |
| `TRUST_PROXY` | `loopback` | Set to `1` behind a hosting proxy (Render, Railway, nginx, …) |

## Hosting notes

- **Back up the `data/` folder.** It holds all orders, messages, menu items and photos.
- Use a host with a persistent disk (a VPS, Render with a disk, Railway with a volume, Fly.io with a volume).
- Always serve the site over HTTPS.

## Ideas for later

- Email or SMS alert to the shop when an order or message comes in
- Online payment (Stripe) or a deposit for custom cakes
- Customers uploading a reference photo with a cake order
- Pickup times limited to opening hours
