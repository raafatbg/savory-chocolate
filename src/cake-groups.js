// The steps of the cake builder. Options inside each group are managed by the admin;
// the groups themselves are fixed because the 3D preview knows how to draw them.
//
// mode:   'single' = pick one (required when the group has options), 'multi' = pick any.
// color:  options carry a hex color the 3D cake uses.
// visuals: allowed values for an option's `visual` key, i.e. what the 3D cake draws for it.
export const CAKE_GROUPS = [
  { key: 'shape', label: 'Shape', mode: 'single', visuals: ['round', 'square', 'heart'] },
  { key: 'size', label: 'Size', mode: 'single', hint: 'The price of a size is the starting price of the cake.' },
  { key: 'tiers', label: 'Tiers', mode: 'single', visuals: ['1', '2', '3'] },
  { key: 'flavor', label: 'Cake flavor', mode: 'single' },
  { key: 'filling', label: 'Filling', mode: 'single' },
  { key: 'frosting', label: 'Frosting', mode: 'single' },
  { key: 'color', label: 'Frosting color', mode: 'single', color: true },
  { key: 'drip', label: 'Drip', mode: 'single', color: true, visuals: ['', 'metallic'], hint: 'Leave the color empty for "no drip".' },
  { key: 'toppings', label: 'Toppings', mode: 'multi', visuals: ['', 'berries', 'macarons', 'shards', 'goldleaf', 'sprinkles', 'flowers', 'cherries'] },
  { key: 'extras', label: 'Extras', mode: 'multi', visuals: ['', 'candles', 'topper', 'sparklers'] },
  { key: 'dietary', label: 'Dietary needs', mode: 'multi' },
];

export const CAKE_GROUP_KEYS = CAKE_GROUPS.map((g) => g.key);

// An add-on's price for the chosen size: its base price times the size's multiplier, rounded to
// the nearest 0.50. public/js/cakes.js uses the same formula to show prices, so keep them in sync.
export function scaledPrice(cents, scale) {
  if (!cents || scale === 1) return cents;
  return Math.round((cents * scale) / 50) * 50;
}

// Starter options, added the first time a group is empty.
export const CAKE_SEEDS = {
  shape: [
    ['Round', 'The classic', 0, '', 'round'],
    ['Square', 'Clean, modern edges', 500, '', 'square'],
    ['Heart', 'For someone special', 1000, '', 'heart'],
  ],
  tiers: [
    ['Single tier', '', 0, '', '1'],
    ['Two tiers', 'A showstopper', 4500, '', '2'],
    ['Three tiers', 'For big celebrations', 9500, '', '3'],
  ],
  color: [
    ['Ivory', '', 0, '#f3e6d3', ''],
    ['Blush pink', '', 0, '#f1c1c4', ''],
    ['Chocolate', '', 0, '#5a3423', ''],
    ['Powder blue', '', 0, '#bcd6ea', ''],
    ['Sage', '', 0, '#b9c9a7', ''],
    ['Lavender', '', 0, '#cdbde6', ''],
    ['Midnight', 'Deep black finish', 500, '#1f1a1a', ''],
  ],
  drip: [
    ['No drip', '', 0, '', ''],
    ['Dark chocolate', '', 500, '#2b160d', ''],
    ['Salted caramel', '', 500, '#b8742e', ''],
    ['White chocolate', '', 500, '#f4ead8', ''],
    ['Gold', 'Edible gold shimmer', 900, '#d4a75a', 'metallic'],
  ],
  toppings: [
    ['Fresh berries', 'Raspberries, blueberries and mint', 800, '', 'berries'],
    ['French macarons', '', 1200, '', 'macarons'],
    ['Chocolate shards', '', 500, '', 'shards'],
    ['Gold leaf', '', 1000, '', 'goldleaf'],
    ['Sprinkles', '', 300, '', 'sprinkles'],
    ['Edible flowers', '', 900, '', 'flowers'],
    ['Cherries', '', 600, '', 'cherries'],
  ],
  extras: [
    ['Birthday candles', '', 300, '', 'candles'],
    ['Gold cake topper', '"Happy Birthday" in gold', 1500, '', 'topper'],
    ['Sparkler candles', '', 600, '', 'sparklers'],
    ['Gift box & ribbon', '', 500, '', ''],
  ],
  dietary: [
    ['Vegan', '', 1000, '', ''],
    ['Gluten-free', '', 800, '', ''],
    ['Nut-free', '', 0, '', ''],
    ['Eggless', '', 500, '', ''],
  ],
};
