export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Every ISO date from start to end inclusive. [] if either is missing or end < start. */
export function daysBetween(start, end, maxDays = 366) {
  if (!isIsoDate(start) || !isIsoDate(end)) return [];
  const days = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last && days.length < maxDays) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** "Mon, Jun 15". Formatted in UTC so it never shifts a day. */
export function formatDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

/**
 * Date formats people have in spreadsheets -> ISO, or "" if unclear.
 * Slash dates are day/month/year unless the second number is over 12
 * (then month/day/year), matching how most of the world writes dates.
 */
export function parseLooseDate(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (isIsoDate(v)) return v;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

/** "9:30 pm" -> "21:30", "0930" -> "09:30", "" if unrecognized. */
export function normalizeTime(value) {
  const m = String(value ?? "").trim().toLowerCase().match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3];
  if (ampm?.startsWith("p") && h < 12) h += 12;
  if (ampm?.startsWith("a") && h === 12) h = 0;
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
