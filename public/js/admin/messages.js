import { $, esc, adminApi, toast, errorBlock, emptyCard } from './core.js';

let messages = [];
let shopName = '';

export async function load(state) {
  shopName = state.settings.shop_name || '';
  try {
    messages = await adminApi('/messages');
  } catch (err) {
    if (err.status !== 401) $('#messages-list').innerHTML = errorBlock(err);
    return;
  }
  render();
}

function render() {
  $('#messages-list').innerHTML = messages.length
    ? `<div class="messages">${messages.map((m) => {
      const when = new Date(m.created_at.replace(' ', 'T') + 'Z')
        .toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const subject = encodeURIComponent(`Re: your message to ${shopName}`);
      return `
        <article class="card message ${m.is_read ? '' : 'unread'}">
          <div class="message-head">
            <div>
              <span class="from">${esc(m.name)}</span>
              ${m.is_read ? '' : '<span class="pill today" style="margin-left: 6px;">New</span>'}
              <div class="small"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ` · <a href="tel:${esc(m.phone.replace(/[^\d+]/g, ''))}">${esc(m.phone)}</a>` : ''}</div>
            </div>
            <span class="muted small">${esc(when)}</span>
          </div>
          <p class="message-body">${esc(m.message)}</p>
          <div class="message-actions">
            <a class="btn btn-gold btn-sm" href="mailto:${esc(m.email)}?subject=${subject}" data-reply="${m.id}">Reply by email</a>
            <button type="button" class="btn btn-outline btn-sm" data-toggle-read="${m.id}">${m.is_read ? 'Mark as unread' : 'Mark as read'}</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete="${m.id}">Delete</button>
          </div>
        </article>`;
    }).join('')}</div>`
    : emptyCard('✉️', 'No messages yet. Messages sent from the Contact page will appear here.');
}

async function setRead(message, isRead) {
  try {
    await adminApi(`/messages/${message.id}`, { method: 'PATCH', body: { is_read: isRead } });
    message.is_read = isRead ? 1 : 0;
    render();
    document.dispatchEvent(new Event('admin:changed'));
  } catch (err) {
    toast(err.message, true);
  }
}

$('#messages-list').addEventListener('click', async (e) => {
  const find = (attr) => messages.find((m) => m.id === Number(e.target.closest(`[${attr}]`)?.getAttribute(attr)));

  const reply = find('data-reply');
  if (reply && !reply.is_read) setRead(reply, true);

  const toggle = find('data-toggle-read');
  if (toggle) setRead(toggle, !toggle.is_read);

  const del = find('data-delete');
  if (del) {
    if (!confirm(`Delete the message from ${del.name}? This can't be undone.`)) return;
    try {
      await adminApi(`/messages/${del.id}`, { method: 'DELETE' });
      messages = messages.filter((m) => m !== del);
      render();
      toast('Message deleted.');
      document.dispatchEvent(new Event('admin:changed'));
    } catch (err) {
      toast(err.message, true);
    }
  }
});
