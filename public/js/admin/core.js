// Shared helpers for the admin dashboard modules.
import { api } from '/js/common.js';

export { esc, money, isoDate, friendlyTime, loadSettings } from '/js/common.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Set by main.js: shows the login form when a session expires.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function adminApi(path, options) {
  try {
    return await api(`/api/admin${path}`, options);
  } catch (err) {
    if (err.status === 401) onUnauthorized();
    throw err;
  }
}

export function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function formError(form, message) {
  const box = $('.form-error', form) || $('#auth-error');
  box.textContent = message || '';
  box.hidden = !message;
}

export async function busy(button, work) {
  const label = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.innerHTML = label;
  }
}

export const cents = (value) => (Number(value || 0) / 100).toFixed(2);

export function errorBlock(err) {
  return `<p class="alert alert-error">${String(err.message).replace(/[<>&]/g, '')}</p>`;
}

export function emptyCard(icon, text, button = '') {
  return `<div class="card empty-card"><div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><p>${text}</p>${button}</div>`;
}

// Close buttons and backdrop clicks for every dialog.
for (const dialog of $$('dialog')) {
  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
  });
}
