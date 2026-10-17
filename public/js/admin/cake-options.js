import { $, esc, money, adminApi, toast, formError, busy, cents, errorBlock } from './core.js';

const VISUAL_LABELS = {
  '': 'Not shown in 3D',
  round: 'Round', square: 'Square', heart: 'Heart',
  1: 'One tier', 2: 'Two tiers', 3: 'Three tiers',
  metallic: 'Metallic gold',
  berries: 'Berries', macarons: 'Macarons', shards: 'Chocolate shards', goldleaf: 'Gold leaf',
  sprinkles: 'Sprinkles', flowers: 'Flowers', cherries: 'Cherries',
  candles: 'Candles', topper: 'Gold topper', sparklers: 'Sparklers',
};

let groups = [];
let options = [];

export async function load() {
  try {
    ({ groups, options } = await adminApi('/cake-options'));
  } catch (err) {
    if (err.status !== 401) $('#options-list').innerHTML = errorBlock(err);
    return;
  }
  render();
}

function sizeNote(o) {
  if (o.type === 'size') {
    const parts = [`Add-ons ×${Number(o.price_scale)}`];
    if (o.lead_days) parts.push(`+${o.lead_days} day${o.lead_days === 1 ? '' : 's'} notice`);
    return `<span class="pill">${parts.join(' · ')}</span>`;
  }
  return o.price_cents && !o.scales ? '<span class="pill">Same price on every size</span>' : '';
}

function priceLabel(o) {
  if (o.type === 'size') return money(o.price_cents);
  return o.price_cents ? `+ ${money(o.price_cents)}` : '<span class="muted">Included</span>';
}

function render() {
  $('#options-list').innerHTML = groups.map((g) => {
    const list = options.filter((o) => o.type === g.key);
    const shown = list.filter((o) => o.available).length;
    const warning = g.mode === 'single' && list.length && !shown
      ? `<p class="alert alert-error" style="margin: 0 20px 14px;">Every ${esc(g.label.toLowerCase())} choice is hidden, so this step is skipped in the builder.</p>` : '';
    return `
      <div class="card list-card">
        <div class="list-head">
          <div>
            <h2>${esc(g.label)}</h2>
            <span class="hint">${g.mode === 'single' ? 'Customers pick one' : 'Optional: customers pick any'}${g.hint ? ` · ${esc(g.hint)}` : ''}</span>
          </div>
          <button type="button" class="btn btn-outline btn-sm" data-add="${g.key}">+ Add</button>
        </div>
        ${warning}
        ${list.map((o) => `
          <div class="row no-thumb ${o.available ? '' : 'is-hidden'}">
            <div class="row-main">
              <div class="name">
                ${g.color ? `<span class="swatch-sm" style="background: ${o.visual === 'metallic' ? 'var(--gold-grad)' : esc(o.color || 'transparent')}; ${o.color ? '' : 'border-style: dashed;'}"></span>` : ''}
                ${esc(o.name)}
                ${o.available ? '' : '<span class="pill">Hidden</span>'}
                ${o.visual && VISUAL_LABELS[o.visual] && g.visuals ? `<span class="pill cake">3D: ${esc(VISUAL_LABELS[o.visual])}</span>` : ''}
                ${sizeNote(o)}
              </div>
              ${o.description ? `<div class="desc">${esc(o.description)}</div>` : ''}
            </div>
            <div class="price">${priceLabel(o)}</div>
            <div class="row-actions">
              <label class="switch" title="Available in the cake builder"><input type="checkbox" data-toggle="${o.id}" ${o.available ? 'checked' : ''}> Shown</label>
              <button type="button" class="btn btn-ghost btn-sm" data-edit="${o.id}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete="${o.id}">Delete</button>
            </div>
          </div>`).join('') || '<p class="muted small" style="padding: 0 20px 14px;">No choices yet. This step is hidden from customers until you add one.</p>'}
      </div>`;
  }).join('');
}

// ---------- dialog ----------

const dialog = $('#option-dialog');
const form = $('#option-form');
let editing = null;

