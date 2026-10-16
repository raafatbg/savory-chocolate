import { $, esc, adminApi, toast, busy, errorBlock, emptyCard } from './core.js';

let photos = [];

export async function load() {
  try {
    photos = await adminApi('/gallery');
  } catch (err) {
    if (err.status !== 401) $('#gallery-list').innerHTML = errorBlock(err);
    return;
  }
  render();
}

function render() {
  $('#gallery-list').innerHTML = photos.length
    ? `<div class="photo-grid">${photos.map((p) => `
        <div class="card photo">
          <img src="/uploads/${esc(p.image)}" alt="${esc(p.caption)}" loading="lazy">
          <div class="photo-body">
            <input type="text" value="${esc(p.caption)}" maxlength="200" placeholder="Add a caption" data-caption="${p.id}" aria-label="Caption">
            <button type="button" class="icon-btn" data-delete="${p.id}" aria-label="Delete photo" title="Delete photo">✕</button>
          </div>
        </div>`).join('')}</div>`
    : emptyCard('📷', 'No photos yet. Upload your best cakes to fill the Gallery page.');
}

const form = $('#gallery-upload');
const errorBox = $('#gallery-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  const files = [...$('#g-files').files];
  if (!files.length) return;
  const caption = $('#g-caption').value;
  const failed = [];

  await busy($('button[type="submit"]', form), async () => {
    for (const file of files) {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('caption', caption);
      try {
        await adminApi('/gallery', { method: 'POST', form: fd });
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`);
      }
    }
  });

  const uploaded = files.length - failed.length;
  if (uploaded) toast(`${uploaded} photo${uploaded === 1 ? '' : 's'} added to the gallery.`);
  if (failed.length) {
    errorBox.textContent = failed.join(' ');
    errorBox.hidden = false;
  }
  form.reset();
  load();
});

// Captions save when you leave the field.
$('#gallery-list').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-caption]');
  if (!input) return;
  const photo = photos.find((p) => p.id === Number(input.dataset.caption));
  try {
    await adminApi(`/gallery/${photo.id}`, { method: 'PUT', body: { caption: input.value, sort_order: photo.sort_order } });
    photo.caption = input.value;
    toast('Caption saved.');
  } catch (err) {
    toast(err.message, true);
  }
});

$('#gallery-list').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-delete]');
  if (!del) return;
  if (!confirm('Delete this photo from the gallery? This can\'t be undone.')) return;
  try {
    await adminApi(`/gallery/${del.dataset.delete}`, { method: 'DELETE' });
    toast('Photo deleted.');
    load();
  } catch (err) {
    toast(err.message, true);
  }
});
