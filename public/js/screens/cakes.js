import {
  api, esc, money, isoDate, friendlyDate, loadSettings, setupFulfillment, deliveryFee,
  setupBranches, orderConfirmation, openWhatsApp,
} from '/js/common.js';
import { createCakeStage, renderCakeSnapshot, releaseSnapshots, drawSavoryPod } from '/js/cake3d.js';
import { SIGNATURE_DESIGNS } from '/js/designs.js';
import { confetti } from '/js/confetti.js';
import { playClick, playSlice, playWish, playPop, playCelebration, toggleSound } from '/js/audio.js';

const SHAPE_ICONS = {
  round: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="20" cy="13" rx="14" ry="5"/><path d="M6 13v14c0 2.8 6.3 5 14 5s14-2.2 14-5V13"/></svg>',
  square: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 14l14-6 14 6-14 6z"/><path d="M6 14v13l14 6 14-6V14M20 20v13"/></svg>',
  heart: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 33S6 24.5 6 15a7 7 0 0 1 14-1.5A7 7 0 0 1 34 15c0 9.5-14 18-14 18z"/></svg>',
};
const TIER_ICONS = {
  1: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="20" width="26" height="12" rx="2"/></svg>',
  2: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="22" width="28" height="11" rx="2"/><rect x="11" y="12" width="18" height="10" rx="2"/></svg>',
  3: '<svg class="icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="25" width="30" height="9" rx="2"/><rect x="10" y="16" width="20" height="9" rx="2"/><rect x="14" y="7" width="12" height="9" rx="2"/></svg>',
};

// Realistic interior sponge & filling colors for the 3D "Cut a slice" cross-section
function inferSpongeColor(option) {
  if (option?.color) return option.color;
  const n = (option?.name || '').toLowerCase();
  if (n.includes('red velvet')) return '#8f1d28';
  if (n.includes('pistachio')) return '#a9c77e';
  if (n.includes('lemon')) return '#f5e290';
  if (n.includes('strawberry') || n.includes('berry')) return '#efb4bd';
  if (n.includes('lotus') || n.includes('caramel') || n.includes('speculoos')) return '#c28346';
  if (n.includes('vanilla') || n.includes('funfetti') || n.includes('almond')) return '#f3dfba';
  if (n.includes('marble')) return '#6e4226';
  return '#3d1e10'; // Rich dark chocolate sponge default
}

function inferFillingColor(option) {
  if (option?.color) return option.color;
  const n = (option?.name || '').toLowerCase();
  if (n.includes('pistachio')) return '#96bc61';
  if (n.includes('berry') || n.includes('raspberry') || n.includes('strawberry') || n.includes('cherry')) return '#8c1832';
  if (n.includes('caramel') || n.includes('lotus') || n.includes('biscoff')) return '#c67d2d';
  if (n.includes('cream cheese') || n.includes('vanilla') || n.includes('white')) return '#faf2e3';
  if (n.includes('lemon') || n.includes('passion')) return '#f2cf5b';
  if (n.includes('nutella') || n.includes('hazelnut') || n.includes('praline')) return '#4b220e';
  return '#241008'; // Dark chocolate ganache default
}

