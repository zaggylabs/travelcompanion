// Reads what a booking page says about itself: Open Graph tags and schema.org JSON-LD
// (name, address, coordinates, rating, photo). Used by the /api/link-preview function,
// so it works on raw HTML with no DOM.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", hellip: "…" };
export function decodeEntities(s) {
  return String(s ?? "").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s) => decodeEntities(s).replace(/\s+/g, " ").trim();

function metaTags(html) {
  const out = {};
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3];
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (key && attrs.content !== undefined && !(key in out)) out[key] = clean(attrs.content);
  }
  return out;
}

function jsonLd(html) {
  const found = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (v["@type"]) found.push(v);
    if (v["@graph"]) walk(v["@graph"]);
    if (v.mainEntity) walk(v.mainEntity);
    if (v.itemReviewed) walk(v.itemReviewed);
  };
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* broken block, skip */ }
  }
  return found;
}

const TYPE_GROUP = [
  [/hotel|lodging|resort|hostel|motel|bedandbreakfast|apartment|vacationrental|accommodation|house|campground|room|suite/i, "Stays"],
  [/restaurant|foodestablishment|cafe|bakery|bar(?!ber)|winery|brewery/i, "Food"],
  [/touristattraction|landmark|museum|park|placeofworship|zoo|aquarium/i, "Sights"],
  [/product|event|trip|tour|offer/i, "Activities"],
];
const typesOf = (o) => [].concat(o["@type"] ?? []).join(" ");
const groupForType = (t) => TYPE_GROUP.find(([re]) => re.test(t))?.[1] ?? null;

// Which JSON-LD object is the place itself (not the breadcrumb, organisation or website).
function bestEntity(list) {
  const score = (o) => {
    const t = typesOf(o);
    if (/breadcrumb|website|webpage|organization|searchaction|imageobject|faqpage|review$/i.test(t) && !/business|hotel|restaurant/i.test(t)) return 0;
    let s = o.name ? 1 : 0;
    if (groupForType(t)) s += 3;
    if (/localbusiness|place/i.test(t)) s += 2;
    if (o.address) s += 2;
    if (o.geo) s += 1;
    if (o.aggregateRating) s += 1;
    return s;
  };
  return list.map((o) => [o, score(o)]).filter(([, s]) => s > 1).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);
const imageUrl = (v) => { const x = first(v); return typeof x === "string" ? x : x?.url || x?.contentUrl || null; };
const num = (v) => { const n = Number(String(first(v) ?? "").replace(",", ".")); return Number.isFinite(n) && n !== 0 ? n : null; };

function addressParts(a) {
  a = first(a);
  if (!a) return null;
  if (typeof a === "string") return { text: clean(a), locality: null, region: null, country: null };
  const country = typeof a.addressCountry === "object" ? a.addressCountry?.name : a.addressCountry;
  const parts = { street: a.streetAddress, locality: a.addressLocality, region: a.addressRegion, postal: a.postalCode, country };
  for (const k in parts) parts[k] = parts[k] ? clean(String(parts[k])) : null;
  const text = [...new Set([parts.street, parts.locality, parts.region, parts.postal, parts.country].filter(Boolean))].join(", ");
  return { ...parts, text };
}

// Bot checks and error pages say nothing about the place.
const BLOCKED = /just a moment|attention required|access denied|are you a (robot|human)|robot or human|captcha|verify you are|pardon our interruption|security check|page not found|404|error/i;

/** "Hotel Gracery Shinjuku, Tokyo – Updated 2026 Prices" -> "Hotel Gracery Shinjuku" (using the city when known). */
export function cleanTitle(title, locality) {
  let t = clean(title);
  if (!t || BLOCKED.test(t)) return null;
  t = t.split(/\s+[|–—]\s+|\s+-\s+|\s+·\s+/)[0].trim();
  t = t.replace(/^(book|reserve|tickets? for)\s+/i, "");
  if (locality) t = t.replace(new RegExp(`(,|\\s+in)\\s+${locality.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "i"), "");
  t = t.replace(/\s*\((updated )?\d{4}( prices)?\)\s*$/i, "").trim();
  if (t.length < 2 || /^(booking\.com|agoda|klook|airbnb|trip\.com|expedia|hotels\.com|tripadvisor)$/i.test(t)) return null;
  return t;
}

/**
 * Everything useful from a page's HTML.
 * Returns { name, group, address, area, country, lat, lon, rating, ratingScale, reviews, stars, image, description, price, blocked }.
 */
export function parsePageMeta(html, url = "") {
  html = String(html ?? "").slice(0, 3_000_000);
  const meta = metaTags(html);
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const ld = bestEntity(jsonLd(html));
  const addr = addressParts(ld?.address) ?? (meta["og:street-address"] || meta["og:locality"]
    ? addressParts({ streetAddress: meta["og:street-address"], addressLocality: meta["og:locality"], addressRegion: meta["og:region"], addressCountry: meta["og:country-name"] })
    : null);
  const geo = first(ld?.geo) ?? {};
  const rating = first(ld?.aggregateRating) ?? {};
  const pageTitle = meta["og:title"] || meta["twitter:title"] || title;
  const blocked = !ld && (!pageTitle || BLOCKED.test(pageTitle));
  const name = clean(ld?.name ?? "") || cleanTitle(pageTitle, addr?.locality) || null;
  const out = {
    name: name && !BLOCKED.test(name) ? name : null,
    group: ld ? groupForType(typesOf(ld)) : null,
    address: addr?.text || null,
    area: addr ? [...new Set([addr.locality, addr.region || addr.country].filter(Boolean))].join(", ") || null : null,
    country: addr?.country || null,
    lat: num(geo.latitude) ?? num(meta["place:location:latitude"] ?? meta["og:latitude"]),
    lon: num(geo.longitude) ?? num(meta["place:location:longitude"] ?? meta["og:longitude"]),
    rating: num(rating.ratingValue),
    ratingScale: num(rating.bestRating),
    reviews: num(rating.reviewCount ?? rating.ratingCount),
    stars: num(ld?.starRating?.ratingValue ?? ld?.starRating),
    image: imageUrl(ld?.image) || meta["og:image"] || meta["twitter:image"] || null,
    description: clean(ld?.description || meta["og:description"] || meta.description || "").slice(0, 300) || null,
    price: ld?.priceRange ? clean(String(ld.priceRange)) : null,
    blocked,
  };
  if (out.image && url) { try { out.image = new URL(out.image, url).href; } catch { out.image = null; } }
  if (out.image && !/^https:/.test(out.image)) out.image = null;
  return out;
}
