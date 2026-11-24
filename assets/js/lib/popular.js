// "Popular" column on the Discover tab: the best-known sights and things to do around a city,
// from Wikidata. A place's popularity is how many Wikipedia languages have an article about it
// (its sitelinks), which tracks fame well and needs no API key. Wikidata doesn't say "tourist
// attraction" reliably, so each place's English description sorts it ("theme park in Japan").
import { distanceM } from "./discover.js";

export const POPULAR_RADIUS_KM = 15;
export const POPULAR_LIMIT = 10;

/** The SPARQL query: places near a point with enough sitelinks, most famous first. */
export function popularQuery(lat, lon, radiusKm = POPULAR_RADIUS_KM) {
  const la = Number(lat).toFixed(2), lo = Number(lon).toFixed(2);
  return `SELECT ?item ?label ?desc ?links ?coord ?image WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(${lo} ${la})"^^geo:wktLiteral; wikibase:radius "${Number(radiusKm)}". }
  ?item wikibase:sitelinks ?links. FILTER(?links >= 8)
  ?item rdfs:label ?label. FILTER(LANG(?label) = "en")
  ?item schema:description ?desc. FILTER(LANG(?desc) = "en")
  OPTIONAL { ?item wdt:P18 ?image. }
} ORDER BY DESC(?links) LIMIT 400`;
}

const SKIP = /\b(special wards?|ward of|city in|town in|village in|municipality|prefecture|province|county|state of|capital|largest city|metropolitan|university|college|school|institute|company|corporation|manufacturer|retailer|brand|station|airport|olympic|paralympic|government|ministry|parliament|house of|council|court|bank|exchange|attack|incident|battle|war|massacre|disaster|earthquake|fire of|hospital|studio|network|television|radio|newspaper|broadcaster|operator|agency|embassy|consulate|library|subway|metro|railway|rail line|line\b|highway|expressway|road|business|financial|office|headquarters|hotel|apartment|residential|cemetery|club|team|federation|organi[sz]ation|association|former|historical name|empire|shogunate|dynasty|era\b|period|election|event|festival|award|film|album|song|novel|band|software|video game|person|politician|family|clan|research|laboratory|power plant|factory|prison|military|base\b|barracks|port of|electoral|constituency|district of the|census|neighbourhood of the city|church building|stock|market based|country|sovereign|main island|baseball|tower block)\b/i;
const DO = /\b(theme park|amusement park|water ?park|zoo|aquarium|safari|museum|art gallery|gallery|planetarium|observation deck|observatory|onsen|hot springs?|ski resort|racecourse|cable car|aerial tramway|ropeway|funicular|ferris wheel|roller coaster|theatre|theater|opera house|concert hall|science cent(er|re)|cruise|night market)\b/i;
const SEE = /\b(tower|temple|shrine|pagoda|castle|palace|fort(ress)?|gate|park|garden|square|plaza|bridge|market|shopping|mall|arcade|district|neighbo(u)?rhood|quarter|area in|town located|crossing|street|avenue|boulevard|monument|memorial|statue|landmark|cathedral|church|basilica|mosque|synagogue|chapel|abbey|monastery|island|beach|bay|mountain|peak|volcano|hill|lake|waterfall|canal|harbou?r|pier|wharf|old town|historic|heritage|ruins?|archaeological|viewpoint|skyscraper|lighthouse|residence|cave|reserve|national park|forest|valley|gorge|promenade)\b/i;

/**
 * "theme park in Japan, owned by…" -> "do"; "Shinto shrine in Tokyo" -> "see"; "special ward of Tokyo" -> null.
 * Only the head ("theme park") is judged, so "…owned by a company" doesn't count against it.
 */
export function classify(desc) {
  const d = String(desc ?? "").trim();
  const head = d.split(/\s+(?:in|of|located|owned|at|on|near|from|for|by|serving)\b/i)[0];
  if (!head || SKIP.test(head)) return null;
  if (DO.test(head)) return "do";
  if (SEE.test(head) || /^town located in\b/i.test(d)) return "see";
  return null;
}

/** "Point(139.76 35.68)" -> { lat, lon } */
export function parsePoint(wkt) {
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(String(wkt ?? ""));
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
}

/** A small Commons thumbnail URL for a P18 image. */
export const thumb = (file, width = 160) => file
  ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(String(file).split("/Special:FilePath/").pop()))}?width=${width}`
  : "";

/** SPARQL bindings -> { todo: [...], see: [...] }, each the most famous first. */
export function parsePopular(bindings, center, limit = POPULAR_LIMIT) {
  const seen = new Set();
  const out = { todo: [], see: [] };
  for (const b of bindings ?? []) {
    const id = String(b.item?.value ?? "").split("/").pop();
    const name = b.label?.value ?? "";
    const desc = b.desc?.value ?? "";
    if (!id || !name || seen.has(id) || seen.has(name.toLowerCase())) continue;
    const kind = /\b(government|ministry|headquarters|prefectural|city hall)\b/i.test(name) ? null : classify(desc);
    if (!kind) continue;
    const pt = parsePoint(b.coord?.value);
    if (!pt) continue;
    seen.add(id);
    seen.add(name.toLowerCase());
    const list = kind === "do" ? out.todo : out.see;
    if (list.length >= limit) continue;
    // Big cities have dozens of famous museums; keep room for theme parks, zoos and the like.
    const museum = /museum|gallery/i.test(desc);
    if (museum && list.filter((x) => x.museum).length >= 5) continue;
    list.push({
      id, name, desc: desc[0].toUpperCase() + desc.slice(1), links: Number(b.links?.value) || 0, ...(museum ? { museum: true } : {}),
      lat: pt.lat, lon: pt.lon, distance: center ? distanceM(center, pt) : null, image: thumb(b.image?.value),
    });
  }
  return out;
}
