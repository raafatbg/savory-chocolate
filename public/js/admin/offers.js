import { $, esc, money, mediaSrc, adminApi, toast, formError, busy, errorBlock, emptyCard } from './core.js';

let offers = [];
let slides = [];
let menuItems = [];

const PRESET_SLIDES = [
  { label: 'Atelier Video Reel (MP4)', value: '/img/onboarding-reel.mp4' },
  { label: 'Luxury Truffle Box Photo', value: '/img/onboarding-box.jpg' },
  { label: 'Pistachio Kunafa Bar Photo', value: '/img/onboarding-kunafa.jpg' },
  { label: 'Belgian Chocolate Crepe Photo', value: '/img/onboarding-crepe.jpg' },
  { label: 'Savory Flurry Photo', value: '/img/onboarding-flurry.jpg' },
];

export async function load() {
  try {
    [offers, slides, menuItems] = await Promise.all([
      adminApi('/offers'),
      adminApi('/onboarding'),
      adminApi('/menu-items'),
    ]);
  } catch (err) {
    if (err.status !== 401) {
      $('#offers-list').innerHTML = errorBlock(err);
      $('#slides-list').innerHTML = '';
    }
    return;
  }
  renderOffers();
  renderFeaturedSummary();
  renderSlides();
}

function targetSummary(offer) {
  if (offer.target_type === 'product') {
    const item = menuItems.find((m) => m.id === Number(offer.target_value));
    return item ? `Product · ${item.name}` : `Product #${offer.target_value}`;
  }
  if (offer.target_type === 'category') return `Category · ${offer.target_value || 'All'}`;
  if (offer.target_type === 'box') return `Gift Box Studio${offer.target_value ? ` (${offer.target_value} pcs)` : ''}`;
  return 'Info banner only';
}

const POD_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c3.8 2.8 6 6.2 6 10s-2.2 7.2-6 10c-3.8-2.8-6-6.2-6-10s2.2-7.2 6-10Z"/><path d="M12 5v14"/></svg>';

