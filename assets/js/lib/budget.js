import { CATEGORIES } from "./constants.js";
import { round2 } from "./money.js";

/** What an item will end up costing: the actual amount once paid, otherwise the estimate. */
export const expectedCost = (item) => (item.actualCost ?? item.estimatedCost) || 0;

/** Ticked off as paid. Plans saved before the checkbox existed count as paid when they have an actual cost. */
export const isPaid = (item) => item.paid ?? (item.actualCost !== null && item.actualCost !== undefined);

/** What ticking (or unticking) "paid" does to a plan: an empty actual cost takes the estimate. */
export const setPaid = (item, paid) => ({ ...item, paid, actualCost: paid && (item.actualCost === null || item.actualCost === undefined) ? item.estimatedCost || 0 : item.actualCost });

export function summarizeBudget(trip, dayCount) {
  const byDay = {};
  const categories = CATEGORIES.map((category) => ({
    category,
    budget: trip.budget?.[category] ?? null,
    planned: 0,
    spent: 0,
    projected: 0,
  }));
  const byCat = new Map(categories.map((c) => [c.category, c]));

  for (const item of trip.items) {
    const row = byCat.get(item.category) ?? byCat.get("Other");
    row.planned += item.estimatedCost || 0;
    row.spent += isPaid(item) ? expectedCost(item) : 0;
    row.projected += expectedCost(item);
    byDay[item.date] = (byDay[item.date] ?? 0) + expectedCost(item);
  }
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
  };
}
