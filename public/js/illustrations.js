// Rich, full-color 3D-shaded gourmet patisserie & chocolatier SVG illustrations
// inspired by luxury chocolatier studio photography.

const wrap = (inner) => `<svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="gPlate" cx="50%" cy="55%" r="48%">
      <stop offset="0%" stop-color="#3B1704" stop-opacity="0.24"/>
      <stop offset="65%" stop-color="#3B1704" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#3B1704" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gDarkChoc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5B280D"/>
      <stop offset="45%" stop-color="#341303"/>
      <stop offset="100%" stop-color="#1C0800"/>
    </linearGradient>
    <linearGradient id="gMilkGanache" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B87446"/>
      <stop offset="50%" stop-color="#8A4B24"/>
      <stop offset="100%" stop-color="#592A0E"/>
    </linearGradient>
    <linearGradient id="gSponge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7A3B17"/>
      <stop offset="55%" stop-color="#512209"/>
      <stop offset="100%" stop-color="#361403"/>
    </linearGradient>
    <linearGradient id="gGoldBoard" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#C89B54"/>
      <stop offset="50%" stop-color="#F2D59B"/>
      <stop offset="100%" stop-color="#9F7230"/>
    </linearGradient>
    <linearGradient id="gOrange" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB32C"/>
      <stop offset="60%" stop-color="#E8710A"/>
      <stop offset="100%" stop-color="#B84300"/>
    </linearGradient>
    <linearGradient id="gPistachio" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#B8D878"/>
      <stop offset="100%" stop-color="#6E9934"/>
    </linearGradient>
    <linearGradient id="gCream" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFDF7"/>
      <stop offset="100%" stop-color="#EADFB8"/>
    </linearGradient>
  </defs>
  <ellipse cx="100" cy="148" rx="76" ry="16" fill="url(#gPlate)"/>
  ${inner}
</svg>`;