const form = document.getElementById('cake-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('form-error');
const messageInput = document.getElementById('message');

const stage = createCakeStage(document.getElementById('cake-stage'));
const settings = await loadSettings();
let ordersOpen = settings.orders_open !== '0';

const baseLeadDays = Number(settings.cake_lead_days) || 0;
form.pickup_date.min = isoDate(baseLeadDays);
form.pickup_date.max = isoDate(180);
form.pickup_date.value = isoDate(baseLeadDays);

let groups = [];
try {
  ({ groups } = await api('/api/cake-options'));
} catch (err) {
  form.querySelector('[data-groups]').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  ordersOpen = false;
}
groups = groups.filter((g) => g.options.length);
const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
const optionById = new Map(groups.flatMap((g) => g.options.map((o) => [String(o.id), o])));

// ---------- render the choices ----------

let sizeScale = 1;
let isSliced = false;

function priceOf(o) {
  if (o.type === 'size' || !o.scales || !o.price_cents || sizeScale === 1) return o.price_cents;
  return Math.round((o.price_cents * sizeScale) / 50) * 50;
}

function cost(group, o) {
  if (group.key === 'size') return money(o.price_cents);
  return o.price_cents ? `+ ${money(priceOf(o))}` : 'Included';
}

function renderChoice(group, o, index) {
  const type = group.mode === 'multi' ? 'checkbox' : 'radio';
  const checked = group.mode === 'single' && index === 0 ? 'checked' : '';
  const input = `<input type="${type}" name="${group.key}" value="${o.id}" ${checked}>`;

  if (group.key === 'color' || group.key === 'drip') {
    const dotClass = !o.color ? 'none' : o.visual === 'metallic' ? 'metallic' : '';
    return `
      <label class="choice swatch">${input}
        <span class="dot ${dotClass}" style="${o.color ? `background:${esc(o.color)}` : ''}"></span>
        <span class="name">${esc(o.name)}</span>
        <span class="cost" data-cost="${o.id}">${cost(group, o)}</span>
      </label>`;
  }
  const icon = group.key === 'shape' ? SHAPE_ICONS[o.visual] || '' : group.key === 'tiers' ? TIER_ICONS[o.visual] || '' : '';
  return `
    <label class="choice">${input}
      ${icon}
      <span class="name">${esc(o.name)}</span>
      ${o.description ? `<span class="meta">${esc(o.description)}</span>` : ''}
      ${group.key === 'size' && o.lead_days ? `<span class="meta">Needs ${o.lead_days} extra day${o.lead_days === 1 ? '' : 's'} of notice</span>` : ''}
      <span class="cost" data-cost="${o.id}">${cost(group, o)}</span>
    </label>`;
}

form.querySelectorAll('[data-groups]').forEach((container) => {
  container.innerHTML = container.dataset.groups.split(',').map((key) => {
    const group = byKey[key];
    if (!group) return '';
    const layout = key === 'color' || key === 'drip' ? 'swatches' : 'choices';
    return `
      <div class="group" role="${group.mode === 'single' ? 'radiogroup' : 'group'}" aria-label="${esc(group.label)}">
        <div class="group-title"><span class="label">${esc(group.label)}</span><span class="chosen" data-chosen="${key}"></span></div>
        <div class="${layout}">${group.options.map((o, i) => renderChoice(group, o, i)).join('')}</div>
        ${key === 'size' && group.options.some((o) => Number(o.price_scale) !== 1)
          ? '<p class="size-note">Bigger cakes use more of everything, so toppings, fillings and finishes are priced for the size you choose.</p>' : ''}
      </div>`;
  }).join('') || '<p class="muted">No options available right now.</p>';
});

if (!groups.length) ordersOpen = false;
if (!ordersOpen) {
  document.getElementById('closed-notice').hidden = settings.orders_open !== '0';
  submitBtn.disabled = true;
}

// ---------- Portion & Event Calculator ----------

const portionSlider = document.getElementById('portion-slider');
const portionGuests = document.getElementById('portion-guests');
const portionRec = document.getElementById('portion-rec');
const portionApply = document.getElementById('portion-apply');

function getPortionRecommendation(guests) {
  const sizes = byKey.size?.options || [];
  const tiers = byKey.tiers?.options || [];
  let sizeIdx = 0;
  let tierVal = '1';
  let slices = '8–12';

  if (guests <= 10) {
    sizeIdx = 0; tierVal = '1'; slices = '8–10';
  } else if (guests <= 18) {
    sizeIdx = Math.min(1, Math.max(0, sizes.length - 1)); tierVal = '1'; slices = '14–18';
  } else if (guests <= 26) {
    sizeIdx = Math.min(2, Math.max(0, sizes.length - 1)); tierVal = '1'; slices = '22–26';
  } else if (guests <= 38) {
    sizeIdx = Math.min(1, Math.max(0, sizes.length - 1)); tierVal = '2'; slices = '28–38';
  } else if (guests <= 48) {
    sizeIdx = Math.min(2, Math.max(0, sizes.length - 1)); tierVal = '2'; slices = '40–48';
  } else {
    sizeIdx = Math.min(2, Math.max(0, sizes.length - 1)); tierVal = '3'; slices = '50–65';
  }

  const sizeOpt = sizes[sizeIdx] || sizes[0];
  const tierOpt = tiers.find((t) => String(t.visual) === tierVal) || tiers[tiers.length - 1];
  return { sizeOpt, tierOpt, slices };
}

function updatePortionUI() {
  const guests = Number(portionSlider.value);
  portionGuests.textContent = `${guests} guests`;
  const { sizeOpt, tierOpt, slices } = getPortionRecommendation(guests);
  const label = [sizeOpt?.name, tierOpt?.name].filter(Boolean).join(' · ') || 'Standard';
  portionRec.innerHTML = `Recommended: <strong>${esc(label)}</strong> (${slices} generous slices)`;
}

portionSlider?.addEventListener('input', updatePortionUI);
portionApply?.addEventListener('click', () => {
  const { sizeOpt, tierOpt } = getPortionRecommendation(Number(portionSlider.value));
  if (sizeOpt) {
    const inp = form.querySelector(`input[name="size"][value="${sizeOpt.id}"]`);
    if (inp) inp.checked = true;
  }
  if (tierOpt) {
    const inp = form.querySelector(`input[name="tiers"][value="${tierOpt.id}"]`);
    if (inp) inp.checked = true;
  }
  update();
  refreshStepper();
});
if (portionSlider) updatePortionUI();

// ---------- state → 3D cake, summary and price ----------

function selected(key) {
  const inputs = [...form.querySelectorAll(`input[name="${key}"]:checked`)];
  return inputs.map((i) => optionById.get(i.value)).filter(Boolean);
}

function cakeConfig() {
  const one = (key) => selected(key)[0];
  const sizes = byKey.size?.options || [];
  const sizeIndex = Math.max(0, sizes.indexOf(one('size')));
  const spongeOpt = one('flavor');
  const fillingOpt = one('filling');
  return {
    shape: one('shape')?.visual || 'round',
    tiers: Number(one('tiers')?.visual) || 1,
    size: sizes.length > 1 ? 0.85 + (sizeIndex / (sizes.length - 1)) * 0.35 : 1,
    color: one('color')?.color || '#f3e6d3',
    spongeColor: inferSpongeColor(spongeOpt),
    fillingColor: inferFillingColor(fillingOpt),
    sliced: isSliced,
    drip: one('drip')?.color || '',
    dripMetallic: one('drip')?.visual === 'metallic',
    toppings: selected('toppings').map((o) => o.visual).filter(Boolean),
    extras: selected('extras').map((o) => o.visual).filter(Boolean),
    message: messageInput.value.trim(),
  };
}

function updateSliceLegend() {
  const legend = document.getElementById('slice-legend');
  if (!legend) return;
  if (!isSliced) {
    legend.hidden = true;
    return;
  }
  const spongeOpt = selected('flavor')[0];
  const fillingOpt = selected('filling')[0];
  const frostOpt = selected('frosting')[0];
  const colorOpt = selected('color')[0];
  const sCol = inferSpongeColor(spongeOpt);
  const fCol = inferFillingColor(fillingOpt);
  const cCol = colorOpt?.color || '#f3e6d3';
  legend.hidden = false;
  legend.innerHTML = `
    <span class="legend-item"><i style="background:${esc(sCol)}"></i>Sponge: <strong>${esc(spongeOpt?.name || 'Chocolate')}</strong></span>
    <span class="legend-item"><i style="background:${esc(fCol)}"></i>Filling: <strong>${esc(fillingOpt?.name || 'Ganache')}</strong></span>
    <span class="legend-item"><i style="background:${esc(cCol)}"></i>Frosting: <strong>${esc(frostOpt?.name || 'Buttercream')}</strong></span>
  `;
}

let fulfillment = () => 'pickup';

function update({ redraw = true, intro = false } = {}) {
  if (redraw) stage?.setCake(cakeConfig(), { intro });
  updateSliceLegend();
  document.getElementById('message-count').textContent = `${messageInput.value.length} / 60 · shown on a chocolate plaque`;
  const plaqueText = document.getElementById('plaque-preview-text');
  const plaqueSlab = document.getElementById('plaque-slab');
  if (plaqueText) {
    const rawMsg = messageInput.value.trim();
    plaqueText.textContent = rawMsg || 'Your piped message appears here';
    plaqueText.classList.toggle('is-placeholder', !rawMsg);
  }
  if (plaqueSlab) {
    const frostColor = selected('color')[0]?.color || '#E6C27E';
    plaqueSlab.style.setProperty('--plaque-border', frostColor);
  }

  const size = selected('size')[0];
  const scale = Number(size?.price_scale) || 1;
  if (scale !== sizeScale) {
    sizeScale = scale;
    for (const group of groups) {
      if (group.key === 'size') continue;
      for (const o of group.options) {
        const label = form.querySelector(`[data-cost="${o.id}"]`);
        if (label) label.textContent = cost(group, o);
      }
    }
  }
  const leadDays = baseLeadDays + (Number(size?.lead_days) || 0);
  const earliest = isoDate(leadDays);
  form.pickup_date.min = earliest;
  if (form.pickup_date.value < earliest) form.pickup_date.value = earliest;
  document.getElementById('date-hint').textContent = leadDays > 0
    ? `Earliest: ${friendlyDate(earliest)}${size?.lead_days ? ` (${size.name} cakes need ${leadDays} days)` : ''}.` : '';

  let subtotal = 0;
  const rows = [];
  for (const group of groups) {
    const chosen = selected(group.key);
    const label = form.querySelector(`[data-chosen="${group.key}"]`);
    if (label) label.textContent = group.mode === 'single' ? chosen[0]?.name || '' : chosen.length ? `${chosen.length} selected` : 'Optional';
    for (const o of chosen) {
      subtotal += priceOf(o);
      rows.push(`<li><span class="k">${esc(group.label)}: ${esc(o.name)}</span><span class="v">${group.key === 'size' ? money(o.price_cents) : o.price_cents ? `+ ${money(priceOf(o))}` : '—'}</span></li>`);
    }
  }
  const message = messageInput.value.trim();
  if (message) rows.push(`<li><span class="k">Message: “${esc(message)}”</span><span class="v">—</span></li>`);

  const fee = deliveryFee(settings, fulfillment());
  const total = subtotal + fee;
  document.getElementById('summary').innerHTML = rows.join('');
  document.getElementById('fee-rows').innerHTML = fee
    ? `<div class="sum-row"><span>Delivery</span><span>${money(fee)}</span></div>` : '';
  const sized = selected('size').length > 0 || !byKey.size;
  document.getElementById('total').textContent = sized ? money(total) : '—';
  document.getElementById('preview-total').textContent = sized ? money(total) : '—';
  document.getElementById('bar-total').textContent = sized ? money(total) : '';
  document.getElementById('preview-title').textContent = [selected('size')[0]?.name, selected('shape')[0]?.name, selected('tiers')[0]?.name]
    .filter(Boolean).join(' · ') || 'Custom cake';

  renderTastingProfile();
}

function renderTastingProfile() {
  const box = document.getElementById('tasting-profile');
  if (!box) return;
  const sponge = selected('flavor')[0]?.name || 'Chocolate Sponge';
  const filling = selected('filling')[0]?.name || 'Dark Ganache';
  const combined = `${sponge} ${filling}`.toLowerCase();

  let richness = 78;
  let sweetness = 65;
  let note = 'Balanced cocoa depth with a velvety patisserie crumb.';
  if (/dark|chocolate|ganache|nutella|praline/.test(combined)) {
    richness = 92;
    sweetness = 62;
    note = 'Deep roasted Belgian cocoa profile with a luxurious Truffle-like finish.';
  } else if (/pistachio|kunafa|lotus|caramel/.test(combined)) {
    richness = 86;
    sweetness = 78;
    note = 'Warm roasted nutty notes paired with caramelized Levantine indulgence.';
  } else if (/berry|strawberry|raspberry|lemon/.test(combined)) {
    richness = 64;
    sweetness = 70;
    note = 'Bright orchard fruit acidity cuts through the silky cream layers.';
  } else if (/vanilla|white|funfetti/.test(combined)) {
    richness = 68;
    sweetness = 82;
    note = 'Aromatic Madagascar vanilla bean crumb — a crowd-pleasing celebration classic.';
  }

  box.innerHTML = `
    <div class="tasting-head">
      <span class="portion-badge">Tasting Note</span>
      <strong>${esc(sponge)} + ${esc(filling)}</strong>
    </div>
    <p class="tasting-desc">${esc(note)}</p>
    <div class="tasting-meters">
      <div class="tasting-meter">
        <span>Richness</span>
        <div class="tasting-bar"><i style="width:${richness}%"></i></div>
      </div>
      <div class="tasting-meter">
        <span>Sweetness</span>
        <div class="tasting-bar"><i style="width:${sweetness}%"></i></div>
      </div>
    </div>`;
}

// ---------- signature designs (/cakes?design=classic) & shared 3D links (/cakes?custom=...) ----------

// Matches a design's picks to the admin's options by 3D look or color, so renamed options still match.
function applyDesign(design) {
  const matches = (o, want) => o.visual === want || Boolean(o.color && want.startsWith('#') && o.color.toLowerCase() === want.toLowerCase());
  for (const [key, want] of Object.entries(design.picks)) {
    const group = byKey[key];
    if (!group) continue;
    const input = (o) => form.querySelector(`input[name="${key}"][value="${o.id}"]`);
    if (group.mode === 'single') {
      const option = group.options.find((o) => matches(o, want));
      if (option) input(option).checked = true;
    } else {
      for (const o of group.options) input(o).checked = want.some((w) => matches(o, w));
    }
  }
}

const occasionPills = document.getElementById('occasion-pills');
if (occasionPills && groups.length) {
  occasionPills.innerHTML = SIGNATURE_DESIGNS.map((d) => `
    <button type="button" class="menu-filter-pill" data-preset-id="${esc(d.id)}">${esc(d.name)}</button>
  `).join('');
  occasionPills.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset-id]');
    if (!btn) return;
    const d = SIGNATURE_DESIGNS.find((x) => x.id === btn.dataset.presetId);
    if (!d) return;
    occasionPills.querySelectorAll('[data-preset-id]').forEach((b) => b.classList.toggle('active', b === btn));
    applyDesign(d);
    update({ redraw: true, intro: true });
    refreshStepper();
  });
}

