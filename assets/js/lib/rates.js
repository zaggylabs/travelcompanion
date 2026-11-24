// Home currency and exchange rates, so trip costs can also be shown in the
// currency the traveller thinks in. Rates come from free, keyless APIs and are
// cached in localStorage, so the site still converts offline with the last rates.
import { getCountry } from "./countries.js";

const SETTINGS_KEY = "travelcompanion:home:v1";
const RATES_KEY = "travelcompanion:rates:v1:";
export const RATES_MAX_AGE = 12 * 60 * 60 * 1000; // refresh twice a day at most

// Common time zones, for browsers whose language has no region (plain "en").
const ZONE_COUNTRY = {
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Jakarta": "ID", "Asia/Bangkok": "TH", "Asia/Manila": "PH",
  "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Shanghai": "CN",
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Perth": "AU", "Pacific/Auckland": "NZ",
  "Europe/London": "GB", "Europe/Paris": "FR", "Europe/Berlin": "DE", "America/New_York": "US", "America/Chicago": "US",
  "America/Los_Angeles": "US", "America/Toronto": "CA",
};

/**
 * Best guess at where the user is from: their time zone when it's a common one,
 * else the browser language's region ("ms-MY"), else Singapore. The time zone goes
 * first because many people in Singapore browse in en-US or en-GB.
 */
export function guessHomeCountry({ languages = [], timeZone = "" } = {}) {
  if (ZONE_COUNTRY[timeZone]) return ZONE_COUNTRY[timeZone];
  for (const lang of languages) {
    const m = String(lang).match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
    const code = m && getCountry(m[1])?.code;
    if (code) return code;
  }
  return "SG";
}

export function browserGuess() {
  let timeZone = "";
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* old browser */ }
  const languages = typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  const country = guessHomeCountry({ languages, timeZone });
  return { country, currency: getCountry(country)?.currency ?? "SGD" };
}

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** The saved home country and currency, or null if the user hasn't chosen yet. */
export function loadHome() {
  try {
    const v = JSON.parse(storage()?.getItem(SETTINGS_KEY) ?? "null");
    return v && /^[A-Z]{3}$/.test(v.currency) ? v : null;
  } catch {
    return null;
  }
}

let memoryHome = null;
export function saveHome(home) {
  memoryHome = home;
  try { storage()?.setItem(SETTINGS_KEY, JSON.stringify(home)); } catch { /* private mode: keep for this visit */ }
}
export const savedHome = () => loadHome() ?? memoryHome;

/** amount in `from` -> amount in `to`, using a table of rates relative to `table.base`. null if a rate is missing. */
export function convert(amount, from, to, table) {
  if (from === to) return amount;
  if (!table?.rates) return null;
  const rate = (c) => (c === table.base ? 1 : table.rates[c]);
  const f = rate(from);
  const t = rate(to);
  if (!(f > 0) || !(t > 0)) return null;
  return (amount / f) * t;
}

/** open.er-api.com (160+ currencies) or Frankfurter (ECB, ~30 currencies) -> { base, rates, updated } */
export function parseRates(json) {
  if (json?.result === "success" && json.rates) {
    return { base: json.base_code, rates: json.rates, updated: json.time_last_update_unix * 1000, source: "er-api" };
  }
  if (json?.base && json.rates && json.date) {
    return { base: json.base, rates: { ...json.rates, [json.base]: 1 }, updated: Date.parse(json.date), source: "frankfurter" };
  }
  return null;
}

function readCache(base) {
  try {
    const v = JSON.parse(storage()?.getItem(RATES_KEY + base) ?? "null");
    return v?.rates ? v : null;
  } catch {
    return null;
  }
}

function writeCache(table) {
  try { storage()?.setItem(RATES_KEY + table.base, JSON.stringify(table)); } catch { /* fine, just won't be cached */ }
}

const SOURCES = [
  (base) => `https://open.er-api.com/v6/latest/${base}`,
  (base) => `https://api.frankfurter.dev/v1/latest?base=${base}`,
];

/**
 * Rates with `base` as 1. Uses the cache while it's fresh, otherwise fetches and
 * falls back to the cached copy (marked stale) when offline.
 * @returns {Promise<{ base, rates, updated, fetchedAt, source, stale? } | null>}
 */
export async function getRates(base, { fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const cached = readCache(base);
  if (cached && now - cached.fetchedAt < RATES_MAX_AGE) return cached;
  for (const url of SOURCES) {
    try {
      const res = await fetchImpl(url(base));
      if (!res.ok) continue;
      const table = parseRates(await res.json());
      if (!table || table.base !== base) continue;
      const fresh = { ...table, fetchedAt: now };
      writeCache(fresh);
      return fresh;
    } catch { /* offline or blocked: try the next source */ }
  }
  return cached ? { ...cached, stale: true } : null;
}