const ART = {
  // 1. Reference Card Left: Molten Chocolate Muffin / Lava Cake with Poured Milk-Chocolate Ganache & Pooled Drops
  cupcake: wrap(`
    <!-- Pooled melted ganache on the plate -->
    <ellipse cx="96" cy="146" rx="34" ry="12" fill="url(#gMilkGanache)"/>
    <path d="M74 143 C84 139 104 139 114 144" stroke="#DDA074" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/>
    <ellipse cx="61" cy="138" rx="9" ry="5" fill="#6E3616"/>
    <ellipse cx="134" cy="137" rx="10" ry="5.5" fill="#6E3616"/>
    <ellipse cx="146" cy="142" rx="6" ry="3.5" fill="#7D401D"/>
    <!-- Textured dark cocoa sponge base -->
    <path d="M58 94 L66 136 C68 142 132 142 134 136 L142 94 Z" fill="url(#gSponge)"/>
    <circle cx="78" cy="116" r="2.2" fill="#2A0E02" opacity="0.6"/>
    <circle cx="96" cy="122" r="2.6" fill="#2A0E02" opacity="0.6"/>
    <circle cx="118" cy="114" r="2.2" fill="#2A0E02" opacity="0.6"/>
    <circle cx="108" cy="126" r="1.8" fill="#8E4A22" opacity="0.5"/>
    <!-- Rounded muffin crown -->
    <path d="M36 92 C34 52 68 32 100 32 C132 32 166 52 164 92 C162 108 138 112 100 112 C62 112 38 108 36 92 Z" fill="url(#gSponge)"/>
    <!-- Thick glossy milk-chocolate ganache poured over top & dripping down -->
    <path d="
      M46 74
      C52 44 76 32 100 32
      C126 32 148 44 154 72
      C156 82 148 88 142 82
      C136 76 132 98 124 98
      C116 98 114 78 106 84
      C98 90 98 118 88 118
      C78 118 80 88 70 86
      C60 84 58 102 50 98
      C42 94 44 82 46 74 Z
    " fill="url(#gMilkGanache)"/>
    <!-- Specular liquid gloss highlights -->
    <path d="M72 44 C88 36 114 36 130 46" stroke="#E7B38C" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
    <path d="M88 58 C88 76 88 96 87 110" stroke="#E7B38C" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
    <path d="M122 56 C124 70 124 82 123 91" stroke="#E7B38C" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  `),

  // 2. Reference Card Right: Mirror-Glaze Dark Chocolate Torte with Candied Orange Slices & Hazelnuts on Gold Board
  cake: wrap(`
    <!-- Gold pastry board -->
    <ellipse cx="100" cy="134" rx="72" ry="22" fill="url(#gGoldBoard)" stroke="#8C6223" stroke-width="1.5"/>
    <!-- Crushed dark chocolate crumble rim at base -->
    <path d="M36 116 C36 132 164 132 164 116 L162 126 C162 144 38 144 38 126 Z" fill="#230C01"/>
    <!-- Mirror-glaze dark chocolate cylinder & dome -->
    <path d="M36 88 C36 68 164 68 164 88 V120 C164 138 36 138 36 120 Z" fill="url(#gDarkChoc)"/>
    <ellipse cx="100" cy="86" rx="64" ry="24" fill="#2A0F02"/>
    <!-- Mirror-glaze white-gold reflection arc -->
    <ellipse cx="114" cy="84" rx="36" ry="12" fill="#FFFDF5" opacity="0.16"/>
    <path d="M46 98 C50 112 76 118 112 116" stroke="#7A3E1B" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
    <!-- Pistachio dust patch -->
    <ellipse cx="122" cy="86" rx="18" ry="7" fill="#6E8C3A" opacity="0.55"/>
    <!-- Candied Orange Slices (top left of torte) -->
    <g transform="rotate(-18 76 66)">
      <circle cx="76" cy="66" r="22" fill="url(#gOrange)" stroke="#F9C851" stroke-width="2.5"/>
      <path d="M76 46 V86 M56 66 H96 M62 52 L90 80 M90 52 L62 80" stroke="#FDE293" stroke-width="1.4" opacity="0.75"/>
    </g>
    <g transform="rotate(12 94 74)">
      <path d="M74 74 A20 20 0 0 1 114 74 Z" fill="url(#gOrange)" stroke="#F9C851" stroke-width="2.2"/>
      <path d="M94 74 L82 60 M94 74 L94 56 M94 74 L106 60" stroke="#FDE293" stroke-width="1.3" opacity="0.75"/>
    </g>
    <!-- Roasted Hazelnuts & White Chocolate Curl -->
    <circle cx="110" cy="74" r="6.5" fill="#F7F2DC"/>
    <circle cx="118" cy="78" r="5.5" fill="#C89B54"/>
    <circle cx="105" cy="80" r="5" fill="#9A6228"/>
  `),

  // 3. Belgian Chocolate Bars, Pralines & Truffles
  chocolate: wrap(`
    <!-- Segmented Belgian Chocolate Bar -->
    <g transform="rotate(-8 86 96)">
      <rect x="30" y="64" width="112" height="62" rx="7" fill="url(#gDarkChoc)" stroke="#7A3B17" stroke-width="1.5"/>
      <rect x="38" y="71" width="28" height="21" rx="3" fill="#4C2007" stroke="#8A4B24" stroke-width="1.2"/>
      <rect x="72" y="71" width="28" height="21" rx="3" fill="#4C2007" stroke="#8A4B24" stroke-width="1.2"/>
      <rect x="106" y="71" width="28" height="21" rx="3" fill="#4C2007" stroke="#8A4B24" stroke-width="1.2"/>
      <rect x="38" y="98" width="28" height="21" rx="3" fill="#3E1805" stroke="#7A3B17" stroke-width="1.2"/>
      <rect x="72" y="98" width="28" height="21" rx="3" fill="#3E1805" stroke="#7A3B17" stroke-width="1.2"/>
      <rect x="106" y="98" width="28" height="21" rx="3" fill="#3E1805" stroke="#7A3B17" stroke-width="1.2"/>
    </g>
    <!-- Pistachio Kunafa Filling Bar Break -->
    <path d="M116 94 L166 78 L174 114 L122 128 Z" fill="url(#gDarkChoc)"/>
    <path d="M118 106 L168 91 L170 101 L120 116 Z" fill="url(#gPistachio)"/>
    <!-- Glossy Truffle Bonbons in foreground -->
    <circle cx="66" cy="134" r="15" fill="url(#gMilkGanache)"/>
    <path d="M58 128 Q66 122 74 128" stroke="#F2D59B" stroke-width="2" stroke-linecap="round"/>
    <circle cx="98" cy="138" r="16" fill="url(#gDarkChoc)"/>
    <path d="M90 132 Q98 125 106 132" stroke="#D88946" stroke-width="2" stroke-linecap="round"/>
    <circle cx="130" cy="134" r="14" fill="url(#gMilkGanache)"/>
  `),

  // 4. Layered Chocolate Fudge Slice
  slice: wrap(`
    <path d="M38 78 L138 42 L162 78 Z" fill="url(#gDarkChoc)"/>
    <path d="M38 78 V132 H162 V78 Z" fill="url(#gSponge)"/>
    <!-- Rich ganache & pistachio cream layers -->
    <rect x="38" y="92" width="124" height="8" fill="#2A0E02"/>
    <rect x="38" y="108" width="124" height="8" fill="url(#gMilkGanache)"/>
    <rect x="38" y="122" width="124" height="5" fill="#2A0E02"/>
    <!-- Glossy top ganache drip -->
    <path d="M38 78 Q48 92 56 78 T74 78 T92 86 T110 78 T128 84 T146 78 T162 78" fill="#240C01"/>
    <!-- Gold-dusted chocolate rosette & berry on top -->
    <circle cx="126" cy="54" r="11" fill="url(#gMilkGanache)"/>
    <circle cx="126" cy="48" r="6" fill="#A81D34"/>
    <circle cx="124" cy="46" r="1.8" fill="#FFB8C4"/>
  `),

  // 5. Fudgy Dark Chocolate Brownie Stack
  brownie: wrap(`
    <path d="M44 96 L100 74 L156 96 L100 118 Z" fill="url(#gDarkChoc)"/>
    <path d="M44 96 V126 L100 146 L156 126 V96 L100 118 Z" fill="url(#gSponge)"/>
    <path d="M56 64 L102 46 L146 64 L100 82 Z" fill="url(#gDarkChoc)"/>
    <path d="M56 64 V90 L100 108 L146 90 V64 L100 82 Z" fill="#3B1704"/>
    <path d="M64 64 Q82 78 100 66 T136 68" stroke="url(#gMilkGanache)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="92" cy="60" r="3" fill="#F2D59B"/>
    <circle cx="110" cy="64" r="2.5" fill="#B8D878"/>
  `),

  // 6. Warm Crepe Drizzled with Belgian Chocolate & Pistachio
  crepe: wrap(`
    <path d="M28 128 L96 42 L172 122 Q100 148 28 128 Z" fill="#E8B974" stroke="#B67B32" stroke-width="2"/>
    <path d="M42 118 L96 50 L158 114" fill="#F4CF92"/>
    <!-- Melted dark chocolate & pistachio ribbons -->
    <path d="M46 112 Q64 92 78 116 T110 108 T142 114" stroke="#341303" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M58 94 Q76 78 90 98 T122 92" stroke="#8A4B24" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M70 78 Q86 66 98 82 T124 78" stroke="url(#gPistachio)" stroke-width="4" stroke-linecap="round"/>
    <!-- Vanilla gelato scoop on top -->
    <circle cx="98" cy="66" r="16" fill="url(#gCream)" stroke="#DFC99B" stroke-width="1.5"/>
    <path d="M88 62 Q98 52 108 64" stroke="#341303" stroke-width="3" stroke-linecap="round"/>
  `),

  // 7. Savory Flurry / Soft-Serve Swirl Cup with Chocolate & Oreo Crumbles
  icecream: wrap(`
    <!-- SAVORY branded cup -->
    <path d="M62 84 H138 L128 144 H72 Z" fill="url(#gDarkChoc)"/>
    <rect x="66" y="102" width="68" height="18" rx="3" fill="#F7F7D3"/>
    <text x="100" y="115" text-anchor="middle" fill="#4C2007" font-family="serif" font-weight="700" font-size="11" letter-spacing="2">SAVORY</text>
    <!-- Soft serve swirl -->
    <path d="M58 84 C58 64 142 64 142 84 Z" fill="url(#gCream)"/>
    <path d="M68 68 C68 50 132 50 132 68 Z" fill="url(#gCream)"/>
    <path d="M80 54 C80 34 120 34 120 54 Z" fill="url(#gCream)"/>
    <!-- Chocolate fudge drizzle & cookie wafer -->
    <path d="M64 78 Q80 90 96 76 T132 80" stroke="#341303" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="122" cy="52" r="12" fill="#240C01" stroke="#5B280D" stroke-width="2"/>
    <rect x="72" y="32" width="10" height="28" rx="3" transform="rotate(-22 72 32)" fill="url(#gMilkGanache)"/>
  `),

  // 8. Thick Chocolate Shake Crowned with Whipped Cream & Cookie
  shake: wrap(`
    <path d="M64 66 H136 L126 144 H74 Z" fill="url(#gMilkGanache)" stroke="#3B1704" stroke-width="2"/>
    <!-- Inside glass chocolate fudge drips -->
    <path d="M68 72 Q78 98 86 78 T104 96 T122 76 T132 92" stroke="#240C01" stroke-width="5" stroke-linecap="round"/>
    <!-- Whipped cream dome -->
    <path d="M58 66 C58 40 142 40 142 66 Z" fill="url(#gCream)"/>
    <path d="M72 48 C72 28 128 28 128 48 Z" fill="url(#gCream)"/>
    <!-- Striped wafer straw & truffle -->
    <line x1="118" y1="18" x2="106" y2="56" stroke="#4C2007" stroke-width="6" stroke-linecap="round"/>
    <circle cx="88" cy="40" r="9" fill="url(#gDarkChoc)"/>
    <path d="M68 62 Q86 72 102 60 T132 64" stroke="#341303" stroke-width="3.5" stroke-linecap="round"/>
  `),

  // 9. Luxury Ribboned SAVORY Gift Box
  gift: wrap(`
    <rect x="42" y="68" width="116" height="72" rx="6" fill="url(#gDarkChoc)" stroke="#8A4B24" stroke-width="1.5"/>
    <rect x="36" y="52" width="128" height="22" rx="4" fill="#4C2007" stroke="#C89B54" stroke-width="1.5"/>
    <!-- Gold satin ribbon & bow -->
    <rect x="92" y="52" width="16" height="88" fill="url(#gGoldBoard)"/>
    <rect x="42" y="96" width="116" height="14" fill="url(#gGoldBoard)"/>
    <path d="M100 52 C80 26 56 34 66 48 C72 56 90 54 100 52 Z" fill="url(#gGoldBoard)" stroke="#9F7230" stroke-width="1.5"/>
    <path d="M100 52 C120 26 144 34 134 48 C128 56 110 54 100 52 Z" fill="url(#gGoldBoard)" stroke="#9F7230" stroke-width="1.5"/>
  `),

  // 10. Hot Melted Belgian Chocolate Cup
  cup: wrap(`
    <ellipse cx="100" cy="138" rx="58" ry="12" fill="#FFFDF5" stroke="#D5C8A0" stroke-width="2"/>
    <path d="M56 72 H136 V104 A36 34 0 0 1 100 136 H92 A36 34 0 0 1 56 104 Z" fill="url(#gDarkChoc)"/>
    <path d="M136 80 H146 A12 12 0 0 1 146 106 H134" stroke="#4C2007" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="96" cy="72" rx="40" ry="10" fill="url(#gMilkGanache)" stroke="#F7F7D3" stroke-width="2"/>
    <path d="M78 72 Q96 64 114 72" stroke="#FFFDF5" stroke-width="3" stroke-linecap="round"/>
    <path d="M82 48 C76 38 88 30 82 20 M100 44 C94 34 106 26 100 16 M116 48 C110 38 122 30 116 20" stroke="#8A4B24" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
  `),

  // 11. Chocolate Chip & Chunk Cookie
  cookie: wrap(`
    <ellipse cx="104" cy="102" rx="52" ry="38" fill="#C68B46" stroke="#8F5B1E" stroke-width="2"/>
    <ellipse cx="92" cy="92" rx="52" ry="38" fill="#DCA15B" stroke="#9E6624" stroke-width="2"/>
    <circle cx="72" cy="82" r="7" fill="url(#gDarkChoc)"/>
    <circle cx="98" cy="76" r="8" fill="url(#gDarkChoc)"/>
    <circle cx="116" cy="94" r="7.5" fill="url(#gDarkChoc)"/>
    <circle cx="84" cy="104" r="8.5" fill="url(#gDarkChoc)"/>
    <circle cx="64" cy="100" r="6" fill="#4C2007"/>
    <circle cx="106" cy="110" r="6" fill="#4C2007"/>
  `),

  // 12. Chocolate Glazed Éclair
  eclair: wrap(`
    <rect x="30" y="76" width="140" height="44" rx="22" fill="#DDA45B" stroke="#A66D28" stroke-width="2"/>
    <path d="M34 90 C34 72 166 72 166 90 C156 98 144 96 132 92 C120 88 110 98 100 94 C90 90 78 98 66 92 C54 86 44 98 34 90 Z" fill="url(#gDarkChoc)"/>
    <path d="M48 84 Q62 76 76 86 T104 84 T132 86 T152 84" stroke="url(#gGoldBoard)" stroke-width="2.5" stroke-linecap="round"/>
  `),

  // 13. Smoked & Roasted Mixed Nuts Bowl
  nuts: wrap(`
    <ellipse cx="76" cy="82" rx="16" ry="10" transform="rotate(-18 76 82)" fill="#B56E33"/>
    <ellipse cx="102" cy="78" rx="16" ry="11" fill="url(#gPistachio)"/>
    <ellipse cx="126" cy="84" rx="15" ry="10" transform="rotate(18 126 84)" fill="#D89B56"/>
    <ellipse cx="90" cy="88" rx="14" ry="9" fill="#8A4B24"/>
    <ellipse cx="114" cy="88" rx="14" ry="9" fill="#C89B54"/>
    <path d="M44 88 H156 Q150 142 100 142 Q50 142 44 88 Z" fill="url(#gDarkChoc)" stroke="#C89B54" stroke-width="2"/>
    <path d="M44 96 H156" stroke="url(#gGoldBoard)" stroke-width="2"/>
  `),
};

