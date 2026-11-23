export const CATEGORIES = [
  "Flights",
  "Lodging",
  "Transport",
  "Food",
  "Activities",
  "Shopping",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** One row of the itinerary: something happening on a given day. */
export interface ItineraryItem {
  id: string;
  /** ISO date (YYYY-MM-DD). Empty string means "not scheduled yet". */
  date: string;
  /** 24h time (HH:MM), optional. */
  time: string;
  title: string;
  location: string;
  category: Category;
  /** What you expect it to cost. */
  estimatedCost: number;
  /** What it actually cost, once paid. null = not paid yet. */
  actualCost: number | null;
  notes: string;
  link: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  /** ISO dates (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  /** ISO 4217 code, e.g. "USD". */
  currency: string;
  travelers: number;
  /** Budget limit per category. Missing = no limit set. */
  budget: Partial<Record<Category, number>>;
  items: ItineraryItem[];
  createdAt: string;
  updatedAt: string;
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
