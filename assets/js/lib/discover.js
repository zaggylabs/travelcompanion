// Discover: find places near an area ("food near Shibuya") from OpenStreetMap, via the
// free Overpass API. There are no ratings or reviews in OpenStreetMap, so results are
// sorted by distance (or by how much is listed about them) and never by made-up scores.
// Fair use: one request per search (never per keystroke), a capped radius and result
// count, and results cached in the browser for a week.

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
export const RADII = [500, 1000, 2000];
export const MAX_RESULTS = 300; // asked from Overpass; the list shows 20 at a time
const CACHE_KEY = "travelcompanion:discover-cache";
const CACHE_TTL = 7 * 24 * 3600 * 1000;
const CACHE_MAX = 10; // a busy area is ~60 KB, so this stays well clear of the trips' storage

/**
 * What you can look for. `filters` are Overpass tag filters; every result must also have a name.
 * `keyword` says what a "ramen" style keyword matches besides the name.
 */
export const DISCOVER_TYPES = [
  { key: "food", label: "Food", icon: "🍜", group: "Food", category: "Food", cuisine: true,
    filters: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'], placeholder: "ramen, sushi, halal…" },
  { key: "cafes", label: "Cafés and desserts", icon: "☕", group: "Food", category: "Food", cuisine: true,
    filters: ['["amenity"~"^(cafe|ice_cream)$"]', '["shop"~"^(bakery|pastry|confectionery)$"]'], placeholder: "matcha, bakery…" },
  { key: "bars", label: "Bars", icon: "🍸", group: "Food", category: "Food", cuisine: false,
    filters: ['["amenity"~"^(bar|pub|biergarten)$"]'], placeholder: "rooftop, izakaya…" },
  { key: "sights", label: "Sights", icon: "🏯", group: "Sights", category: "Activities", cuisine: false,
    filters: [
      '["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]',
      '["historic"~"^(castle|monument|ruins|archaeological_site|city_gate|fort)$"]',
      '["amenity"="place_of_worship"]["wikidata"]', // only the notable ones, or every small shrine shows up
    ], placeholder: "museum, temple…" },
  { key: "parks", label: "Parks and nature", icon: "🌳", group: "Sights", category: "Activities", cuisine: false,
    filters: ['["leisure"~"^(park|garden|nature_reserve)$"]', '["natural"~"^(beach|peak|waterfall)$"]'], placeholder: "garden, beach…" },
  { key: "shopping", label: "Shopping", icon: "🛍️", group: "Shopping", category: "Shopping", cuisine: false,
    filters: ['["shop"~"^(mall|department_store|gift|souvenir|books|anime|games|toys|electronics|second_hand|variety_store)$"]', '["amenity"="marketplace"]'],
    placeholder: "market, books…" },
];
const BY_KEY = Object.fromEntries(DISCOVER_TYPES.map((t) => [t.key, t]));
export const discoverType = (key) => BY_KEY[key] ?? DISCOVER_TYPES[0];

/** A keyword made safe to put inside an Overpass regex: letters, digits, spaces and hyphens only. */
export function cleanKeyword(s) {
  return String(s ?? "").normalize("NFC").replace(/[^\p{L}\p{N} -]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** The Overpass QL query for a type around a point. */
export function buildQuery({ type, lat, lon, radius, keyword }) {
  const t = discoverType(type);
  const r = Math.min(Math.max(Number(radius) || 1000, 100), 2000);
  const at = `(around:${r},${Number(lat).toFixed(5)},${Number(lon).toFixed(5)})`;
  const k = cleanKeyword(keyword);
  // OSM cuisine values use underscores ("japanese;ramen", "bubble_tea"), so a space matches either.
  const rx = k.replace(/ /g, "[ _]");
  const lines = [];
  for (const f of t.filters) {
    if (!k) lines.push(`  nwr${at}${f}["name"];`);
    else {
      lines.push(`  nwr${at}${f}["name"~"${rx}",i];`);
      if (t.cuisine) lines.push(`  nwr${at}${f}["name"]["cuisine"~"${rx}",i];`);
    }
  }
  return `[out:json][timeout:25];\n(\n${lines.join("\n")}\n);\nout tags center ${MAX_RESULTS};`;
}

/** Metres between two points. */
export function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** 240 -> "240 m", 1530 -> "1.5 km" */
export function formatDistance(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** "japanese;ramen" -> "Japanese, ramen" */
export function prettyCuisine(c) {
  const list = String(c ?? "").split(/\s*[;,]\s*/).filter(Boolean).map((x) => x.replace(/_/g, " "));
  if (!list.length) return "";
  const s = [...new Set(list)].slice(0, 3).join(", ");
  return s[0].toUpperCase() + s.slice(1);
}

const KIND_NAMES = {
  fast_food: "Fast food", food_court: "Food court", ice_cream: "Ice cream", place_of_worship: "Place of worship",
  department_store: "Department store", theme_park: "Theme park", nature_reserve: "Nature reserve",
  archaeological_site: "Archaeological site", city_gate: "City gate", second_hand: "Second-hand shop", variety_store: "Variety store",
  marketplace: "Market", attraction: "Attraction", biergarten: "Beer garden",
};
const KIND_KEYS = ["amenity", "tourism", "historic", "leisure", "shop", "natural"];

/** The main OSM tag of a result ("amenity=restaurant") and a readable name for it ("Restaurant"). */
export function resultKind(tags) {
  for (const k of KIND_KEYS) {
    const v = tags?.[k];
    if (v && v !== "yes") return { tag: `${k}=${v}`, label: KIND_NAMES[v] ?? (v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())) };
  }
  return { tag: "", label: "" };
}

/** How much is listed about a place (for "Most info first"). Not a rating. */
export function infoScore(tags) {
  const t = tags ?? {};
  return (t.wikidata ? 3 : 0) + (t.wikipedia ? 1 : 0) + (t.opening_hours ? 1 : 0) + (t.website || t["contact:website"] ? 1 : 0)
    + (t.cuisine ? 0.5 : 0) + (t["name:en"] ? 0.5 : 0) + (t.phone || t["contact:phone"] ? 0.25 : 0);
}

/** Overpass elements -> results with distance, nearest first, one per name+spot. */
export function parseResults(elements, center) {
  const out = [];
  const seen = new Set();
  for (const e of elements ?? []) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!t.name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = t["name:en"] || t.name;
    // The same shop is often mapped as a point and a building; keep one.
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = resultKind(t);
    out.push({
      osm: `${e.type[0].toUpperCase()}${e.id}`, // "N123", same shape as saved places use
      name,
      localName: t["name:en"] && t.name !== t["name:en"] ? t.name : "",
      kind: kind.label,
      kindTag: kind.tag,
      cuisine: prettyCuisine(t.cuisine),
      hours: t.opening_hours ?? "",
      website: t.website || t["contact:website"] || "",
      lat, lon,
      distance: center ? distanceM(center, { lat, lon }) : null,
      score: infoScore(t),
    });
  }
  return out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

export function sortResults(results, sort) {
  const list = [...(results ?? [])];
  if (sort === "info") return list.sort((a, b) => b.score - a.score || (a.distance ?? 0) - (b.distance ?? 0));
  return list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

/* ---------- fetching, with a small cache in localStorage ---------- */

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}; } catch { return {}; } };
const writeCache = (c) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { try { localStorage.removeItem(CACHE_KEY); } catch { /* blocked */ } }
};

