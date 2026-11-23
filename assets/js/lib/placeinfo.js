// Info about a plan's place, from free sources that need no API key:
//   - OpenStreetMap (via Photon search and the OSM API): opening hours, website, phone
//   - Wikidata + Wikipedia: a short summary and a photo
//   - Nager.Date: public holidays, to say whether a day is likely to be busy
// There's no free source for real peak/quiet times (Google's "Popular times" has no API),
// so the crowd section only states facts about the day plus a general tip for the kind of place.
import { searchPlaces } from "./places.js";

const OSM_API = "https://api.openstreetmap.org/api/0.6";
const TYPES = { N: "node", W: "way", R: "relation" };
const TIMEOUT = 10000;

const getJson = async (url, signal) => {
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
};

/* ---------- pure helpers (unit tested) ---------- */

const DAYS = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun", PH: "Public holidays", SH: "School holidays" };

/** OSM opening_hours ("Mo-Fr 09:00-17:00; Sa off") -> readable lines (["Mon–Fri 09:00–17:00", "Sat closed"]). */
export function prettyHours(value) {
  if (!value) return [];
  const s = String(value).trim();
  if (s === "24/7") return ["Open 24 hours, every day"];
  return s.split(/\s*(?:;|\|\|)\s*/).filter(Boolean).map((rule) => rule
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b/g, (d) => DAYS[d])
    .replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}\+?)/g, "$1–$2")
    .replace(/([A-Za-z]{3})-([A-Z][a-z]{2})/g, "$1–$2")
    .replace(/,(?=\S)/g, ", ")
    .replace(/\b(off|closed)\b/gi, "closed")
    .replace(/"([^"]*)"/g, "($1)")
    .replace(/^24\/7\b/, "Every day, 24 hours"));
}

/** "W1282875870" -> { type: "way", id: 1282875870 } */
export function parseOsmRef(ref) {
  const m = /^([NWR])(\d+)$/.exec(String(ref ?? ""));
  return m ? { type: TYPES[m[1]], id: Number(m[2]), letter: m[1] } : null;
}

/** OSM "wikipedia" tag ("en:Tokyo Disneyland") -> { lang, title } */
export function parseWikipediaTag(tag) {
  const m = /^([a-z-]{2,12}):(.+)$/.exec(String(tag ?? "").trim());
  return m ? { lang: m[1], title: m[2] } : null;
}

/** The most useful OSM tag pair ("tourism=theme_park") from a tag set. */
export function kindFromTags(tags) {
  for (const k of ["tourism", "leisure", "historic", "amenity", "shop", "natural", "aeroway", "railway", "public_transport", "man_made", "building", "place"]) {
    if (tags?.[k] && tags[k] !== "yes") return `${k}=${tags[k]}`;
  }
  return "";
}

const TIPS = [
  [/theme_park|water_park|zoo|aquarium/, "Theme parks and zoos are usually busiest on weekends, public holidays and school holidays. Weekdays outside holiday periods are the safest bet, and getting there before opening beats the longest queues."],
  [/museum|gallery|arts_centre/, "Museums tend to be quietest on weekday mornings and busiest on weekend afternoons and rainy days. Many close one day a week, so check the hours."],
  [/restaurant|cafe|food_court|fast_food|bar|pub|ice_cream|marketplace/, "Popular places to eat usually have the longest waits around 12–1 pm and 6–8 pm. Going a little before or after, or booking ahead, usually helps."],
  [/shop=|mall|department_store/, "Shops and malls are usually quietest on weekday mornings and busiest on weekend afternoons."],
  [/station|railway|public_transport|aerodrome|bus_station|ferry/, "Stations are busiest in the weekday rush hours, roughly 7:30–9:30 am and 5–7 pm. Avoid those times if you have luggage."],
  [/hotel|hostel|guest_house|apartment|motel/, "Hotel check-in is often from 3 pm and check-out around 10–11 am. Most hotels will hold bags if you arrive early."],
  [/place_of_worship|shrine|temple|castle|monument|historic|viewpoint|attraction|park|garden|beach|peak/, "Popular sights are usually quietest early in the morning and late in the afternoon, and busiest around midday and on weekends."],
];

/** A general tip for this kind of place. It's not data about this specific place. */
export function crowdTip(kind, category) {
  const k = String(kind ?? "");
  for (const [re, tip] of TIPS) if (re.test(k)) return tip;
  if (category === "Food") return TIPS[2][1];
  if (category === "Shopping") return TIPS[3][1];
  if (category === "Lodging") return TIPS[5][1];
  if (category === "Activities") return TIPS[6][1];
  return "";
}

