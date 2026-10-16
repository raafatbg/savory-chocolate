// Ready-made cake designs shown on the home page. "Customize" opens the builder with these picks.
// `picks` match builder options by their 3D look (shape, tiers, toppings, extras) or color (frosting, drip),
// so they keep working if the admin renames or reprices options.
export const SIGNATURE_DESIGNS = [
  {
    id: 'classic',
    name: 'The Classic',
    description: 'Ivory buttercream, a dark ganache drip, fresh berries and gold leaf.',
    cake: { shape: 'round', tiers: 2, color: '#f3e6d3', drip: '#2b160d', toppings: ['berries', 'goldleaf'] },
    picks: { shape: 'round', tiers: '2', color: '#f3e6d3', drip: '#2b160d', toppings: ['berries', 'goldleaf'], extras: [] },
  },
  {
    id: 'rose',
    name: 'Rose Garden',
    description: 'A blush heart with a white chocolate drip, edible flowers and macarons.',
    cake: { shape: 'heart', tiers: 2, color: '#f1c1c4', drip: '#f4ead8', toppings: ['flowers', 'macarons'] },
    picks: { shape: 'heart', tiers: '2', color: '#f1c1c4', drip: '#f4ead8', toppings: ['flowers', 'macarons'], extras: [] },
  },
  {
    id: 'midnight',
    name: 'Midnight Gold',
    description: 'Three dramatic black tiers, a gold drip, chocolate shards and sparklers.',
    cake: { shape: 'round', tiers: 3, color: '#1f1a1a', drip: '#d4a75a', dripMetallic: true, toppings: ['goldleaf', 'shards'], extras: ['sparklers'] },
    picks: { shape: 'round', tiers: '3', color: '#1f1a1a', drip: '#d4a75a', toppings: ['goldleaf', 'shards'], extras: ['sparklers'] },
  },
  {
    id: 'birthday',
    name: 'Birthday Bliss',
    description: 'Powder blue with salted caramel, sprinkles, candles and a gold topper.',
    cake: { shape: 'square', tiers: 1, color: '#bcd6ea', drip: '#b8742e', toppings: ['sprinkles'], extras: ['candles', 'topper'] },
    picks: { shape: 'square', tiers: '1', color: '#bcd6ea', drip: '#b8742e', toppings: ['sprinkles'], extras: ['candles', 'topper'] },
  },
];
