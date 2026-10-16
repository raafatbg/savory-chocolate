// Menu item add-ons, stored as JSON on each item:
// [{ name: 'Size', type: 'single' | 'multi', required: true, choices: [{ name: 'Large', price_cents: 100 }] }]
import { bad, text, money } from './validate.js';

export function parseOptions(json) {
  try {
    const value = JSON.parse(json || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// Validates what the admin entered. Accepts prices as "1.50" strings or price_cents numbers.
export function normalizeOptions(input) {
  let groups = input;
  if (typeof input === 'string') {
    try {
      groups = JSON.parse(input || '[]');
    } catch {
      throw bad('The item options could not be read.');
    }
  }
  if (!Array.isArray(groups)) throw bad('The item options could not be read.');
  if (groups.length > 6) throw bad('An item can have at most 6 option groups.');

  return groups.map((g, gi) => {
    const name = text(g?.name, `Option group ${gi + 1} name`, { required: true, max: 40 });
    const choices = Array.isArray(g.choices) ? g.choices : [];
    if (!choices.length) throw bad(`"${name}" needs at least one choice.`);
    if (choices.length > 12) throw bad(`"${name}" can have at most 12 choices.`);
    return {
      name,
      type: g.type === 'multi' ? 'multi' : 'single',
      required: g.type !== 'multi' && Boolean(g.required),
      choices: choices.map((c, ci) => ({
        name: text(c?.name, `Choice ${ci + 1} in "${name}"`, { required: true, max: 60 }),
        price_cents: c.price !== undefined
          ? money(c.price === '' ? '0' : c.price, `Price of "${c.name || `choice ${ci + 1}`}"`)
          : Math.max(0, Math.round(Number(c.price_cents) || 0)),
      })),
    };
  });
}

// Checks a customer's picks for one cart line. `picks` has one array of choice indexes per group.
// Returns the extra cost and a readable summary like { Size: 'Large', Extras: 'Whipped cream' }.
export function priceChoices(itemName, groups, picks) {
  const stale = () => bad(`The options for "${itemName}" have changed. Please remove it from your order and add it again.`);
  if (picks !== undefined && !Array.isArray(picks)) throw stale();
  picks = picks || [];
  if (picks.length > groups.length) throw stale();

  let extra = 0;
  const summary = {};
  groups.forEach((group, gi) => {
    const chosen = Array.isArray(picks[gi]) ? [...new Set(picks[gi])] : [];
    for (const index of chosen) {
      if (!Number.isInteger(index) || index < 0 || index >= group.choices.length) throw stale();
    }
    if (group.type === 'single' && chosen.length > 1) throw stale();
    if (group.required && chosen.length === 0) throw bad(`Please choose a ${group.name.toLowerCase()} for "${itemName}".`);
    if (!chosen.length) return;
    const names = chosen.sort((a, b) => a - b).map((index) => {
      extra += group.choices[index].price_cents;
      return group.choices[index].name;
    });
    summary[group.name] = names.join(', ');
  });
  return { extra, summary };
}
