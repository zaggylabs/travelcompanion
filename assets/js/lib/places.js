// Place suggestions from Photon (photon.komoot.io), a free, keyless search over
// OpenStreetMap data that's built for search-as-you-type. Results are limited to
// the trip's country and re-ranked so landmarks beat gift shops and car parks.
const ENDPOINT = "https://photon.komoot.io/api/";
const MIN_CHARS = 3;

// How interesting a kind of place is to a traveller (higher shows first; 0 is hidden).
const WEIGHTS = {
  "tourism=theme_park": 10, "tourism=attraction": 9, "tourism=museum": 9, "tourism=zoo": 9, "tourism=aquarium": 9,
  "tourism=viewpoint": 8, "tourism=gallery": 7, "leisure=resort": 8, "leisure=water_park": 9, "leisure=park": 7,
  "leisure=garden": 7, "leisure=nature_reserve": 7, "leisure=stadium": 6, "aeroway=aerodrome": 9,
  "amenity=place_of_worship": 7, "amenity=theatre": 5, "amenity=restaurant": 6, "amenity=cafe": 5,
  "amenity=bar": 4, "amenity=food_court": 5, "amenity=marketplace": 6, "shop=mall": 6, "shop=department_store": 6,
  "place=city": 8, "place=town": 7, "place=village": 5, "place=suburb": 6, "place=quarter": 6,
  "place=neighbourhood": 5, "place=island": 7, "railway=station": 6, "building=train_station": 6,
  "public_transport=station": 6, "tourism=hotel": 6, "tourism=hostel": 5, "tourism=guest_house": 5,
  "tourism=apartment": 4, "natural=peak": 7, "natural=beach": 7, "natural=volcano": 7, "natural=waterfall": 7,
  "man_made=tower": 8, "man_made=lighthouse": 7, "man_made=bridge": 5,
  "historic=castle": 8, "historic=monument": 7, "historic=memorial": 3,
  "amenity=parking": 0, "building=roof": 0, "building=yes": 0, "office=company": 0, "highway": 0,
};
const KEY_WEIGHTS = { tourism: 6, historic: 6, leisure: 4, place: 4, natural: 3, amenity: 3, shop: 2, railway: 0, highway: 0, waterway: 0, power: 0, landuse: 1, craft: 1, office: 0, healthcare: 1, building: 1 };

export function placeWeight(p) {
  const tag = `${p.osm_key}=${p.osm_value}`;
  if (tag in WEIGHTS) return WEIGHTS[tag];
  if (p.osm_key in WEIGHTS) return WEIGHTS[p.osm_key];
  return KEY_WEIGHTS[p.osm_key] ?? 2;
}

/** Itinerary category a place most likely belongs to, or null if unsure. */
export function categoryForPlace(p) {
  const k = p.osm_key, v = p.osm_value;
  if (k === "aeroway") return "Flights";
  if (k === "tourism" && ["hotel", "hostel", "guest_house", "apartment", "motel", "camp_site"].includes(v)) return "Lodging";
  if (k === "leisure" && v === "resort") return null;
  if (k === "amenity" && ["restaurant", "cafe", "bar", "pub", "food_court", "fast_food", "ice_cream"].includes(v)) return "Food";
  if (k === "shop" || (k === "amenity" && v === "marketplace")) return "Shopping";
  if (k === "railway" || k === "public_transport" || v === "train_station" || (k === "amenity" && ["bus_station", "ferry_terminal", "car_rental"].includes(v))) return "Transport";
  if (["tourism", "leisure", "historic", "natural"].includes(k)) return "Activities";
  return null;
}

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Photon GeoJSON -> ranked, de-duplicated suggestions. */
export function rankPlaces(features, query, limit = 8) {
  const q = norm(query).trim();
  const seen = new Set();
  const out = [];
  (features ?? []).forEach((f, i) => {
    const p = f.properties ?? {};
    if (!p.name) return;
    const weight = placeWeight(p);
    if (weight === 0) return;
    const area = [...new Set([p.district, p.city, p.state].filter((x) => x && x !== p.name))].slice(0, 2).join(", ");
    const key = `${norm(p.name)}|${norm(p.city || p.state)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const name = norm(p.name);
    const textBoost = name === q ? 3 : name.startsWith(q) ? 1.5 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : 0;
    const [lon, lat] = f.geometry?.coordinates ?? [];
    out.push({
      name: p.name,
      area,
      country: p.country ?? "",
      countryCode: p.countrycode ?? "",
      kind: String(p.osm_value ?? "").replace(/_/g, " "),
      category: categoryForPlace(p),
      lat, lon,
      // Photon already ranks famous places first, so its top few results get a head start.
      score: weight + textBoost + Math.max(0, 4 - i) - i * 0.05,
    });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** "Tokyo Disneyland, Urayasu, Chiba Prefecture" -> a Google Maps link that opens on a phone too. */
export function mapsLink(place) {
  const query = [place.name, place.area, place.country].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const cache = new Map();

/** Search places in a country. Pass an AbortSignal so a newer keystroke cancels the old request. */
export async function searchPlaces(query, countryCode, signal) {
  const q = String(query ?? "").trim();
  if (q.length < MIN_CHARS) return [];
  const key = `${countryCode || ""}|${norm(q)}`;
  if (cache.has(key)) return cache.get(key);
  const params = new URLSearchParams({ q, limit: "40", lang: "en" });
  if (countryCode) params.set("countrycode", countryCode.toUpperCase());
  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = await res.json();
  const results = rankPlaces(data.features, q);
  cache.set(key, results);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return results;
}

export const PLACE_MIN_CHARS = MIN_CHARS;