function open(type, option = null) {
  const g = groups.find((x) => x.key === type);
  editing = option;
  form.reset();
  formError(form, '');
  $('#option-dialog-title').textContent = `${option ? 'Edit' : 'Add'} ${g.label.toLowerCase()} choice`;
  $('#o-hint').textContent = g.hint || '';
  $('#o-price-label').textContent = type === 'size' ? 'Price' : 'Extra charge';
  $('#o-price-hint').textContent = type === 'size' ? 'The starting price of the cake.' : 'Added to the cake price. Use 0 if included.';
  $('#o-type').value = type;
  $('#o-name').value = option?.name ?? '';
  $('#o-description').value = option?.description ?? '';
  $('#o-price').value = option ? cents(option.price_cents) : type === 'size' ? '' : '0.00';
  $('#o-sort').value = option?.sort_order ?? options.filter((o) => o.type === type).length;
  $('#o-available').checked = option ? Boolean(option.available) : true;

  $('#o-color-field').hidden = !g.color;
  $('#o-color').value = option?.color || '#f3e6d3';
  $('#o-no-color').checked = Boolean(g.color && option && !option.color);
  $('#o-color').disabled = $('#o-no-color').checked;

  $('#o-size-fields').hidden = type !== 'size';
  $('#o-scales-field').hidden = type === 'size';
  $('#o-scale').value = option?.price_scale ?? 1;
  $('#o-lead').value = option?.lead_days ?? 0;
  $('#o-scales').checked = option ? Boolean(option.scales) : type !== 'extras';

  $('#o-visual-field').hidden = !g.visuals;
  $('#o-visual').innerHTML = (g.visuals || []).map((v) => `<option value="${v}">${esc(VISUAL_LABELS[v] || v)}</option>`).join('');
  $('#o-visual').value = option?.visual ?? (g.visuals?.[0] || '');
  dialog.showModal();
}

$('#o-no-color').addEventListener('change', (e) => { $('#o-color').disabled = e.target.checked; });

function body(o, overrides = {}) {
  return {
    type: o.type,
    name: o.name,
    description: o.description,
    price: cents(o.price_cents),
    color: o.color,
    visual: o.visual,
    sort_order: o.sort_order,
    available: Boolean(o.available),
    price_scale: o.price_scale,
    lead_days: o.lead_days,
    scales: Boolean(o.scales),
    ...overrides,
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(form, '');
  const data = Object.fromEntries(new FormData(form));
  data.available = $('#o-available').checked;
  data.scales = $('#o-scales').checked;
  const g = groups.find((x) => x.key === data.type);
  data.color = g.color && !$('#o-no-color').checked ? $('#o-color').value : '';
  if (!g.visuals) data.visual = '';

  try {
    await busy($('button[type="submit"]', form), () => adminApi(
      editing ? `/cake-options/${editing.id}` : '/cake-options',
      { method: editing ? 'PUT' : 'POST', body: data },
    ));
    dialog.close();
    toast(editing ? 'Choice updated.' : 'Choice added.');
    load();
  } catch (err) {
    formError(form, err.message);
  }
});

// ---------- list actions ----------

$('#options-list').addEventListener('click', async (e) => {
  const add = e.target.closest('[data-add]');
  if (add) return open(add.dataset.add);
  const find = (attr) => options.find((o) => o.id === Number(e.target.closest(`[${attr}]`)?.getAttribute(attr)));

  const edit = find('data-edit');
  if (edit) return open(edit.type, edit);

  const del = find('data-delete');
  if (del) {
    if (!confirm(`Delete "${del.name}"? This can't be undone.`)) return;
    try {
      await adminApi(`/cake-options/${del.id}`, { method: 'DELETE' });
      toast('Choice deleted.');
      load();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

$('#options-list').addEventListener('change', async (e) => {
  const toggle = e.target.closest('[data-toggle]');
  if (!toggle) return;
  const option = options.find((o) => o.id === Number(toggle.dataset.toggle));
  try {
    await adminApi(`/cake-options/${option.id}`, { method: 'PUT', body: body(option, { available: toggle.checked }) });
    toast(toggle.checked ? `${option.name} is available.` : `${option.name} is hidden.`);
  } catch (err) {
    toast(err.message, true);
  }
  load();
});