function renderOffers() {
  if (!offers.length) {
    $('#offers-list').innerHTML = emptyCard('🏷️', 'No promotional offers yet. Add a slider banner or promote items directly from the Menu tab.',
      '<button type="button" class="btn btn-gold btn-sm" data-add-offer>+ Add offer</button>');
    return;
  }
  $('#offers-list').innerHTML = `
    <div class="card list-card">
      ${offers.map((o) => `
        <div class="row ${o.available ? '' : 'is-hidden'}">
          <div class="thumb-sm">
            ${o.image
              ? `<img src="${esc(mediaSrc(o.image))}" alt="">`
              : POD_ICON}
          </div>
          <div class="row-main">
            <div class="name">
              ${esc(o.title)}
              ${o.badge ? `<span class="pill featured">${esc(o.badge)}</span>` : ''}
              ${o.available ? '' : '<span class="pill">Hidden</span>'}
            </div>
            <div class="desc">${esc(o.subtitle)}</div>
            <div class="desc" style="margin-top:4px;font-weight:600;color:var(--text-soft);">
              CTA: “${esc(o.cta_text)}” → ${esc(targetSummary(o))}
            </div>
          </div>
          <span></span>
          <div class="row-actions">
            <label class="switch" title="Show in slider"><input type="checkbox" data-offer-toggle="${o.id}" ${o.available ? 'checked' : ''}> Shown</label>
            <button type="button" class="btn btn-ghost btn-sm" data-offer-edit="${o.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-offer-delete="${o.id}">Delete</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderFeaturedSummary() {
  const box = $('#featured-summary');
  if (!box) return;
  const featured = menuItems.filter((m) => m.featured && m.available);
  if (!featured.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `
    <div class="card list-card" style="margin-top: 12px;">
      <div class="list-head">
        <h2>Featured Menu Items in Slider</h2>
        <button type="button" class="btn btn-outline btn-sm" data-go-tab="menu">Manage in Menu tab →</button>
      </div>
      ${featured.map((m) => `
        <div class="row">
          <div class="thumb-sm">
            ${m.image ? `<img src="${esc(mediaSrc(m.image))}" alt="">` : POD_ICON}
          </div>
          <div class="row-main">
            <div class="name">
              ${esc(m.name)}
              ${m.offer_badge ? `<span class="pill featured">${esc(m.offer_badge)}</span>` : '<span class="pill featured">Featured</span>'}
            </div>
            <div class="desc">${esc(m.category)}</div>
          </div>
          <div class="price">
            ${m.compare_price_cents > m.price_cents ? `<del class="muted small" style="display:block;font-weight:500;">${money(m.compare_price_cents)}</del>` : ''}
            ${money(m.price_cents)}
          </div>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-unfeature="${m.id}">Remove from slider</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function isVideoSlide(slide) {
  return slide.media_type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(slide.media_url || '');
}

function renderSlides() {
  if (!slides.length) {
    $('#slides-list').innerHTML = emptyCard('🎬', 'No background slides configured yet. Add photos or videos above to cycle behind your start screen.');
    return;
  }
  $('#slides-list').innerHTML = `
    <div class="media-grid">
      ${slides.map((s) => {
        const src = mediaSrc(s.media_url);
        const video = isVideoSlide(s);
        return `
          <div class="card media-card ${s.available ? '' : 'is-hidden'}">
            <div class="media-thumb">
              ${video
                ? `<video src="${esc(src)}" muted loop playsinline autoplay></video>`
                : `<img src="${esc(src)}" alt="${esc(s.caption)}" loading="lazy">`}
              <span class="pill media-type-pill ${video ? 'featured' : ''}">${video ? 'VIDEO' : 'IMAGE'}</span>
            </div>
            <div class="media-card-body">
              <input type="text" value="${esc(s.caption)}" maxlength="140" placeholder="Optional caption" data-slide-caption="${s.id}" aria-label="Slide caption">
              <div class="media-card-meta">
                <label class="small muted" style="display:inline-flex;align-items:center;gap:6px;">
                  Order
                  <input type="number" min="0" max="9999" value="${s.sort_order}" data-slide-sort="${s.id}" style="width:72px;padding:6px 8px;">
                </label>
                <label class="switch" style="margin:0;"><input type="checkbox" data-slide-toggle="${s.id}" ${s.available ? 'checked' : ''}> Shown</label>
                <button type="button" class="icon-btn" data-slide-delete="${s.id}" aria-label="Delete slide" title="Delete slide" style="height:36px;">✕</button>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ---------- Offer Dialog ----------

const offerDialog = $('#offer-dialog');
const offerForm = $('#offer-form');
const targetTypeEl = $('#of-target-type');
const targetValueWrap = $('#of-target-value-wrap');
const targetValueSelect = $('#of-target-value');
let editingOffer = null;

function populateTargetOptions(type, selectedValue = '') {
  if (!targetValueWrap || !targetValueSelect) return;
  if (type === 'none') {
    targetValueWrap.hidden = true;
    targetValueSelect.innerHTML = '<option value=""></option>';
    return;
  }
  targetValueWrap.hidden = false;
  let opts = [];
  if (type === 'product') {
    opts = menuItems
      .filter((m) => m.available)
      .map((m) => ({ value: String(m.id), label: `${m.name} (${m.category})` }));
  } else if (type === 'category') {
    const cats = [...new Set(menuItems.map((m) => m.category).filter(Boolean))];
    opts = cats.map((c) => ({ value: c, label: c }));
  } else if (type === 'box') {
    opts = [
      { value: '9', label: '9-Piece Gift Box ($18)' },
      { value: '16', label: '16-Piece Luxury Box ($30)' },
      { value: '25', label: '25-Piece Grand Box ($45)' },
    ];
  }
  targetValueSelect.innerHTML = opts
    .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
    .join('');
  if (selectedValue && opts.some((o) => o.value === String(selectedValue))) {
    targetValueSelect.value = String(selectedValue);
  }
}

targetTypeEl?.addEventListener('change', () => {
  populateTargetOptions(targetTypeEl.value);
});

function setOfferPreview(src) {
  $('#of-preview').innerHTML = src ? `<img src="${esc(src)}" alt="">` : '';
}

function openOfferModal(offer = null) {
  editingOffer = offer;
  offerForm.reset();
  formError(offerForm, '');
  $('#offer-dialog-title').textContent = offer ? 'Edit offer' : 'Add offer';
  $('#of-title').value = offer?.title ?? '';
  $('#of-badge').value = offer?.badge ?? '';
  $('#of-cta').value = offer?.cta_text ?? 'Order Now';
  $('#of-subtitle').value = offer?.subtitle ?? '';
  $('#of-sort').value = offer?.sort_order ?? 0;
  $('#of-available').checked = offer ? Boolean(offer.available) : true;

  const targetType = offer?.target_type ?? 'product';
  targetTypeEl.value = targetType;
  populateTargetOptions(targetType, offer?.target_value ?? '');

  const isUrlOrPreset = offer?.image && (offer.image.startsWith('/') || offer.image.startsWith('http'));
  $('#of-image-url').value = isUrlOrPreset ? offer.image : '';
  $('#of-remove-wrap').hidden = !offer?.image;
  setOfferPreview(offer?.image ? mediaSrc(offer.image) : null);
  offerDialog.showModal();
}

$('#of-image')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  const urlVal = $('#of-image-url').value.trim();
  setOfferPreview(file ? URL.createObjectURL(file) : urlVal ? mediaSrc(urlVal) : editingOffer?.image ? mediaSrc(editingOffer.image) : null);
});

$('#of-image-url')?.addEventListener('input', (e) => {
  if ($('#of-image').files[0]) return;
  const val = e.target.value.trim();
  setOfferPreview(val ? mediaSrc(val) : editingOffer?.image ? mediaSrc(editingOffer.image) : null);
});

offerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(offerForm, '');
  const fd = new FormData(offerForm);
  if (!fd.get('image')?.size) fd.delete('image');
  if ($('#of-available').checked) fd.set('available', 'on');
  else fd.delete('available');

  try {
    await busy($('button[type="submit"]', offerForm), () => adminApi(
      editingOffer ? `/offers/${editingOffer.id}` : '/offers',
      { method: editingOffer ? 'PUT' : 'POST', form: fd },
    ));
    offerDialog.close();
    toast(editingOffer ? 'Offer updated.' : 'Offer added.');
    load();
  } catch (err) {
    formError(offerForm, err.message);
  }
});

