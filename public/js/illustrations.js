// Gold line-art drawings used when a menu item has no photo. Picked from the item's name, then its category.

const svg = (inner) => `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const SOFT = 'fill="currentColor" fill-opacity=".12"';
const DOTS = 'fill="currentColor" fill-opacity=".55" stroke="none"';

const ART = {
  cup: svg(`
    <path ${SOFT} d="M28 50 H86 V70 a22 22 0 0 1 -22 22 H50 a22 22 0 0 1 -22 -22 Z"/>
    <path d="M86 56 h5 a10 10 0 0 1 0 20 h-7"/>
    <path d="M18 100 h80"/>
    <path d="M46 20 c-5 6 5 11 0 18 M58 15 c-5 6 5 11 0 18 M70 20 c-5 6 5 11 0 18" opacity=".7"/>`),
  cupcake: svg(`
    <path ${SOFT} d="M34 66 H86 L80 98 H40 Z"/>
    <path d="M47 66 L50 98 M60 66 V98 M73 66 L70 98" opacity=".5"/>
    <path ${SOFT} d="M28 66 c0 -14 64 -14 64 0 Z"/>
    <path d="M38 55 c0 -12 44 -12 44 0"/>
    <path d="M48 45 c0 -10 24 -10 24 0"/>
    <circle cx="60" cy="31" r="5" ${SOFT}/>
    <path d="M60 26 c1 -5 4 -8 9 -9"/>`),
  macaron: svg(`
    <path ${SOFT} d="M22 56 c0 -20 76 -20 76 0 Z"/>
    <path d="M22 56 h76"/>
    <path d="M24 62 h72" opacity=".55"/>
    <path ${SOFT} d="M22 68 c0 20 76 20 76 0 Z"/>
    <path d="M22 68 h76"/>
    <path d="M26 56 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3 M86 56 l3 3 l3 -3" opacity=".45"/>`),
  donut: svg(`
    <circle cx="60" cy="62" r="36" ${SOFT}/>
    <circle cx="60" cy="62" r="11"/>
    <path d="M26 54 c6 -20 34 -30 54 -20 c12 6 16 16 14 24 c-6 4 -9 -2 -15 2 c-6 4 -10 -4 -17 0 c-7 4 -11 -4 -17 0 c-6 4 -10 -3 -14 -6"/>
    <path d="M44 40 l4 -2 M66 36 l3 3 M80 48 l2 4 M38 52 l3 2" opacity=".7"/>`),
  croissant: svg(`
    <path ${SOFT} d="M14 76 C20 40 100 40 106 76 C96 66 86 64 78 68 C72 56 48 56 42 68 C34 64 24 66 14 76 Z"/>
    <path d="M42 68 L48 47 M78 68 L72 47 M60 61 V43" opacity=".6"/>
    <path d="M10 96 h100" opacity=".5"/>`),
  cookie: svg(`
    <circle cx="60" cy="60" r="36" ${SOFT}/>
    <path d="M36 36 a34 34 0 0 0 -8 12" opacity=".5"/>
    <g ${DOTS}>
      <ellipse cx="48" cy="48" rx="5" ry="4"/><ellipse cx="71" cy="43" rx="4" ry="3.5"/>
      <ellipse cx="75" cy="68" rx="5" ry="4"/><ellipse cx="50" cy="74" rx="4" ry="3.5"/>
      <ellipse cx="61" cy="59" rx="3" ry="2.5"/><ellipse cx="86" cy="54" rx="3" ry="2.5"/>
      <ellipse cx="36" cy="60" rx="3" ry="2.5"/>
    </g>`),
  slice: svg(`
    <path ${SOFT} d="M16 62 L86 38 L104 62 Z"/>
    <path d="M16 62 V92 H104 V62"/>
    <path d="M16 74 H104 M16 83 H104" opacity=".5"/>
    <path d="M16 66 q5.5 6 11 0 t11 0 t11 0 t11 0 t11 0 t11 0 t11 0 t11 0" opacity=".85"/>
    <circle cx="74" cy="44" r="5" ${SOFT}/>
    <path d="M74 39 c1 -6 5 -9 10 -10"/>
    <path d="M8 98 H112"/>`),
  brownie: svg(`
    <path ${SOFT} d="M20 56 L60 40 L100 56 L60 72 Z"/>
    <path d="M20 56 V78 L60 94 L100 78 V56"/>
    <path d="M60 72 V94"/>
    <path d="M30 52 l6 3 M46 46 l5 2 M70 47 l6 3 M84 53 l5 2 M56 52 l6 2" opacity=".55"/>
    <path d="M12 102 h96" opacity=".5"/>`),
  tart: svg(`
    <path ${SOFT} d="M18 66 H102 L94 86 H26 Z"/>
    <path d="M18 66 c4 -4 8 4 12 0 s8 4 12 0 s8 4 12 0 s8 4 12 0 s8 4 12 0 s8 4 12 0 s8 4 12 0"/>
    <circle cx="42" cy="58" r="6" ${SOFT}/><circle cx="58" cy="55" r="6" ${SOFT}/><circle cx="74" cy="58" r="6" ${SOFT}/>
    <circle cx="50" cy="47" r="5" ${SOFT}/><circle cx="66" cy="47" r="5" ${SOFT}/>
    <path d="M12 96 h96" opacity=".5"/>`),
  cake: svg(`
    <path ${SOFT} d="M22 64 H98 V94 H22 Z"/>
    <path ${SOFT} d="M36 40 H84 V64 H36 Z"/>
    <path d="M22 68 q4.75 6 9.5 0 t9.5 0 t9.5 0 t9.5 0 t9.5 0 t9.5 0 t9.5 0 t9.5 0" opacity=".8"/>
    <path d="M36 44 q4 5 8 0 t8 0 t8 0 t8 0 t8 0 t8 0" opacity=".8"/>
    <path d="M60 26 v14"/>
    <path d="M60 18 c3 3 3 6 0 7.5 c-3 -1.5 -3 -4.5 0 -7.5 z" ${SOFT}/>
    <path d="M12 100 H108"/>`),
  cloche: svg(`
    <path ${SOFT} d="M22 82 a38 38 0 0 1 76 0 Z"/>
    <path d="M14 82 H106"/>
    <path d="M24 90 H96" opacity=".5"/>
    <circle cx="60" cy="40" r="4"/>
    <path d="M40 64 a24 24 0 0 1 14 -14" opacity=".55"/>`),
  chocolate: svg(`
    <path ${SOFT} d="M16 64 H104 V94 H16 Z"/>
    <path d="M16 72 H104" opacity=".5"/>
    <circle cx="36" cy="54" r="11" ${SOFT}/><circle cx="60" cy="51" r="12" ${SOFT}/><circle cx="84" cy="54" r="11" ${SOFT}/>
    <path d="M30 51 q6 -5 12 0 M53 47 q7 -6 14 0 M78 51 q6 -5 12 0" opacity=".7"/>
    <path d="M28 82 h12 M54 82 h12 M80 82 h12" opacity=".5"/>`),
  icecream: svg(`
    <path ${SOFT} d="M42 62 L60 106 L78 62 Z"/>
    <path d="M47 72 L70 66 M51 82 L74 74 M55 92 L72 86" opacity=".5"/>
    <circle cx="60" cy="50" r="19" ${SOFT}/>
    <circle cx="60" cy="26" r="13" ${SOFT}/>
    <path d="M42 58 q4 6 8 0 t8 0 t8 0 t8 0 t5 0" opacity=".8"/>
    <circle cx="66" cy="14" r="3.5" ${SOFT}/>`),
  eclair: svg(`
    <rect x="14" y="56" width="92" height="28" rx="14" ${SOFT}/>
    <path d="M18 64 q42 -12 84 0 q-6 8 -12 4 q-6 -4 -12 3 q-6 6 -12 0 q-6 -6 -12 1 q-6 6 -12 0 q-6 -5 -12 2 q-6 5 -12 -2 Z" ${SOFT}/>
    <path d="M30 60 l6 -4 M50 57 l6 -4 M70 57 l6 -4" opacity=".6"/>
    <path d="M8 96 H112" opacity=".5"/>`),
  nuts: svg(`
    <path ${SOFT} d="M16 62 H104 Q100 104 60 104 Q20 104 16 62 Z"/>
    <path d="M16 62 H104"/>
    <ellipse cx="38" cy="52" rx="10" ry="7" transform="rotate(-20 38 52)" ${SOFT}/>
    <ellipse cx="60" cy="48" rx="11" ry="8" ${SOFT}/>
    <ellipse cx="82" cy="52" rx="10" ry="7" transform="rotate(20 82 52)" ${SOFT}/>
    <path d="M55 48 q5 -3 10 0" opacity=".6"/>
    <path d="M48 40 q4 -6 10 -4" opacity=".5"/>`),
  gift: svg(`
    <path ${SOFT} d="M24 56 H96 V100 H24 Z"/>
    <path ${SOFT} d="M18 42 H102 V56 H18 Z"/>
    <path d="M60 42 V100"/>
    <path d="M60 42 c-8 -14 -28 -14 -24 -2 c3 6 16 4 24 2 z M60 42 c8 -14 28 -14 24 -2 c-3 6 -16 4 -24 2 z"/>
    <path d="M30 66 h20 M30 74 h14" opacity=".45"/>`),
  crescent: svg(`
    <path ${SOFT} d="M70 18 a38 38 0 1 0 26 66 a30 30 0 1 1 -26 -66 Z"/>
    <path d="M84 34 l2.5 5.5 6 .8 -4.4 4.1 1.1 5.9 -5.2 -2.9 -5.2 2.9 1.1 -5.9 -4.4 -4.1 6 -.8 z" ${SOFT}/>
    <path d="M28 104 h48" opacity=".5"/>`),
};

const RULES = [
  [/\b(coffee|latte|tea|hot chocolate|cocoa|drinks?|juice|espresso|cappuccino|mocha|shakes?|smoothie|lemonade)\b/i, 'cup'],
  [/\b(cupcakes?|muffins?)\b/i, 'cupcake'],
  [/\bmacarons?\b/i, 'macaron'],
  [/\b(donuts?|doughnuts?)\b/i, 'donut'],
  [/[ée]clairs?/i, 'eclair'],
  [/\b(croissants?|pastry|pastries|danish|pain au)\b/i, 'croissant'],
  [/\b(cookies?|biscuits?)\b/i, 'cookie'],
  [/\bslices?\b/i, 'slice'],
  [/\b(brownies?|blondies?|fudge|bars?|bakes?)\b/i, 'brownie'],
  [/\b(tarts?|pies?|tartlets?)\b/i, 'tart'],
  [/\b(ice ?creams?|gelato|sorbet)\b/i, 'icecream'],
  [/\b(nuts|almonds?|pistachios?|cashews?|hazelnuts?)\b/i, 'nuts'],
  [/\b(favou?rs?|gifts?|weddings?|baby)\b/i, 'gift'],
  [/\b(ramadan|eid|ma'?amoul|baklava|arabic)\b/i, 'crescent'],
  [/\b(cakes?|gateaux?|torte)\b/i, 'cake'],
  [/\b(chocolates?|pralines?|truffles?|bonbons?)\b/i, 'chocolate'],
];

// A drawing by name, e.g. art('icecream').
export const art = (name) => ART[name] || ART.cloche;

export function illustrationFor(item) {
  for (const text of [item.name, item.category]) {
    const rule = RULES.find(([pattern]) => pattern.test(text || ''));
    if (rule) return ART[rule[1]];
  }
  return ART.cloche;
}
