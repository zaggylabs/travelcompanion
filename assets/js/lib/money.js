export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

/** "$1,234.50", "1.234,50 €", "(20)" -> number; null when there's no number. */
export function parseMoney(value) {
  let v = String(value ?? "").trim();
  if (!v) return null;
  const negative = /^\(.*\)$/.test(v) || v.startsWith("-");
  v = v.replace(/[^\d.,]/g, "");
  if (!v) return null;
  const lastDot = v.lastIndexOf(".");
  const lastComma = v.lastIndexOf(",");
  if (lastComma > lastDot && v.length - lastComma - 1 !== 3) {
    v = v.replace(/\./g, "").replace(",", "."); // 1.234,50
  } else {
    v = v.replace(/,/g, "");
  }
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

export const round2 = (n) => Math.round(n * 100) / 100;
