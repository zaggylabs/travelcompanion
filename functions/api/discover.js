// GET /api/discover?type=food&lat=35.6595&lon=139.7005&radius=1000&keyword=&diet=
// Runs the Discover search on Overpass from Cloudflare and caches the answer at the edge for a day,
// so a repeat search (by anyone) is instant. The query is built here from the parameters, so this
// can't be used to send arbitrary queries. Public Overpass servers are often busy: the main one gets
// a head start, and a mirror joins if it's slow; the first good answer wins.
import { RADII, buildQuery, cacheKey, cleanKeyword, discoverType, parseResults } from "../../assets/js/lib/discover.js";

const SERVERS = [
  { url: "https://overpass-api.de/api/interpreter", after: 0 },
  { url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter", after: 2500 },
  { url: "https://overpass.private.coffee/api/interpreter", after: 5000 },
];
const DAY = 86400;

const json = (body, maxAge = 0) => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
});

/** Try the servers with staggered starts; resolve with the first one that returns Overpass JSON. */
function race(query, timeoutMs = 14000) {
  const body = new URLSearchParams({ data: query }).toString();
  const controllers = [];
  return new Promise((resolve, reject) => {
    let pending = SERVERS.length;
    let done = false;
    const timers = [];
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      controllers.forEach((c) => c.abort());
      fn(v);
    };
    timers.push(setTimeout(() => finish(reject, new Error("timeout")), timeoutMs));
    SERVERS.forEach(({ url, after }) => {
      timers.push(setTimeout(async () => {
        if (done) return;
        const c = new AbortController();
        controllers.push(c);
        try {
          const res = await fetch(url, {
            method: "POST", body, signal: c.signal,
            headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TravelCompanion (travelcompanion.pages.dev)" },
          });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const data = await res.json(); // a busy server can send an HTML error page instead
          if (!Array.isArray(data.elements)) throw new Error("no elements");
          finish(resolve, { data, server: new URL(url).hostname });
        } catch (e) {
          if (--pending === 0) finish(reject, e);
        }
      }, after));
    });
  });
}

export async function onRequestGet({ request, waitUntil }) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat")), lon = Number(q.get("lon"));
  const params = {
    type: discoverType(q.get("type")).key,
    lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4,
    radius: RADII.includes(Number(q.get("radius"))) ? Number(q.get("radius")) : 1000,
    keyword: cleanKeyword(q.get("keyword")),
    diet: q.get("diet") ?? "",
  };
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ ok: false, error: "bad-point" });

  const cache = caches.default;
  const key = new Request(`https://discover.internal/v1?k=${encodeURIComponent(cacheKey(params))}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const t0 = Date.now();
    const { data, server } = await race(buildQuery(params));
    const res = json({ ok: true, results: parseResults(data.elements, { lat: params.lat, lon: params.lon }), server, ms: Date.now() - t0 }, DAY);
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json({ ok: false, error: e?.message === "timeout" ? "timeout" : "busy" });
  }
}
