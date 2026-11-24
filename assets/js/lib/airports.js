// Airports for flight plans: a compact list of airports with scheduled flights
// (assets/data/airports.txt, from OurAirports, public domain), loaded the first
// time a flight form needs it. Search by code ("SIN"), city ("Tokyo") or name ("Changi").

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Big airports listed under a suburb or town, and the city people search for.
const SERVES = { NRT: "Tokyo", KUL: "Kuala Lumpur", DPS: "Bali Denpasar", TPE: "Taipei", MXP: "Milan", EWR: "New York", OKA: "Okinawa", NGO: "Nagoya", BER: "Berlin", REP: "Siem Reap" };

/** "SIN|Singapore Changi Airport|Singapore|SG|L" lines -> [{ code, name, city, cc, large }] */
export function parseAirports(text) {
  return String(text).split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
    const [code, name, city, cc, size] = l.split("|");
    const serves = SERVES[code] ?? "";
    return { code, name, city, cc, large: size === "L", serves, key: norm(`${name} ${city} ${serves}`) };
  });
}

let loading = null;
export function loadAirports(fetchImpl = globalThis.fetch) {
  loading ??= fetchImpl("/assets/data/airports.txt").then((r) => {
    if (!r.ok) throw new Error(`airports ${r.status}`);
    return r.text();
  }).then(parseAirports).catch((e) => { loading = null; throw e; });
  return loading;
}

/**
 * Best matches for what's typed: exact code first, then city and name matches.
 * Airports in `countries` (the trip's and home's) and big airports rank higher.
 */
export function searchAirports(list, query, { countries = [], limit = 8 } = {}) {
  const q = norm(query);
  if (!q) return [];
  const code = q.toUpperCase();
  const words = q.split(/\s+/);
  const scored = [];
  for (const a of list) {
    let score = 0;
    if (a.code === code) score = 100;
    else if (q.length <= 3 && a.code.startsWith(code)) score = 40;
    for (const c of [norm(a.city), norm(a.serves)].filter(Boolean)) {
      if (c === q) score = Math.max(score, 70);
      else if (c.startsWith(q)) score = Math.max(score, 50);
    }
    if (words.every((w) => a.key.split(/[\s-]+/).some((k) => k.startsWith(w)))) score = Math.max(score, 45);
    else if (q.length >= 3 && a.key.includes(q)) score = Math.max(score, 20);
    if (!score) continue;
    if (countries.includes(a.cc)) score += 15;
    if (a.large) score += 8;
    scored.push({ a, score });
  }
  return scored.sort((x, y) => y.score - x.score || x.a.code.localeCompare(y.a.code)).slice(0, limit).map((s) => s.a);
}

/** "Singapore Changi Airport (SIN)" */
export const airportLabel = (a) => (a ? `${a.name} (${a.code})` : "");

/** The code in "Singapore Changi Airport (SIN)" or a typed "sin", else "". */
export function airportCode(text) {
  const t = String(text ?? "").trim();
  const m = t.match(/\(([A-Za-z]{3})\)\s*$/) ?? t.match(/^([A-Za-z]{3})$/);
  return m ? m[1].toUpperCase() : "";
}
