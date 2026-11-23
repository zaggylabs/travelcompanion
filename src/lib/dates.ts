/** Every ISO date from start to end inclusive. Returns [] if either is missing or end < start. */
export function daysBetween(start: string, end: string, maxDays = 366): string[] {
  if (!isIsoDate(start) || !isIsoDate(end)) return [];
  const days: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last && days.length < maxDays) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** "Mon, Jun 15" style label. Formatted in UTC so it never shifts a day. */
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Accepts the date formats people commonly have in spreadsheets and returns ISO,
 * or "" if it can't tell. Slash dates are read as month/day/year unless the first
 * number is over 12.
 */
export function parseLooseDate(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (isIsoDate(v)) return v;
  const slash = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    let [a, b] = [Number(slash[1]), Number(slash[2])];
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    if (a > 12) [a, b] = [b, a]; // day/month/year
    const iso = `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : "";
  }
  const t = Date.parse(v);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : "";
  }
  return "";
}