export function cacheKey({ type, lat, lon, radius, keyword }) {
  return [type, Number(lat).toFixed(4), Number(lon).toFixed(4), radius, cleanKeyword(keyword).toLowerCase()].join("|");
}

/**
 * Places of a type around a point. Resolves to { results, cached }.
 * Throws when every Overpass server failed or timed out.
 */
export async function discoverPlaces(params, signal) {
  const key = cacheKey(params);
  const cache = readCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.at < CACHE_TTL) return { results: hit.results, cached: true };

  const body = new URLSearchParams({ data: buildQuery(params) });
  let lastError = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const timeout = AbortSignal.timeout(30000);
      const res = await fetch(url, { method: "POST", body, signal: signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal ?? timeout });
      if (res.status === 429 || res.status >= 500) { lastError = new Error(`busy (${res.status})`); continue; }
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      const results = parseResults(data.elements, { lat: params.lat, lon: params.lon });
      const fresh = readCache();
      fresh[key] = { at: Date.now(), results };
      const keys = Object.keys(fresh).sort((a, b) => fresh[a].at - fresh[b].at);
      while (keys.length > CACHE_MAX) delete fresh[keys.shift()];
      writeCache(fresh);
      return { results, cached: false };
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
    }
  }
  throw lastError ?? new Error("Search failed");
}