const params = new URLSearchParams(location.search);
const preset = SIGNATURE_DESIGNS.find((d) => d.id === params.get('design'));
if (preset && groups.length) {
  applyDesign(preset);
  const note = document.createElement('div');
  note.className = 'alert alert-info';
  note.innerHTML = `You're customizing <strong>${esc(preset.name)}</strong>. Change anything you like.`;
  document.getElementById('stepper').before(note);
}

const sharedCustom = params.get('custom');
if (sharedCustom && groups.length) {
  try {
    const decoded = JSON.parse(atob(sharedCustom));
    for (const group of groups) {
      const val = decoded[group.key];
      if (val === undefined) continue;
      const ids = Array.isArray(val) ? val.map(String) : [String(val)];
      form.querySelectorAll(`input[name="${group.key}"]`).forEach((inp) => {
        inp.checked = ids.includes(inp.value);
      });
    }
    if (typeof decoded.msg === 'string') {
      messageInput.value = decoded.msg.slice(0, 60);
    }
    const note = document.createElement('div');
    note.className = 'alert alert-info';
    note.innerHTML = 'Viewing a shared 3D cake design. Spin the cake, cut a slice, or customize it below!';
    document.getElementById('stepper').before(note);
  } catch {
    // Ignore malformed custom parameter
  }
}