/** Facts about a plan's day: weekend? public holiday? -> { text, busy } or null */
export function dayNote(date, holidays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const hol = (holidays ?? []).find((x) => x.date === date);
  if (hol) return { busy: true, text: `${weekday} is a public holiday (${hol.localName && hol.localName !== hol.name ? `${hol.name}, ${hol.localName}` : hol.name}). Expect bigger crowds.` };
  const near = (holidays ?? []).find((x) => Math.abs(Date.parse(`${x.date}T12:00:00Z`) - d.getTime()) <= 86400000);
  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  if (weekend) return { busy: true, text: `It's a ${weekday}, so it's likely to be busier than a weekday.${near ? ` ${near.name} is the day ${near.date < date ? "before" : "after"}, too.` : ""}` };
  if (near) return { busy: true, text: `It's a ${weekday}, next to a public holiday (${near.name}), so it may be busier than a normal weekday.` };
  return { busy: false, text: `It's a ${weekday} with no public holiday${holidays ? "" : " we know of"}, which is usually quieter than a weekend.` };
}

/* ---------- fetching (cached for this visit) ---------- */

const cache = new Map();
const remember = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
};

/** Public holidays for a country and year, or null when the service doesn't cover it. */
export function getHolidays(countryCode, year) {
  if (!countryCode || !year) return Promise.resolve(null);
  return remember(`hol|${countryCode}|${year}`, async () => {
    try {
      const list = await getJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`);
      return Array.isArray(list) ? list.filter((h) => h.global !== false) : null;
    } catch {
      return null; // country not covered, or the service is down
    }
  });
}

async function osmTags(ref) {
  const r = parseOsmRef(ref);
  if (!r) return {};
  const data = await getJson(`${OSM_API}/${r.type}/${r.id}.json`);
  return data.elements?.find((e) => e.type === r.type && e.id === r.id)?.tags ?? {};
}

async function wikiSummary(tags) {
  let lang = "en";
  let title = null;
  if (tags.wikidata) {
    const wd = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(tags.wikidata)}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`).catch(() => null);
    title = wd?.entities?.[tags.wikidata]?.sitelinks?.enwiki?.title ?? null;
  }
  if (!title) {
    const w = parseWikipediaTag(tags.wikipedia);
    if (w) ({ lang, title } = w);
  }
  if (!title) return null;
  const s = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`).catch(() => null);
  if (!s || s.type === "disambiguation" || !s.extract) return null;
  return {
    title: s.title,
    extract: s.extract,
    image: s.thumbnail?.source ?? null,
    url: s.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    lang,
  };
}

/**
 * Finds the place for a plan (its saved OSM reference, or the best search match for its title)
 * and gathers what's known about it. Resolves to null when the place can't be found.
 */
export function getPlaceInfo({ title, place, countryCode }) {
  const key = place?.osm ? `osm|${place.osm}` : `q|${countryCode ?? ""}|${String(title ?? "").trim().toLowerCase()}`;
  return remember(key, async () => {
    let ref = place?.osm ?? null;
    let found = place ?? null;
    if (!ref) {
      const results = await searchPlaces(title, countryCode);
      found = results[0] ?? null;
      ref = found?.osm ?? null;
      if (!ref) return null;
    }
    const tags = await osmTags(ref).catch(() => ({}));
    const wiki = await wikiSummary(tags).catch(() => null);
    const r = parseOsmRef(ref);
    return {
      name: tags["name:en"] || found?.name || tags.name || title,
      localName: tags.name && tags.name !== (tags["name:en"] || found?.name) ? tags.name : "",
      area: found?.area ?? "",
      kind: kindFromTags(tags) || found?.kind || "",
      hours: prettyHours(tags.opening_hours),
      hoursRaw: tags.opening_hours ?? "",
      website: tags.website || tags["contact:website"] || tags.url || "",
      phone: tags.phone || tags["contact:phone"] || "",
      fee: tags.fee ?? "",
      wheelchair: tags.wheelchair ?? "",
      wiki,
      osmUrl: r ? `https://www.openstreetmap.org/${r.type}/${r.id}` : "",
      guessed: !place?.osm, // found by searching the title, not picked from suggestions
    };
  });
}
