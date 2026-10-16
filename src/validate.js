export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (message) => new HttpError(400, message);

export function text(value, label, { max = 200, required = false } = {}) {
  const s = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (required && !s) throw bad(`${label} is required.`);
  if (s.length > max) throw bad(`${label} must be ${max} characters or fewer.`);
  return s;
}

export function int(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} is not valid.`);
  return n;
}

// Accepts "12.50", "12", 12.5 → 1250 cents.
export function money(value, label) {
  const s = String(value ?? '').trim().replace(/^\$/, '');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) throw bad(`${label} must be a number like 12.50.`);
  return Math.round(parseFloat(s) * 100);
}

export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

export function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function pickupDate(value, { minDaysAhead = 0 } = {}) {
  const s = text(value, 'Date', { required: true, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw bad('Date is not valid.');
  const earliest = localDate(minDaysAhead);
  if (s < earliest) {
    throw bad(minDaysAhead > 0
      ? `Please choose a date on or after ${earliest} (we need ${minDaysAhead} day${minDaysAhead === 1 ? '' : 's'} to prepare custom cakes).`
      : 'Date can\'t be in the past.');
  }
  if (s > localDate(180)) throw bad('Date is too far ahead.');
  return s;
}

// Same-day pickups need at least 30 minutes' notice.
export function pickupTime(value, date) {
  const s = text(value, 'Time', { required: true, max: 5 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw bad('Time is not valid.');
  if (date === localDate(0)) {
    const soon = new Date(Date.now() + 30 * 60 * 1000);
    const earliest = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;
    if (soon.getDate() !== new Date().getDate()) throw bad('It\'s too late for today. Please choose another day.');
    if (s < earliest) throw bad(`For today, please choose a time after ${earliest}.`);
  }
  return s;
}

export function customer(body) {
  const email = text(body.customer_email, 'Email', { max: 200 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Email address is not valid.');
  const phone = text(body.customer_phone, 'Phone', { required: true, max: 40 });
  if (phone.replace(/\D/g, '').length < 6) throw bad('Phone number is not valid.');
  return {
    name: text(body.customer_name, 'Name', { required: true, max: 100 }),
    phone,
    email,
  };
}

// Pickup or delivery. Returns { fulfillment, address, fee_cents } and checks the delivery minimum.
export function fulfillment(body, settings, subtotalCents) {
  if (body.fulfillment !== 'delivery') return { fulfillment: 'pickup', address: '', fee_cents: 0 };
  if (settings.delivery_enabled !== '1') throw bad('Sorry, we\'re not offering delivery right now. Please choose pickup.');
  const address = text(body.delivery_address, 'Delivery address', { required: true, max: 300 });
  const minimum = Number(settings.delivery_min) || 0;
  if (subtotalCents < minimum) {
    throw bad(`Delivery needs a minimum order of ${(minimum / 100).toFixed(2)}. Please add a little more or choose pickup.`);
  }
  return { fulfillment: 'delivery', address, fee_cents: Number(settings.delivery_fee) || 0 };
}

export function hexColor(value, label) {
  const s = text(value, label, { max: 7 });
  if (s && !/^#[0-9a-fA-F]{6}$/.test(s)) throw bad(`${label} must be a color like #f1c1c4.`);
  return s.toLowerCase();
}

export function url(value, label) {
  const s = text(value, label, { max: 300 });
  if (s && !/^https:\/\/[^\s"'<>]+$/.test(s)) throw bad(`${label} must be a full link starting with https://`);
  return s;
}

export function email(value, label = 'Email', { required = false } = {}) {
  const s = text(value, label, { max: 200, required });
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(`${label} address is not valid.`);
  return s;
}
