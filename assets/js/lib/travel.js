// Flight / transport plans: getting from one place to another (Singapore → Tokyo,
// Tokyo → Kyoto). They don't need the day's city, and arriving somewhere on the trip
// makes that city where you're based from then on (see dayBase in regions.js).

export const TRAVEL_MODES = [
  { key: "flight", label: "Flight", icon: "✈", category: "Flights" },
  { key: "train", label: "Train", icon: "🚆", category: "Transport" },
  { key: "bus", label: "Bus", icon: "🚌", category: "Transport" },
  { key: "ferry", label: "Ferry", icon: "⛴", category: "Transport" },
  { key: "car", label: "Car or transfer", icon: "🚗", category: "Transport" },
];
const BY_KEY = Object.fromEntries(TRAVEL_MODES.map((m) => [m.key, m]));
export const travelMode = (key) => BY_KEY[key] ?? BY_KEY.flight;

/** "Singapore → Tokyo" */
export const routeText = (t) => [t?.from, t?.to].filter(Boolean).join(" → ");

/** A title for a travel plan left untitled: "Flight SQ 12 · Singapore → Tokyo". */
export function travelTitle(t) {
  const head = [travelMode(t?.mode).label, t?.number].filter(Boolean).join(" ");
  const route = routeText(t);
  return route ? `${head} · ${route}` : head;
}

/** "SIN → HND" when the airports are known. */
export const airportRoute = (t) => (t?.fromAirport || t?.toAirport ? `${t.fromAirport || "?"} → ${t.toAirport || "?"}` : "");

/** "08:40 → 15:50 (+1)" */
export function travelTimes(item) {
  const t = item.travel ?? {};
  if (!t.arrive) return item.time ? `departs ${item.time}` : "";
  return `${item.time || "?"} → ${t.arrive}${t.nextDay ? " (+1)" : ""}`;
}

/** "2026-12-01" -> "2026-12-02" */
export function nextDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Where travel plans land you: { "2026-12-02": "Tokyo" } keyed by arrival date
 * (the next day for overnight trips). The latest arrival on a date wins.
 * `isTripCity(name)` filters out arrivals that aren't on the trip, like the flight home.
 */
export function arrivals(items, isTripCity = () => true) {
  const out = {};
  const travel = (items ?? []).filter((i) => i.travel?.to && i.date)
    .map((i) => ({ date: i.travel.nextDay ? nextDate(i.date) : i.date, time: i.travel.arrive || i.time || "", to: i.travel.to }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  for (const a of travel) if (isTripCity(a.to)) out[a.date] = a.to;
  return out;
}