// ---------- List Events ----------

$('#add-offer-btn')?.addEventListener('click', () => openOfferModal());
$('#jump-settings-slogan')?.addEventListener('click', () => {
  $('[data-tab="settings"]')?.click();
  setTimeout(() => $('#s-slogan')?.focus(), 80);
});

$('#offers-list')?.addEventListener('click', async (e) => {
  if (e.target.closest('[data-add-offer]')) return openOfferModal();
  const edit = offers.find((o) => o.id === Number(e.target.closest('[data-offer-edit]')?.dataset.offerEdit));
  if (edit) return openOfferModal(edit);

  const del = offers.find((o) => o.id === Number(e.target.closest('[data-offer-delete]')?.dataset.offerDelete));
  if (del) {
    if (!confirm(`Delete offer "${del.title}"?`)) return;
    try {
      await adminApi(`/offers/${del.id}`, { method: 'DELETE' });
      toast('Offer deleted.');
      load();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

$('#offers-list')?.addEventListener('change', async (e) => {
  const toggle = e.target.closest('[data-offer-toggle]');
  if (!toggle) return;
  const o = offers.find((x) => x.id === Number(toggle.dataset.offerToggle));
  if (!o) return;
  const fd = new FormData();
  fd.append('title', o.title);
  fd.append('subtitle', o.subtitle || '');
  fd.append('badge', o.badge || '');
  fd.append('cta_text', o.cta_text || 'Explore');
  fd.append('target_type', o.target_type || 'category');
  fd.append('target_value', o.target_value || '');
  fd.append('sort_order', String(o.sort_order || 0));
  if (o.image && (o.image.startsWith('/') || o.image.startsWith('http'))) fd.append('image_url', o.image);
  if (toggle.checked) fd.append('available', 'on');
  try {
    await adminApi(`/offers/${o.id}`, { method: 'PUT', form: fd });
    toast(toggle.checked ? 'Offer is shown on Menu.' : 'Offer hidden.');
  } catch (err) {
    toast(err.message, true);
  }
  load();
});

$('#featured-summary')?.addEventListener('click', async (e) => {
  const goTab = e.target.closest('[data-go-tab]');
  if (goTab) {
    $(`[data-tab="${goTab.dataset.goTab}"]`)?.click();
    return;
  }
  const unfeat = e.target.closest('[data-unfeature]');
  if (!unfeat) return;
  const item = menuItems.find((m) => m.id === Number(unfeat.dataset.unfeature));
  if (!item) return;
  const fd = new FormData();
  fd.append('name', item.name);
  fd.append('description', item.description || '');
  fd.append('category', item.category);
  fd.append('price', (Number(item.price_cents || 0) / 100).toFixed(2));
  if (item.compare_price_cents) fd.append('compare_price', (Number(item.compare_price_cents) / 100).toFixed(2));
  fd.append('offer_badge', item.offer_badge || '');
  fd.append('sort_order', String(item.sort_order || 0));
  fd.append('options', JSON.stringify(item.options || []));
  if (item.available) fd.append('available', 'on');
  try {
    await adminApi(`/menu-items/${item.id}`, { method: 'PUT', form: fd });
    toast(`${item.name} removed from slider.`);
    load();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- Onboarding Slides Form & Actions ----------

const slideForm = $('#slide-form');
const slideError = $('#slide-error');

$('[data-slide-presets]')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-preset-url]');
  if (!btn) return;
  $('#sl-url').value = btn.dataset.presetUrl;
  $('#sl-type').value = /\.(mp4|webm|mov)$/i.test(btn.dataset.presetUrl) ? 'video' : 'image';
  if (!$('#sl-caption').value.trim()) {
    $('#sl-caption').value = PRESET_SLIDES.find((p) => p.value === btn.dataset.presetUrl)?.label.replace(/\s+\(MP4\)|\s+Photo/g, '') || '';
  }
});

slideForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  slideError.hidden = true;
  const fd = new FormData(slideForm);
  if (!fd.get('media')?.size) fd.delete('media');
  if (!fd.get('media') && !String(fd.get('media_url') || '').trim()) {
    slideError.textContent = 'Please upload a photo/video or choose a preset path / URL.';
    slideError.hidden = false;
    return;
  }

  try {
    await busy($('button[type="submit"]', slideForm), () => adminApi('/onboarding', { method: 'POST', form: fd }));
    slideForm.reset();
    toast('Background slide added to the start screen.');
    load();
  } catch (err) {
    slideError.textContent = err.message;
    slideError.hidden = false;
  }
});

$('#slides-list')?.addEventListener('change', async (e) => {
  const capInput = e.target.closest('[data-slide-caption]');
  const sortInput = e.target.closest('[data-slide-sort]');
  const toggle = e.target.closest('[data-slide-toggle]');
  const id = Number((capInput || sortInput || toggle)?.dataset[capInput ? 'slideCaption' : sortInput ? 'slideSort' : 'slideToggle']);
  if (!id) return;
  const slide = slides.find((s) => s.id === id);
  if (!slide) return;

  const body = {
    caption: capInput ? capInput.value : slide.caption,
    sort_order: sortInput ? Number(sortInput.value || 0) : slide.sort_order,
    available: toggle ? toggle.checked : Boolean(slide.available),
  };

  try {
    const updated = await adminApi(`/onboarding/${slide.id}`, { method: 'PUT', body });
    Object.assign(slide, updated);
    if (toggle || sortInput) renderSlides();
    toast('Slide updated.');
  } catch (err) {
    toast(err.message, true);
  }
});

$('#slides-list')?.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-slide-delete]');
  if (!del) return;
  if (!confirm('Remove this background slide from the start screen?')) return;
  try {
    await adminApi(`/onboarding/${del.dataset.slideDelete}`, { method: 'DELETE' });
    toast('Slide deleted.');
    load();
  } catch (err) {
    toast(err.message, true);
  }
});
