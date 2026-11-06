import '/js/common.js';
import { createCakeStage } from '/js/cake3d.js';

createCakeStage(document.getElementById('about-stage'), { sparkles: true })?.setCake({
  shape: 'round',
  tiers: 2,
  tierColors: ['#3a2016', '#efe0c9'],
  drip: '#d4a75a',
  dripMetallic: true,
  toppings: ['macarons', 'goldleaf'],
}, { intro: true });
