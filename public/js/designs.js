// Ready-made cake designs shown on the home page and gallery. "Customize" opens the builder with these picks.
// `picks` match builder options by their 3D look (shape, tiers, toppings, extras) or color (frosting, drip),
// so they keep working if the admin renames or reprices options.
export const SIGNATURE_DESIGNS = [
  {
    id: 'classic',
    name: 'The Classic Ganache',
    category: 'chocolate',
    description: 'Ivory buttercream, a dark Belgian ganache drip, fresh berries and 24k gold leaf.',
    cake: { shape: 'round', tiers: 2, color: '#f3e6d3', drip: '#2b160d', toppings: ['berries', 'goldleaf'] },
    picks: { shape: 'round', tiers: '2', color: '#f3e6d3', drip: '#2b160d', toppings: ['berries', 'goldleaf'], extras: [] },
  },
  {
    id: 'rose',
    name: 'Rose Garden Heart',
    category: 'romance',
    description: 'A blush two-tier heart with a white chocolate drip, edible flowers and Parisian macarons.',
    cake: { shape: 'heart', tiers: 2, color: '#f1c1c4', drip: '#f4ead8', toppings: ['flowers', 'macarons'] },
    picks: { shape: 'heart', tiers: '2', color: '#f1c1c4', drip: '#f4ead8', toppings: ['flowers', 'macarons'], extras: [] },
  },
  {
    id: 'midnight',
    name: 'Midnight Gold Grand',
    category: 'wedding',
    description: 'Three dramatic dark cocoa tiers, a metallic gold drip, chocolate shards and party sparklers.',
    cake: { shape: 'round', tiers: 3, color: '#1f1a1a', drip: '#d4a75a', dripMetallic: true, toppings: ['goldleaf', 'shards'], extras: ['sparklers'] },
    picks: { shape: 'round', tiers: '3', color: '#1f1a1a', drip: '#d4a75a', toppings: ['goldleaf', 'shards'], extras: ['sparklers'] },
  },
  {
    id: 'birthday',
    name: 'Birthday Bliss Square',
    category: 'celebration',
    description: 'Powder blue buttercream with salted caramel drip, confetti sprinkles, candles and gold topper.',
    cake: { shape: 'square', tiers: 1, color: '#bcd6ea', drip: '#b8742e', toppings: ['sprinkles'], extras: ['candles', 'topper'] },
    picks: { shape: 'square', tiers: '1', color: '#bcd6ea', drip: '#b8742e', toppings: ['sprinkles'], extras: ['candles', 'topper'] },
  },
  {
    id: 'pistachio',
    name: 'Pistachio Kunafa Royale',
    category: 'chocolate',
    description: 'Roasted pistachio cream tiers crowned with dark Belgian ganache drip, macarons and gold leaf.',
    cake: { shape: 'round', tiers: 2, color: '#c8ddb0', drip: '#2b160d', toppings: ['macarons', 'goldleaf'] },
    picks: { shape: 'round', tiers: '2', color: '#c8ddb0', drip: '#2b160d', toppings: ['macarons', 'goldleaf'], extras: ['topper'] },
  },
  {
    id: 'imperial',
    name: 'Imperial Ivory Wedding',
    category: 'wedding',
    description: 'Three cascading tiers of warm ivory buttercream adorned with fresh berries, florals and gold drip.',
    cake: { shape: 'round', tiers: 3, color: '#f3e6d3', drip: '#d4a75a', dripMetallic: true, toppings: ['flowers', 'berries'] },
    picks: { shape: 'round', tiers: '3', color: '#f3e6d3', drip: '#d4a75a', toppings: ['flowers', 'berries'], extras: [] },
  },
];