fulfillment = setupFulfillment(form, settings, () => update({ redraw: false }));
const branchOf = await setupBranches(form, () => refreshStepper());

// ---------- inspiration photo ----------

const MAX_PHOTO = 8 * 1024 * 1024;
const photoInput = document.getElementById('photo');
const photoDrop = document.getElementById('photo-drop');
let photoFile = null;

function setPhoto(file) {
  errorBox.hidden = true;
  if (file && !file.type.startsWith('image/')) {
    errorBox.textContent = 'Please choose a photo (JPG, PNG or HEIC).';
    errorBox.hidden = false;
    return;
  }
  if (file && file.size > MAX_PHOTO) {
    errorBox.textContent = 'That photo is over 8 MB. Please choose a smaller one.';
    errorBox.hidden = false;
    return;
  }
  photoFile = file || null;
  const preview = document.getElementById('photo-preview');
  if (preview.src) URL.revokeObjectURL(preview.src);
  preview.hidden = !photoFile;
  preview.src = photoFile ? URL.createObjectURL(photoFile) : '';
  document.getElementById('photo-empty').hidden = Boolean(photoFile);
  document.getElementById('photo-actions').hidden = !photoFile;
  document.getElementById('photo-name').textContent = photoFile ? photoFile.name : '';
  if (!photoFile) photoInput.value = '';
  refreshStepper();
}

