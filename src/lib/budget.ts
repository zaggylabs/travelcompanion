import { CATEGORIES, type Category, type Trip } from "./types";

export interface CategorySummary {
  category: Category;
  /** Limit the traveler set, or null if none. */
  budget: number | null;
  /** Sum of estimated costs in the itinerary. */
  planned: number;
  /** Sum of actual costs paid so far. */
  spent: number;
  /** Expected final cost: actual where paid, otherwise the estimate. */
  projected: number;
}

export interface BudgetSummary {
  categories: CategorySummary[];
  totalBudget: number;
  totalPlanned: number;
  totalSpent: number;
  totalProjected: number;
  /** totalBudget - totalProjected; only meaningful when a budget is set. */
  remaining: number;
  projectedPerPerson: number;
  projectedPerDay: number | null;
  /** Projected cost for each dated day, unscheduled items under "". */
  byDay: Record<string, number>;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function summarizeBudget(trip: Trip, dayCount: number): BudgetSummary {
  const byDay: Record<string, number> = {};
  const categories = CATEGORIES.map<CategorySummary>((category) => ({
    category,
    budget: trip.budget[category] ?? null,
    planned: 0,
    spent: 0,
    projected: 0,
  }));
  const byCat = new Map(categories.map((c) => [c.category, c]));

  for (const item of trip.items) {
    const row = byCat.get(item.category) ?? byCat.get("Other")!;
    const projected = item.actualCost ?? item.estimatedCost;
    row.planned += item.estimatedCost;
    row.spent += item.actualCost ?? 0;
    row.projected += projected;
    byDay[item.date] = (byDay[item.date] ?? 0) + projected;
  }

  for (const c of categories) {
    c.planned = round(c.planned);
    c.spent = round(c.spent);
    c.projected = round(c.projected);
  }
  for (const k of Object.keys(byDay)) byDay[k] = round(byDay[k]);

  const sum = (f: (c: CategorySummary) => number) => round(categories.reduce((a, c) => a + f(c), 0));
  const totalBudget = sum((c) => c.budget ?? 0);
  const totalProjected = sum((c) => c.projected);
  return {
    categories,
    totalBudget,
    totalPlanned: sum((c) => c.planned),
    totalSpent: sum((c) => c.spent),
    totalProjected,
    remaining: round(totalBudget - totalProjected),
    projectedPerPerson: round(totalProjected / Math.max(1, trip.travelers)),
    projectedPerDay: dayCount > 0 ? round(totalProjected / dayCount) : null,
    byDay,
  };
}
