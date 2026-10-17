// Turns a placed order into a WhatsApp message for the shop. The customer's phone opens WhatsApp
// with this text ready to send to the chosen branch (wa.me click-to-chat links can't send by themselves).
import { CAKE_GROUPS } from './cake-groups.js';

const LABELS = { ...Object.fromEntries(CAKE_GROUPS.map((g) => [g.key, g.label])), message: 'Message on cake' };

export function whatsappLink(number, text) {
  const digits = String(number || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '';
}

export function orderMessage({ type, order, who, lines, notes, branch, photoUrl, currency }) {
  const money = (cents) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const [y, m, d] = order.pickup_date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const [hh, mm] = order.pickup_time.split(':').map(Number);
  const time = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  const delivery = order.fulfillment === 'delivery';

  const out = [`*New ${type === 'cake' ? 'cake' : 'menu'} order* · ${order.code}`];
  if (branch) out.push(`Branch: ${branch.name}`);
  out.push('', '*Customer*', `Name: ${who.name}`, `Phone: ${who.phone}`);
  if (who.email) out.push(`Email: ${who.email}`);
  out.push('', `*${delivery ? 'Delivery' : 'Pickup'}:* ${day} at ${time}`);
  if (delivery) out.push(`Address: ${order.delivery_address}`);
  out.push('');

  if (type === 'cake') {
    out.push('*Cake*');
    for (const [key, value] of Object.entries(lines[0].details || {})) {
      out.push(`• ${LABELS[key] || key}: ${key === 'message' ? `“${value}”` : value}`);
    }
  } else {
    out.push('*Order*');
    for (const l of lines) {
      const choices = Object.values(l.details || {}).join(' · ');
      out.push(`• ${l.quantity} × ${l.name}${choices ? ` (${choices})` : ''}: ${money(l.unit_price_cents * l.quantity)}`);
    }
  }

  if (notes) out.push('', `${type === 'cake' ? 'Design notes' : 'Notes'}: ${notes}`);
  if (photoUrl) out.push('', `Inspiration photo: ${photoUrl}`);
  out.push('');
  if (order.delivery_fee_cents) out.push(`Delivery fee: ${money(order.delivery_fee_cents)}`);
  out.push(`*Total: ${money(order.total_cents)}* (pay on ${delivery ? 'delivery' : 'pickup'})`);
  return out.join('\n');
}
