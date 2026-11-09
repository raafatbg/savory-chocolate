// Web Audio API Synthesizer for SAVORY Luxury Sound Haptics & Kitchen Order Bell.
// 100% synthesized in-browser: zero external assets, instant response, zero latency, works offline.

const SOUND_STORAGE_KEY = 'sc_sound_enabled_v1';
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled() {
  try {
    const val = localStorage.getItem(SOUND_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(Boolean(enabled)));
    document.querySelectorAll('[data-sound-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(enabled));
      btn.classList.toggle('muted', !enabled);
      const label = btn.querySelector('.sound-label');
      if (label) label.textContent = enabled ? 'Sound On' : 'Sound Off';
    });
  } catch {}
}

export function toggleSound() {
  const next = !isSoundEnabled();
  setSoundEnabled(next);
  if (next) playPop();
  return next;
}

// 1. Soft Luxury Click (Option & Swatch selection)
export function playClick() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(620, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

// 2. Silky Knife Slice (3D Cut-a-slice)
export function playSlice() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Bandpassed noise burst for realistic cake blade glide
  const bufferSize = ctx.sampleRate * 0.18;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(320, now + 0.18);
  filter.Q.value = 3.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.19);
}

// 3. Magical Birthday Candle Wish (Spark & Ethereal Warmth)
export function playWish() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [528, 660, 792, 1056]; // Healing C/E/G/C harmonic chime

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.08, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.85);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.9);
  });
}

// 4. Gourmet Marimba Pop (Add to cart / Truffle placement)
export function playPop() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

// 5. Celebration Major Fanfare Chime (Order Confirmed with Confetti)
export function playCelebration() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { f: 523.25, t: 0.0 },   // C5
    { f: 659.25, t: 0.08 },  // E5
    { f: 783.99, t: 0.16 },  // G5
    { f: 1046.5, t: 0.24 },  // C6
    { f: 1318.5, t: 0.32 },  // E6
  ];

  notes.forEach(({ f, t }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + t);

    gain.gain.setValueAtTime(0.14, now + t);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + t);
    osc.stop(now + t + 0.95);
  });
}

// 6. Executive Brass Kitchen Order Bell (Admin New Order Alert)
export function playKitchenChime() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const strikes = [0, 0.14];

  strikes.forEach((delay) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now + delay); // High brass ding
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2093.0, now + delay); // Overtone sparkle

    gain.gain.setValueAtTime(0.24, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now + delay);
    osc2.start(now + delay);
    osc1.stop(now + delay + 1.25);
    osc2.stop(now + delay + 1.25);
  });
}

// Auto-initialize audio context on first user tap/click to comply with browser autoplay policies
if (typeof window !== 'undefined') {
  const resume = () => {
    getAudioContext();
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
}
