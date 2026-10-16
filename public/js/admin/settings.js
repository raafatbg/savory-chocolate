import { $, adminApi, toast, formError, busy, cents, loadSettings } from './core.js';

const settingsForm = $('#settings-form');
const passwordForm = $('#password-form');
const MONEY_FIELDS = ['delivery_fee', 'delivery_min'];
let state = null;

export function load(appState) {
  state = appState;
  const s = state.settings;
  for (const el of settingsForm.elements) {
    if (!el.name || !(el.name in s)) continue;
    if (el.type === 'checkbox') el.checked = s[el.name] === '1';
    else if (MONEY_FIELDS.includes(el.name)) el.value = cents(s[el.name]);
    else el.value = s[el.name];
  }
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(settingsForm, '');
  const body = Object.fromEntries(new FormData(settingsForm));
  body.orders_open = $('#s-orders_open').checked;
  body.delivery_enabled = $('#s-delivery_enabled').checked;
  try {
    await busy($('button[type="submit"]', settingsForm), () => adminApi('/settings', { method: 'PUT', body }));
    state.settings = await loadSettings();
    load(state);
    toast('Settings saved.');
  } catch (err) {
    formError(settingsForm, err.message);
  }
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError(passwordForm, '');
  if (passwordForm.new_password.value !== passwordForm.confirm.value) {
    formError(passwordForm, 'The new passwords don\'t match.');
    return;
  }
  try {
    await busy($('button[type="submit"]', passwordForm), () => adminApi('/password', {
      method: 'POST',
      body: { current_password: passwordForm.current_password.value, new_password: passwordForm.new_password.value },
    }));
    passwordForm.reset();
    toast('Password updated.');
  } catch (err) {
    formError(passwordForm, err.message);
  }
});
