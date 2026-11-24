import { CATEGORIES } from "./constants.js";
import { round2 } from "./money.js";
import { budgetEntries } from "./bookings.js";

/** What an item will end up costing: the actual amount once paid, otherwise the estimate. */
export const expectedCost = (item) => (item.actualCost ?? item.estimatedCost) || 0;

/** Ticked off as paid. Plans saved before the checkbox existed count as paid when they have an actual cost. */
export const isPaid = (item) => item.paid ?? (item.actualCost !== null && item.actualCost !== undefined);

/** What ticking (or unticking) "paid" does to a plan: an empty actual cost takes the estimate. */
export const setPaid = (item, paid) => ({ ...item, paid, actualCost: paid && (item.actualCost === null || item.actualCost === undefined) ? item.estimatedCost || 0 : item.actualCost });

/** The currency a plan's costs are in. Plans without one are in the trip's currency. */
export const itemCurrency = (item, trip) => item.currency || trip.currency;

const sameOnly = (amount, from, to) => (from === to ? amount : null);

/**
 * Totals for the budget, all in the trip's currency (`trip.currency`).
 * Plans can be in other currencies (a multi-country trip, or a flight paid at home):
 * `convert(amount, from, to)` turns them into the trip's currency, and returns null
 * when there's no rate. Those plans are left out of the totals and listed in `unconverted`.
 * `byCurrency` has each currency's expected total in its own money, for "made up of" lines.
 */
export function summarizeBudget(trip, dayCount, convert = sameOnly) {
  const byDay = {};
  const categories = CATEGORIES.map((category) => ({
    category,
    budget: trip.budget?.[category] ?? null,
    planned: 0,
    spent: 0,
    projected: 0,
  }));
  const byCat = new Map(categories.map((c) => [c.category, c]));

  const byCurrency = {};
  const unconverted = new Set();
  // A plan that uses a booking is counted through the booking, once.
  for (const item of budgetEntries(trip)) {
    const cur = itemCurrency(item, trip);
    const exp = expectedCost(item);
    const rate = cur === trip.currency ? 1 : convert(1, cur, trip.currency);
    if (exp > 0 || item.estimatedCost > 0) byCurrency[cur] = (byCurrency[cur] ?? 0) + exp;
    if (rate === null || rate === undefined || !Number.isFinite(rate)) {
      if (exp > 0 || item.estimatedCost > 0) unconverted.add(cur);
      continue;
    }
    const row = byCat.get(item.category) ?? byCat.get("Other");
    row.planned += (item.estimatedCost || 0) * rate;
    row.spent += isPaid(item) ? exp * rate : 0;
    row.projected += exp * rate;
    byDay[item.date] = (byDay[item.date] ?? 0) + exp * rate;
  }
  for (const k of Object.keys(byCurrency)) byCurrency[k] = round2(byCurrency[k]);
  for (const c of categories) {
    c.planned = round2(c.planned);
    c.spent = round2(c.spent);
    c.projected = round2(c.projected);
  }
  for (const k of Object.keys(byDay)) byDay[k] = round2(byDay[k]);

  const sum = (f) => round2(categories.reduce((a, c) => a + f(c), 0));
  const totalBudget = sum((c) => c.budget ?? 0);
  const totalProjected = sum((c) => c.projected);
  return {
    categories,
    totalBudget,
    totalPlanned: sum((c) => c.planned),
    totalSpent: sum((c) => c.spent),
    totalProjected,
    remaining: round2(totalBudget - totalProjected),
    projectedPerPerson: round2(totalProjected / Math.max(1, trip.travelers || 1)),
    projectedPerDay: dayCount > 0 ? round2(totalProjected / dayCount) : null,
    byDay,
    byCurrency,
    unconverted: [...unconverted],
  };
}