photoInput.addEventListener('change', () => setPhoto(photoInput.files[0]));
document.getElementById('photo-remove').addEventListener('click', () => setPhoto(null));
photoDrop.addEventListener('dragover', (e) => { e.preventDefault(); photoDrop.classList.add('dragging'); });
photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('dragging'));
photoDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDrop.classList.remove('dragging');
  setPhoto(e.dataTransfer.files[0]);
});

let messageTimer = 0;
form.addEventListener('change', (e) => {
  if (e.target.name === 'fulfillment') return;
  playClick();
  update({ redraw: Boolean(optionById.get(e.target.value)) });
});
messageInput.addEventListener('input', () => {
  update({ redraw: false });
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => stage?.setCake(cakeConfig()), 350);
});
update({ intro: true });

// ---------- progress stepper ----------

const stepper = document.getElementById('stepper');
const sections = [...form.querySelectorAll('.builder-step')];
stepper.innerHTML = sections.map((s, i) => `<a href="#${s.id}" data-for="${s.id}"><span class="dot">${i + 1}</span>${esc(s.dataset.step)}</a>`).join('');

function stepDone(section) {
  if (section.querySelector('input[name="branch"]') && !section.querySelector('input[name="branch"]:checked')) return false;
  if (section.contains(photoDrop) && photoFile) return true;
  const groupsHere = [...section.querySelectorAll('[data-chosen]')].map((el) => byKey[el.dataset.chosen]).filter(Boolean);
  if (groupsHere.length) return groupsHere.every((g) => g.mode === 'multi' || selected(g.key).length > 0);
  if (section.id === 'summary-step') return false;
  const fields = [...section.querySelectorAll('input, textarea')].filter((el) => el.type !== 'radio' && el.offsetParent !== null);
  const required = fields.filter((el) => el.required);
  if (required.length) return required.every((el) => el.value && el.checkValidity());
  return fields.some((el) => el.value.trim());
}

