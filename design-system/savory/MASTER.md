# SAVORY — Design System Master File (`ui-ux-pro-max`)

> **LOGIC:** When building or updating a specific screen, check `design-system/savory/pages/[page-name].md` first.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** SAVORY Chocolatier & 3D Cake Studio
**Category:** Luxury Chocolatier / Patisserie / Interactive 3D E-Commerce
**Design Dials:** Variance `7/10` (Editorial Chocolatier Asymmetry) | Motion `6/10` (Choreographed Stagger & 3D Turntable) | Density `4/10` (Luxury Gallery Breathing Room)

---

## 1. Brand Color Tokens (SAVORY Official Palette)

| Role | Hex | CSS Variable | Notes |
|------|-----|--------------|-------|
| **Butter Cream (Primary Surface)** | `#F7F7D3` | `--bg` | Official SAVORY warm butter-cream background |
| **Soft Cream (Elevated Surface)** | `#FBFBE6` | `--bg-soft` / `--card` | Elevated card & showcase surface |
| **Crisp White (Product Frame)** | `#FFFFFF` | `--surface-white` | High-contrast square frame for 3D & chocolate photography |
| **Deep Cocoa (Primary Brand)** | `#4C2007` | `--cocoa` / `--text` | Official SAVORY deep cocoa brown |
| **Dark Roasted Espresso** | `#3B1704` | `--cocoa-deep` | Sawtooth dark sections, sidebar, and card title bars |
| **Rich Ganache** | `#6B3110` | `--cocoa-mid` | Secondary buttons, split-CTA icon cap, hover accents |
| **Champagne Gold** | `#D9B066` | `--gold` | Luxury accents, focus rings, active category highlights |
| **Warm Truffle Muted** | `#6E462C` | `--muted` | Body copy & secondary metadata (`>= 4.5:1` contrast on `#F7F7D3`) |
| **Border Hairline** | `rgba(76, 32, 7, 0.14)` | `--line` | Subtle structural borders |
| **Destructive / Error** | `#9E2A2B` | `--danger` | Form validation & cancellation states |

---

## 2. Typography

- **Display / Headings:** `'Cormorant Garamond', Georgia, serif` (`--serif`) — High-contrast editorial chocolatier headlines (`600–700` weight).
- **UI / Body / Controls:** `'Plus Jakarta Sans', system-ui, sans-serif` (`--sans`) — Crisp geometric legibility for prices, options, badges, and checkout forms (`400–800` weight).
- **Script Accent:** `'Alex Brush', cursive` (`--script`) — Handwritten patisserie flourishes.

---

## 3. Signature Chocolatier Architectural Components

1. **Top Glossy Melted Chocolate Drip (`views/partials/choco-drip.html`):**
   - Multi-stop 3D SVG drip with specular highlights anchored to the top of hero sections.
2. **Left Dark-Cocoa Serrated Sidebar (`.choco-sidebar`):**
   - Vertical `#3B1704` navigation panel on the left of the hero with a custom SVG sawtooth right edge, uppercase tracked category links (`›`), and a live **"Open Daily · Hours & Branches"** status pill at the base.
3. **Two-Tone Split CTA Button (`.btn-split`):**
   - Left chamber in `#3B1704` with uppercase tracked label + right square icon chamber in `#6B3110`.
4. **2-Card Spotlight Carousel (`.choco-duo-wrap`):**
   - Paired square white showcase cards with top-right `PRICE` badge, protruding `‹` `›` dark cocoa edge arrows, detached `#3B1704` title bar below, and `BUY NOW` action link.
5. **Full-Bleed Dark Cocoa Sawtooth Section (`.section-cocoa-sawtooth`):**
   - Top serrated zigzag border, 3-column grid of crisp white square cards (`.choco-square-card`), and a wide horizontal white showcase banner (`.choco-wide-banner`) at the bottom.

---

## 4. Motion & Choreography (`Motion: 6/10`)

- **Stagger Grid Reveal:** Easing `cubic-bezier(0.34, 1.4, 0.64, 1)` (`back.out(1.4)`), duration `380ms`, per-item stagger `55ms`.
- **Hover Elevation:** `transform: translateY(-3px)` over `220ms cubic-bezier(0.22, 1, 0.36, 1)` — never shift surrounding layout geometry.
- **Reduced Motion:** Always honor `@media (prefers-reduced-motion: reduce)` by disabling transforms/animations and rendering final states immediately.

---

## 5. Three.js 3D Studio Guidelines (`threejs` Stack)

- **Single WebGLRenderer per page:** Reuse the renderer instance and release offscreen snapshot renderers immediately after generating card thumbnails.
- **Mobile & Desktop Interaction:** Enable `OrbitControls` with both mouse and touch support (`touch-action: pan-y`) so mobile users can spin the 3D cake effortlessly.
- **Accessibility:** Always attach `role="img"` and a descriptive `aria-label` to `renderer.domElement`.
- **Pixel Ratio Ceiling:** Clamp `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))` for smooth 60fps mobile performance.

---

## 6. Pre-Delivery Audit Checklist

- [x] **No emojis as UI icons** — Use crisp inline SVGs (Lucide / custom vector icons) across all customer & admin screens.
- [x] **Visible opening hours** — Display branch hours & live open indicator in the hero sidebar and visit cards.
- [x] **3-Step Conversion Funnel** — Clear step progression in the 3D Cake Studio and Checkout flows.
- [x] **`cursor: pointer`** on all interactive buttons, cards, swatches, and tabs.
- [x] **WCAG AA Contrast (`>= 4.5:1`)** on both `#F7F7D3` cream and `#3B1704` dark cocoa surfaces.
- [x] **Visible `:focus-visible` states** for keyboard navigation.
- [x] **`prefers-reduced-motion` respected** in CSS and JS.
- [x] **Responsive across `375px`, `768px`, `1024px`, `1440px`** with zero horizontal overflow.