ART.macaron = ART.chocolate;
ART.donut = ART.cupcake;
ART.croissant = ART.eclair;
ART.tart = ART.cake;
ART.cloche = ART.cake;
ART.crescent = ART.gift;

const RULES = [
  [/\b(lava|muffins?|cupcakes?|molten)\b/i, 'cupcake'],
  [/\b(torte|mirror|orange|gateaux?|cakes?)\b/i, 'cake'],
  [/\b(milkshakes?|shakes?|freakshakes?|frapp[eé]s?|smoothies?)\b/i, 'shake'],
  [/\b(crepes?|crêpes?|pancakes?|waffles?)\b/i, 'crepe'],
  [/\bflurr(y|ies)\b/i, 'icecream'],
  [/\b(bark|pralines?|truffles?|bonbons?|chocolates?|kunafa)\b/i, 'chocolate'],
  [/\b(coffee|latte|tea|hot chocolate|cocoa|drinks?|espresso|mocha)\b/i, 'cup'],
  [/[ée]clairs?/i, 'eclair'],
  [/\b(cookies?|biscuits?)\b/i, 'cookie'],
  [/\bslices?\b/i, 'slice'],
  [/\b(brownies?|blondies?|fudge)\b/i, 'brownie'],
  [/\b(ice ?creams?|gelato|sorbet)\b/i, 'icecream'],
  [/\b(nuts|almonds?|pistachios?|cashews?|hazelnuts?)\b/i, 'nuts'],
  [/\b(favou?rs?|gifts?|boxes|box|weddings?)\b/i, 'gift'],
];

export const art = (name) => ART[name] || ART.chocolate;

export function illustrationFor(item) {
  for (const text of [item?.name, item?.category]) {
    const rule = RULES.find(([pattern]) => pattern.test(text || ''));
    if (rule) return ART[rule[1]];
  }
  return ART.chocolate;
}
