import { $, esc, adminApi, toast, formError, busy, errorBlock, emptyCard } from './core.js';

let faqs = [];

export async function load() {
  try {
    faqs = await adminApi('/faqs');
  } catch (err) {
    if (err.status !== 401) $('#faq-list').innerHTML = errorBlock(err);
    return;
  }
  render();
}

function render() {
  $('#faq-list').innerHTML = faqs.length
    ? `<div class="card list-card">${faqs.map((f) => `
        <div class="row no-thumb ${f.available ? '' : 'is-hidden'}">
          <div class="row-main">
            <div class="name">${esc(f.question)} ${f.available ? '' : '<span class="pill">Hidden</span>'}</div>
            <div class="desc">${esc(f.answer.length > 160 ? `${f.answer.slice(0, 160)}…` : f.answer)}</div>
          </div>
          <span></span>
          <div class="row-actions">
            <label class="switch"><input type="checkbox" data-toggle="${f.id}" ${f.available ? 'checked' : ''}> Shown</label>
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${f.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete="${f.id}">Delete</button>
          </div>
        </div>`).join('')}</div>`
    : emptyCard('❓', 'No questions yet.', '<button type="button" class="btn btn-gold btn-sm" data-add>+ Add question</button>');
}

const dialog = $('#faq-dialog');
const form = $('#faq-form');
let editing = null;

function open(faq = null) {
  editing = faq;
  form.reset();
  formError(form, '');
  $('#faq-dialog-title').textContent = faq ? 'Edit question' : 'Add question';
  $('#f-question').value = faq?.question ?? '';
  $('#f-answer').value = faq?.answer ?? '';
  $('#f-sort').value = faq?.sort_order ?? faqs.length;
  $('#f-available').checked = faq ? Boolean(faq.available) : true;
  dialog.showModal();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(form, '');
  const data = Object.fromEntries(new FormData(form));
  data.available = $('#f-available').checked;
  try {
    await busy($('button[type="submit"]', form), () => adminApi(
      editing ? `/faqs/${editing.id}` : '/faqs',
      { method: editing ? 'PUT' : 'POST', body: data },
    ));
    dialog.close();
    toast(editing ? 'Question updated.' : 'Question added.');
    load();
  } catch (err) {
    formError(form, err.message);
  }
});

$('#add-faq-btn').addEventListener('click', () => open());

$('#faq-list').addEventListener('click', async (e) => {
  if (e.target.closest('[data-add]')) return open();
  const find = (attr) => faqs.find((f) => f.id === Number(e.target.closest(`[${attr}]`)?.getAttribute(attr)));
  const edit = find('data-edit');
  if (edit) return open(edit);
  const del = find('data-delete');
  if (del) {
    if (!confirm(`Delete "${del.question}"?`)) return;
    try {
      await adminApi(`/faqs/${del.id}`, { method: 'DELETE' });
      toast('Question deleted.');
      load();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

$('#faq-list').addEventListener('change', async (e) => {
  const toggle = e.target.closest('[data-toggle]');
  if (!toggle) return;
  const f = faqs.find((x) => x.id === Number(toggle.dataset.toggle));
  try {
    await adminApi(`/faqs/${f.id}`, { method: 'PUT', body: { ...f, available: toggle.checked } });
    toast(toggle.checked ? 'Question is shown.' : 'Question is hidden.');
  } catch (err) {
    toast(err.message, true);
  }
  load();
});