function refreshStepper() {
  sections.forEach((s, i) => {
    const link = stepper.querySelector(`[data-for="${s.id}"]`);
    const done = stepDone(s);
    link.classList.toggle('done', done);
    link.querySelector('.dot').textContent = done ? '✓' : i + 1;
  });
}

// Highlight the step in the middle of the screen, keeping it visible in the (scrollable) stepper.
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const link = stepper.querySelector(`[data-for="${entry.target.id}"]`);
    stepper.querySelectorAll('a').forEach((a) => a.classList.toggle('current', a === link));
    stepper.scrollTo({ left: link.offsetLeft - stepper.clientWidth / 2 + link.clientWidth / 2, behavior: 'smooth' });
  }
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach((s) => spy.observe(s));

form.addEventListener('input', refreshStepper);
form.addEventListener('change', refreshStepper);
refreshStepper();

// ---------- stage tools: Cut a slice, Make a wish, Surprise me, Share 3D link, Save image ----------

const sliceBtn = document.getElementById('slice-btn');
sliceBtn?.addEventListener('click', () => {
  isSliced = !isSliced;
  sliceBtn.setAttribute('aria-pressed', String(isSliced));
  sliceBtn.classList.toggle('active', isSliced);
  sliceBtn.querySelector('span').textContent = isSliced ? 'Whole cake' : 'Cut a slice';
  playSlice();
  update();
});

