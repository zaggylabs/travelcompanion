// GET /api/popular?lat=35.68&lon=139.77
// The best-known sights and things to do within 15 km, from Wikidata (see assets/js/lib/popular.js).
// The point is rounded to about a kilometre and answers are cached at Cloudflare for a week,
// so each city is asked of Wikidata about once a week.
import { parsePopular, popularQuery } from "../../assets/js/lib/popular.js";

const WEEK = 7 * 86400;
const json = (body, maxAge = 0) => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
});

export async function onRequestGet({ request, waitUntil }) {
  const q = new URL(request.url).searchParams;
  const lat = Math.round(Number(q.get("lat")) * 100) / 100;
  const lon = Math.round(Number(q.get("lon")) * 100) / 100;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !q.get("lat") || !q.get("lon")) return json({ ok: false, error: "bad-point" });

  const cache = caches.default;
  const key = new Request(`https://popular.internal/v2?p=${lat},${lon}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(popularQuery(lat, lon))}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": "TravelCompanion/1.0 (https://travelcompanion.pages.dev)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return json({ ok: false, error: `status-${res.status}` });
    const data = await res.json();
    const out = json({ ok: true, ...parsePopular(data.results?.bindings, { lat, lon }) }, WEEK);
    waitUntil(cache.put(key, out.clone()));
    return out;
  } catch (e) {
    return json({ ok: false, error: e?.name === "TimeoutError" ? "timeout" : "failed" });
  }
}
