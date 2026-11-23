export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN", "INR", "CHF", "SGD", "AED", "THB"];

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Parses "$1,234.50", "1.234,50 €", "(20)" etc. Returns null when there's no number. */
export function parseMoney(value: string): number | null {
  let v = value.trim();
  if (!v) return null;
  const negative = /^\(.*\)$/.test(v) || v.startsWith("-");
  v = v.replace(/[^\d.,]/g, "");
  if (!v) return null;
  const lastDot = v.lastIndexOf(".");
  const lastComma = v.lastIndexOf(",");
  if (lastComma > lastDot && v.length - lastComma - 1 !== 3) {
    // comma is the decimal separator: 1.234,50
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    v = v.replace(/,/g, "");
  }
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}