const wishBtn = document.getElementById('wish-btn');
wishBtn?.addEventListener('click', () => {
  const next = !stage?.getWishMode();
  stage?.setWishMode(next);
  wishBtn.setAttribute('aria-pressed', String(next));
  wishBtn.classList.toggle('active', next);
  wishBtn.querySelector('span').textContent = next ? 'Lights on' : 'Make a wish';
  playWish();
  update();
});

document.getElementById('surprise-btn')?.addEventListener('click', () => {
  playPop();
  const inputsOf = (key) => [...form.querySelectorAll(`input[name="${key}"]`)];
  const random = (list) => list[Math.floor(Math.random() * list.length)];
  for (const key of ['shape', 'tiers', 'flavor', 'filling', 'frosting', 'color', 'drip']) {
    const inputs = inputsOf(key);
    if (inputs.length) random(inputs).checked = true;
  }
  for (const [key, min, max] of [['toppings', 1, 2], ['extras', 0, 1]]) {
    const inputs = inputsOf(key).sort(() => Math.random() - 0.5);
    const count = min + Math.floor(Math.random() * (max - min + 1));
    inputs.forEach((input, i) => { input.checked = i < count; });
  }
  update();
  refreshStepper();
});

document.getElementById('sound-btn')?.addEventListener('click', toggleSound);

document.getElementById('share-btn')?.addEventListener('click', async () => {
  const state = {};
  for (const group of groups) {
    const ids = selected(group.key).map((o) => o.id);
    if (ids.length) state[group.key] = group.mode === 'single' ? ids[0] : ids;
  }
  if (messageInput.value.trim()) state.msg = messageInput.value.trim();
  const encoded = btoa(JSON.stringify(state));
  const url = `${location.origin}/cakes?custom=${encodeURIComponent(encoded)}`;
  const labelEl = document.getElementById('share-label');
  try {
    if (navigator.share) {
      await navigator.share({ title: `${settings.shop_name || 'SAVORY'} · Custom 3D Cake`, url });
    } else {
      await navigator.clipboard.writeText(url);
      if (labelEl) {
        labelEl.textContent = 'Link copied!';
        setTimeout(() => { labelEl.textContent = 'Share 3D link'; }, 2200);
      }
    }
  } catch {
    await navigator.clipboard?.writeText(url).catch(() => {});
    if (labelEl) {
      labelEl.textContent = 'Link copied!';
      setTimeout(() => { labelEl.textContent = 'Share 3D link'; }, 2200);
    }
  }
});

