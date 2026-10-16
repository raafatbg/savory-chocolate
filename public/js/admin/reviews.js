import { $, esc, adminApi, toast, formError, busy, errorBlock, emptyCard } from './core.js';

let reviews = [];

export async function load() {
  try {
    reviews = await adminApi('/reviews');
  } catch (err) {
    if (err.status !== 401) $('#reviews-list').innerHTML = errorBlock(err);
    return;
  }
  render();
}

function render() {
  $('#reviews-list').innerHTML = reviews.length
    ? `<div class="card list-card">${reviews.map((r) => `
        <div class="row no-thumb ${r.available ? '' : 'is-hidden'}">
          <div class="row-main">
            <div class="name"><span style="color: #c9952f;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> ${esc(r.name)} ${r.available ? '' : '<span class="pill">Hidden</span>'}</div>
            <div class="desc">“${esc(r.text)}”</div>
          </div>
          <span></span>
          <div class="row-actions">
            <label class="switch"><input type="checkbox" data-toggle="${r.id}" ${r.available ? 'checked' : ''}> Shown</label>
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${r.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete="${r.id}">Delete</button>
          </div>
        </div>`).join('')}</div>`
    : emptyCard('⭐', 'No reviews yet. When happy customers say something lovely, add it here (with their permission) and it will appear on the home page.',
      '<button type="button" class="btn btn-gold btn-sm" data-add>+ Add review</button>');
}

const dialog = $('#review-dialog');
const form = $('#review-form');
let editing = null;

function open(review = null) {
  editing = review;
  form.reset();
  formError(form, '');
  $('#review-dialog-title').textContent = review ? 'Edit review' : 'Add review';
  $('#r-name').value = review?.name ?? '';
  $('#r-rating').value = String(review?.rating ?? 5);
  $('#r-text').value = review?.text ?? '';
  $('#r-sort').value = review?.sort_order ?? 0;
  $('#r-available').checked = review ? Boolean(review.available) : true;
  dialog.showModal();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(form, '');
  const data = Object.fromEntries(new FormData(form));
  data.available = $('#r-available').checked;
  try {
    await busy($('button[type="submit"]', form), () => adminApi(
      editing ? `/reviews/${editing.id}` : '/reviews',
      { method: editing ? 'PUT' : 'POST', body: data },
    ));
    dialog.close();
    toast(editing ? 'Review updated.' : 'Review added.');
    load();
  } catch (err) {
    formError(form, err.message);
  }
});

$('#add-review-btn').addEventListener('click', () => open());

$('#reviews-list').addEventListener('click', async (e) => {
  if (e.target.closest('[data-add]')) return open();
  const find = (attr) => reviews.find((r) => r.id === Number(e.target.closest(`[${attr}]`)?.getAttribute(attr)));
  const edit = find('data-edit');
  if (edit) return open(edit);
  const del = find('data-delete');
  if (del) {
    if (!confirm(`Delete the review from ${del.name}?`)) return;
    try {
      await adminApi(`/reviews/${del.id}`, { method: 'DELETE' });
      toast('Review deleted.');
      load();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

$('#reviews-list').addEventListener('change', async (e) => {
  const toggle = e.target.closest('[data-toggle]');
  if (!toggle) return;
  const r = reviews.find((x) => x.id === Number(toggle.dataset.toggle));
  try {
    await adminApi(`/reviews/${r.id}`, { method: 'PUT', body: { ...r, available: toggle.checked } });
    toast(toggle.checked ? 'Review is shown on the site.' : 'Review is hidden.');
  } catch (err) {
    toast(err.message, true);
  }
  load();
});
