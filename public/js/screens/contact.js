import { api } from '/js/common.js';
import { confetti } from '/js/confetti.js';

const form = document.getElementById('contact-form');
const error = document.getElementById('contact-error');
const button = document.getElementById('contact-submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  if (!form.reportValidity()) return;
  button.disabled = true;
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
  try {
    await api('/api/messages', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    form.hidden = true;
    document.getElementById('contact-sent').hidden = false;
    confetti({ count: 90 });
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    button.disabled = false;
    button.textContent = 'Send message';
  }
});
