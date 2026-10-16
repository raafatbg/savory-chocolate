// Generates public/img/cake.svg, the layered-cake illustration on the home page.
// Run with: node scripts/make-cake-art.mjs
import fs from 'node:fs';

const C = {
  plate: '#eadfd3',
  plateEdge: '#d9c9b8',
  cocoa: '#5a3726',
  ganache: '#341d13',
  blush: '#f2d3c6',
  caramel: '#c27c3a',
  cream: '#fbf6ef',
  berry: '#b5475b',
  leaf: '#5f7f4b',
};

// A tier is a rounded block with a band of icing on top and drips hanging off it.
function tier({ x, y, w, h, body, icing, drips }) {
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${body}"/>`,
    `<path d="M${x} ${y + 16} V${y + 12} Q${x} ${y} ${x + 12} ${y} H${x + w - 12} Q${x + w} ${y} ${x + w} ${y + 12} V${y + 16} Z" fill="${icing}"/>`,
  ];
  for (const [dx, len] of drips) {
    const cx = x + dx;
    parts.push(`<rect x="${cx - 6}" y="${y + 8}" width="12" height="${len}" rx="6" fill="${icing}"/>`);
  }
  return parts.join('\n    ');
}

function dots(xs, y, r, fill) {
  return xs.map((x) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('\n    ');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 340" role="img" aria-label="Illustration of a three-tier chocolate cake">
  <g>
    <ellipse cx="180" cy="312" rx="158" ry="18" fill="${C.plateEdge}"/>
    <ellipse cx="180" cy="306" rx="158" ry="16" fill="${C.plate}"/>
  </g>
  <g>
    ${tier({ x: 44, y: 206, w: 272, h: 100, body: C.cocoa, icing: C.ganache, drips: [[18, 26], [44, 40], [70, 22], [98, 34], [126, 18], [152, 44], [180, 24], [206, 36], [232, 20], [256, 30]] })}
    ${dots([72, 112, 152, 192, 232, 272], 284, 4, C.blush)}
  </g>
  <g>
    ${tier({ x: 82, y: 124, w: 196, h: 86, body: C.blush, icing: C.caramel, drips: [[16, 22], [40, 34], [66, 18], [92, 30], [118, 20], [142, 36], [168, 24]] })}
    ${dots([112, 146, 180, 214, 248], 192, 3.5, C.cream)}
  </g>
  <g>
    ${tier({ x: 118, y: 58, w: 124, h: 70, body: C.cocoa, icing: C.ganache, drips: [[16, 20], [38, 30], [62, 16], [86, 26], [108, 18]] })}
  </g>
  <g>
    <path d="M180 38 q4 -14 16 -18" stroke="${C.leaf}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="180" cy="46" r="14" fill="${C.berry}"/>
    <circle cx="175" cy="41" r="4" fill="#ffffff" opacity="0.35"/>
  </g>
</svg>
`;

fs.mkdirSync('public/img', { recursive: true });
fs.writeFileSync('public/img/cake.svg', svg);
console.log('wrote public/img/cake.svg');
