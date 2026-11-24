// Booking links (Booking.com, Agoda, Klook, Airbnb…) pasted into Saved places.
// Browsers can't fetch those pages (no CORS), so the site and a best-guess name
// come from the URL itself.

// host suffix -> site name, group it suggests (null = depends on the path), brand colour
const SITES = [
  ["booking.com", "Booking.com", "Stays", "#003580"],
  ["agoda.com", "Agoda", "Stays", "#5c2d91"],
  ["airbnb.", "Airbnb", "Stays", "#ff385c"],
  ["trip.com", "Trip.com", null, "#287dfa"],
  ["expedia.", "Expedia", null, "#1e243a"],
  ["hotels.com", "Hotels.com", "Stays", "#d32f2f"],
  ["hostelworld.com", "Hostelworld", "Stays", "#f25621"],
  ["traveloka.com", "Traveloka", null, "#0194f3"],
  ["klook.com", "Klook", null, "#ff5b00"],
  ["kkday.com", "KKday", "Activities", "#26bec9"],
  ["getyourguide.", "GetYourGuide", "Activities", "#ff5533"],
  ["viator.com", "Viator", "Activities", "#186b6d"],
  ["tripadvisor.", "Tripadvisor", null, "#00aa6c"],
  ["opentable.", "OpenTable", "Food", "#da3743"],
  ["tabelog.com", "Tabelog", "Food", "#f5a623"],
  ["chope.co", "Chope", "Food", "#e4002b"],
  ["google.", "Google Maps", null, "#1a73e8"],
  ["goo.gl", "Google Maps", null, "#1a73e8"],
];

/** "https://…" or "www.…" text -> URL, else null. */
export function toUrl(text) {
  const t = String(text ?? "").trim();
  if (!t || /\s/.test(t)) return null;
  if (!/^https?:\/\//i.test(t) && !/^www\./i.test(t) && !/^[\w-]+(\.[\w-]+)+\//.test(t)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.includes(".") ? u : null;
  } catch {
    return null;
  }
}

const titleCase = (s) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(And|Of|The|By|At|In|De|La)\b/g, (w, _, i) => (i ? w.toLowerCase() : w));

/** "hotel-gracery-shinjuku" -> "Hotel Gracery Shinjuku"; null when the slug isn't a name. */
function slugName(slug) {
  if (!slug) return null;
  let s = decodeURIComponent(slug).replace(/\.(html?|php|aspx?)$/i, "").replace(/\.[a-z]{2}(-[a-z]{2})?$/i, "");
  s = s.replace(/^\d+[-_]/, "").replace(/[-_]?(t|d|g|h|l|ho)\d+$/i, "");
  s = s.replace(/[-_+]+/g, " ").trim();
  if (!/[a-z]{3}/i.test(s) || /^\d+$/.test(s) || s.length > 90) return null;
  if (/^(hotels?|rooms?|stays?|activit(y|ies)|detail|product|share|sp|tours?|things to do)$/i.test(s)) return null;
  return titleCase(s.toLowerCase());
}

function guessName(site, u) {
  const parts = u.pathname.split("/").filter(Boolean).filter((p) => !/^[a-z]{2}([-_][a-z]{2,4})?$/i.test(p)); // drop "en-sg"
  const path = u.pathname;
  switch (site) {
    case "Booking.com": { const i = parts.indexOf("hotel"); return i >= 0 ? slugName(parts[i + 2] ?? parts[i + 1]) : null; }
    case "Agoda": { const i = parts.indexOf("hotel"); return i > 0 ? slugName(parts[i - 1]) : null; }
    case "Expedia": { const m = path.match(/\/[^/]*?-Hotels-(.+?)\.h\d+/i); return m ? slugName(m[1]) : null; }
    case "Hotels.com": return /^ho\d+$/i.test(parts[0] ?? "") ? slugName(parts[1]) : null;
    case "Tripadvisor": { const m = path.match(/-Reviews-([^-]+)/); return m ? slugName(m[1]) : null; }
    case "Hostelworld": { const i = parts.findIndex((p) => /hosteldetails/i.test(p)); return i >= 0 ? slugName(parts[i + 1]) : null; }
    case "Airbnb": return null; // /rooms/123456 has no name in it
    case "Google Maps": { const i = parts.indexOf("place"); return i >= 0 ? slugName(parts[i + 1]) : null; }
    default: {
      // Klook /activity/1234-name/, KKday /product/1234-name, GetYourGuide /tokyo-l193/name-t1234/, Trip.com /hotels/.../name/
      for (const p of [...parts].reverse()) {
        if (/^(detail|details|product|activity|activities|hotels?|rooms?|restaurant|en|index|search)$/i.test(p)) continue;
        const name = slugName(p);
        if (name && !/^[a-z]+ l\d+$/i.test(name)) return name;
      }
      return null;
    }
  }
}

function guessGroup(site, defaultGroup, u) {
  const path = u.pathname.toLowerCase();
  if (/hotel|hostel|rooms?\b|stay|resort|ryokan|apartment|homestay/.test(path)) return "Stays";
  if (/restaurant|eatery|_review.*restaurant/.test(path)) return "Food";
  if (/activity|attraction|product|tour|ticket|experience|things-to-do/.test(path)) return "Activities";
  return defaultGroup;
}

/**
 * What we can tell from a pasted link, or null if it isn't a link.
 * { url, site, color, name: best-guess place name or null, group: suggested Saved places group or null }
 */
export function parseBookingLink(text) {
  const u = toUrl(text);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const known = SITES.find(([suffix]) => (suffix.endsWith(".") ? host.includes(suffix) : host === suffix || host.endsWith(`.${suffix}`)));
  const site = known?.[1] ?? host;
  return {
    url: u.href,
    site,
    color: known?.[3] ?? null,
    name: guessName(known ? site : "", u),
    group: guessGroup(site, known?.[2] ?? null, u),
  };
}

/** Short label for a saved link: the site's name, or its host. */
export const linkSite = (url) => parseBookingLink(url)?.site ?? null;

// Hosts the /api/link-preview function may fetch: the booking sites above (not Google) and their short links.
const SHORT_LINKS = ["abnb.me", "agoda.to", "bkng.it", "klook.page.link", "trip.com", "s.klook.com", "app.agoda.com", "kkday.page.link"];
export function isPreviewHost(hostname) {
  const host = String(hostname ?? "").toLowerCase().replace(/^www\./, "");
  if (SHORT_LINKS.some((s) => host === s || host.endsWith(`.${s}`))) return true;
  return SITES.some(([suffix, site]) => site !== "Google Maps" &&
    (suffix.endsWith(".") ? host.split(".").includes(suffix.slice(0, -1)) : host === suffix || host.endsWith(`.${suffix}`)));
}
