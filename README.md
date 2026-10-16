# Savory Chocolate

Website for the Savory Chocolate bakery:

| Page | URL | What it does |
| --- | --- | --- |
| Home | `/` | Hero, links to cakes and menu, a few menu favorites, about, hours and contact |
| Custom Cakes | `/cakes` | Cake builder: size → flavor → filling → frosting → message → pickup → contact. The price updates live. |
| Menu | `/menu` | Items grouped by category, a cart (saved in the browser), and checkout for pickup |
| Admin | `/admin` | Orders, menu items (with photos), cake options and shop settings |

Customers pay at pickup. There's no online payment yet.

## Running it

You need [Node.js](https://nodejs.org) 22.13 or newer. It uses Node's built-in SQLite, so there's no database to install.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. `npm run dev` restarts automatically when you edit server files. Use `npm start` in production.

### First-time admin setup

Go to http://localhost:3000/admin. The first visit asks you to **create the admin account**. After that the setup page is gone, and everyone else just sees a login form. Do this before you put the site online.

## Managing the shop (admin)

- **Orders**: new orders show a red badge, and the page checks for new ones every 30 seconds. Move an order through *New → Confirmed → Ready → Picked up* with one click, or set any status (including *Cancelled*) from the dropdown. Pickups due today are tagged.
- **Menu items**: add, edit, delete, or untick **Shown** to hide an item without deleting it. Items are grouped by category. *Sort order* controls the order (lower numbers come first).
- **Cake options**: the sizes, flavors, fillings and frostings in the cake builder. A cake's price is **size price + extra charges** for the flavor, filling and frosting.
- **Settings**: shop name, tagline, about text, phone, email, address and hours (shown across the site). Also: pause online orders, days of notice needed for cakes, currency, and change password.

The site starts with some sample menu items and cake options so it doesn't look empty. Edit or delete them from the admin.

## How it's built

```
server.js              Express app: security headers, routes, error handling
src/db.js              SQLite schema, default settings, starter content
src/auth.js            Password hashing (scrypt), login sessions, login rate limit
src/validate.js        Input checks shared by the routes
src/routes/public.js   Menu, cake options, settings, placing orders
src/routes/admin.js    Everything behind the admin login
public/                The pages (plain HTML/CSS/JS, no build step)
data/                  Created on first run: app.db (database) + uploads/ (menu photos)
```

- **Prices are always calculated on the server** from the database, never trusted from the browser.
- Orders store a copy of item names and prices, so editing the menu later never changes past orders.
- Same-day pickups need at least 30 minutes' notice. Custom cakes need the number of days set in Settings.
- Menu photos: JPG, PNG, WebP or GIF, up to 5 MB.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `DATA_DIR` | `./data` | Where the database and uploaded photos live |
| `NODE_ENV` | — | Set to `production` when hosting over HTTPS (makes the login cookie HTTPS-only) |
| `TRUST_PROXY` | `loopback` | Set to `1` when running behind a hosting proxy (Render, Railway, nginx, …) |

## Hosting notes

- **Back up the `data/` folder.** It holds all orders, menu items and photos.
- Pick a host with a persistent disk (a VPS, Render with a disk, Railway with a volume, Fly.io with a volume). Hosts that wipe files on each deploy will lose the database.
- Always serve the site over HTTPS so the admin password isn't sent in plain text.

## Ideas for later

- Email or SMS notification to the shop when an order comes in
- Online payment (Stripe) or a deposit for custom cakes
- Reference photo upload on cake orders
- Opening-hours-aware pickup times
