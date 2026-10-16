// A short burst of gold confetti from both sides of the screen, for celebrations.
export function confetti({ count = 180, duration = 3200 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:300';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#f6e1a8', '#d9b066', '#b0843f', '#f5ebde', '#e8a9a6', '#fff4d6'];
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const speed = 650 + Math.random() * 650;
    return {
      x: left ? -10 : w + 10,
      y: h * (0.65 + Math.random() * 0.2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      size: 6 + Math.random() * 7,
      color: colors[i % colors.length],
      round: Math.random() < 0.25,
      wobble: Math.random() * Math.PI * 2,
    };
  });

  const start = performance.now();
  let last = start;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const fade = Math.max(0, 1 - (now - start - duration * 0.7) / (duration * 0.3));
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      p.vy += 1100 * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.wobble += dt * 8;
      p.x += (p.vx + Math.sin(p.wobble) * 40) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.wobble)) + 1);
      }
      ctx.restore();
    }
    if (now - start < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
  // Animation frames pause in background tabs, so make sure the overlay always goes away.
  setTimeout(() => canvas.remove(), duration + 1000);
}
