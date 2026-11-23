export const CATEGORIES = ["Flights", "Lodging", "Transport", "Food", "Activities", "Shopping", "Other"];

export const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "MYR", "IDR", "THB", "JPY", "KRW", "AUD", "CAD", "INR", "CHF", "AED", "MXN"];

export function isCategory(value) {
  return CATEGORIES.includes(value);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