document.getElementById('save-btn').addEventListener('click', async (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  try {
    const url = await cakeCard();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(settings.shop_name || 'cake').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-my-cake.png`;
    link.click();
  } finally {
    releaseSnapshots();
    button.disabled = false;
  }
});

// A portrait image of the cake on a branded background, ready to share.
async function cakeCard() {
  const render = await renderCakeSnapshot(cakeConfig(), { width: 1000, height: 1000 });
  if (!render) return null;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = render;
  });
  await Promise.all(['600 72px "Cormorant Garamond"', '500 30px Manrope', '60px "Great Vibes"'].map((f) => document.fonts.load(f).catch(() => {})));

  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(540, 820, 60, 540, 700, 900);
  bg.addColorStop(0, '#FFFDF3');
  bg.addColorStop(0.55, '#F7F7D3');
  bg.addColorStop(1, '#E8E4B5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 40, 210, 1000, 1000);

  // SAVORY cocoa-pod emblem at the top of the share card
  drawSavoryPod(ctx, 540, 72, 76, '#4C2007');

  const gold = ctx.createLinearGradient(300, 0, 780, 0);
  gold.addColorStop(0, '#4C2007');
  gold.addColorStop(0.5, '#7A3912');
  gold.addColorStop(1, '#4C2007');
  ctx.textAlign = 'center';
  ctx.fillStyle = gold;
  ctx.font = '700 58px Manrope, sans-serif';
  ctx.fillText(settings.shop_name || 'SAVORY', 540, 165);
  ctx.font = '60px "Great Vibes", cursive';
  ctx.fillText('Designed by you', 540, 1250);
  ctx.fillStyle = '#6E462C';
  ctx.font = '500 30px Manrope, sans-serif';
  ctx.fillText(document.getElementById('preview-title').textContent, 540, 1300);
  return c.toDataURL('image/png');
}

const bar = document.getElementById('bottom-bar');
const summaryStep = document.getElementById('summary-step');
new IntersectionObserver(([entry]) => bar.classList.toggle('show', !entry.isIntersecting && entry.boundingClientRect.top > 0))
  .observe(summaryStep);

// Mobile Floating PiP 3D Preview: keeps the single WebGL stage visible while scrolling Steps 02-08 on mobile
const previewCol = document.getElementById('preview-col');
const previewCard = document.getElementById('preview-card');
const pipExpandBtn = document.getElementById('pip-expand-btn');
if (previewCol && previewCard && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    const isMobile = window.matchMedia('(max-width: 960px)').matches;
    const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.bottom < 80;
    if (isMobile && scrolledPast) {
      previewCol.style.minHeight = `${previewCard.offsetHeight || 380}px`;
      previewCard.classList.add('is-pip');
    } else {
      previewCard.classList.remove('is-pip');
      previewCol.style.minHeight = '';
    }
  }, { threshold: [0, 0.15] }).observe(previewCol);

  pipExpandBtn?.addEventListener('click', () => {
    window.scrollTo({ top: Math.max(0, previewCol.offsetTop - 90), behavior: 'smooth' });
  });
}

// ---------- submit ----------

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form));
  for (const group of groups) {
    const ids = selected(group.key).map((o) => o.id);
    data[group.key] = group.mode === 'single' ? ids[0] : ids;
  }
  data.fulfillment = fulfillment();
  data.branch = branchOf()?.id;

  const payload = new FormData();
  payload.append('data', JSON.stringify(data));
  if (photoFile) payload.append('photo', photoFile);

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${photoFile ? 'Uploading your photo…' : 'Placing your order…'}`;
  try {
    const order = await api('/api/orders/cake', { method: 'POST', form: payload });
    showConfirmation(order, data.customer_name);
    openWhatsApp(order.whatsapp_url);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place cake order';
  }
});

function showConfirmation(order, name) {
  bar.remove();
  confetti();
  playCelebration();
  document.getElementById('builder-col').innerHTML = orderConfirmation(order, {
    name,
    title: 'your cake is ordered!',
    shopName: settings.shop_name,
    links: `<a class="btn btn-gold" href="/track?code=${encodeURIComponent(order.order_code)}">Track order live</a><a class="btn btn-outline" href="/cakes">Design another cake</a>`,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
