import { $, esc, adminApi, toast, formError, busy, errorBlock } from './core.js';

let branches = [];

export async function loadBranches() {
  try {
    branches = await adminApi('/branches');
  } catch (err) {
    if (err.status !== 401) $('#branches-list').innerHTML = errorBlock(err);
    return;
  }
  render();
}

function render() {
  $('#branches-list').innerHTML = branches.length
    ? branches.map((b) => `
      <div class="row no-thumb ${b.available ? '' : 'is-hidden'}">
        <div class="row-main">
          <div class="name">${esc(b.name)} ${b.available ? '' : '<span class="pill">Hidden</span>'}</div>
          <div class="desc">${[b.address, b.phone && `☎ ${b.phone}`, b.whatsapp && `WhatsApp ${b.whatsapp}`].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <span></span>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit="${b.id}">Edit</button>
          <button type="button" class="btn btn-danger btn-sm" data-delete="${b.id}">Delete</button>
        </div>
      </div>`).join('')
    : '<p class="muted small" style="padding: 10px 0 0;">No branches yet. Orders go to the WhatsApp number in Shop details.</p>';
}

const dialog = $('#branch-dialog');
const form = $('#branch-form');
let editing = null;

function open(branch = null) {
  editing = branch;
  form.reset();
  formError(form, '');
  $('#branch-dialog-title').textContent = branch ? 'Edit branch' : 'Add branch';
  $('#b-name').value = branch?.name ?? '';
  $('#b-address').value = branch?.address ?? '';
  $('#b-phone').value = branch?.phone ?? '';
  $('#b-whatsapp').value = branch?.whatsapp ?? '';
  $('#b-maps').value = branch?.maps_link ?? '';
  $('#b-sort').value = branch?.sort_order ?? branches.length;
  $('#b-available').checked = branch ? Boolean(branch.available) : true;
  dialog.showModal();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(form, '');
  const data = Object.fromEntries(new FormData(form));
  data.available = $('#b-available').checked;
  try {
    await busy($('button[type="submit"]', form), () => adminApi(
      editing ? `/branches/${editing.id}` : '/branches',
      { method: editing ? 'PUT' : 'POST', body: data },
    ));
    dialog.close();
    toast(editing ? 'Branch updated.' : 'Branch added.');
    loadBranches();
  } catch (err) {
    formError(form, err.message);
  }
});

$('#add-branch-btn').addEventListener('click', () => open());

$('#branches-list').addEventListener('click', async (e) => {
  const find = (attr) => branches.find((b) => b.id === Number(e.target.closest(`[${attr}]`)?.getAttribute(attr)));
  const edit = find('data-edit');
  if (edit) return open(edit);
  const del = find('data-delete');
  if (del) {
    if (!confirm(`Delete the ${del.name} branch? Past orders keep their branch name.`)) return;
    try {
      await adminApi(`/branches/${del.id}`, { method: 'DELETE' });
      toast('Branch deleted.');
      loadBranches();
    } catch (err) {
      toast(err.message, true);
    }
  }
});
