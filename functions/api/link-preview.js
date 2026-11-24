// GET /api/link-preview?url=<booking link>
// Browsers can't read booking pages themselves (no CORS), so this Cloudflare Pages Function
// fetches the page, follows share-link redirects, and returns the name, address, coordinates,
// rating and photo the page publishes about itself. Only booking sites are allowed.
import { isPreviewHost } from "../../assets/js/lib/booking.js";
import { parsePageMeta } from "../../assets/js/lib/pagemeta.js";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};
const DAY = 86400;

const json = (body, maxAge = 0) => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
});

export async function onRequestGet({ request, waitUntil }) {
  let target;
  try { target = new URL(new URL(request.url).searchParams.get("url") ?? ""); } catch { return json({ ok: false, error: "bad-url" }); }
  if (!/^https?:$/.test(target.protocol) || !isPreviewHost(target.hostname)) return json({ ok: false, error: "not-a-booking-site" });

  const cache = caches.default;
  const key = new Request(`https://link-preview.internal/v1?u=${encodeURIComponent(target.href)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  let url = target.href;
  let res;
  try {
    for (let hop = 0; hop < 6; hop++) {
      res = await fetch(url, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(8000) });
      const loc = res.status >= 300 && res.status < 400 && res.headers.get("location");
      if (!loc) break;
      const next = new URL(loc, url);
      if (!isPreviewHost(next.hostname)) return json({ ok: false, error: "redirected-elsewhere", url: next.href });
      url = next.href;
    }
  } catch (err) {
    return json({ ok: false, error: err?.name === "TimeoutError" ? "timeout" : "fetch-failed", url });
  }
  if (!res.ok) return json({ ok: false, error: `status-${res.status}`, url });
  if (!/html/i.test(res.headers.get("content-type") ?? "")) return json({ ok: false, error: "not-html", url });

  let html = await res.text();
  // Some sites (Airbnb) answer with a tiny "Redirecting…" page that uses a meta refresh instead of a 3xx.
  // Airbnb's is a self-submitting form that sends you to your country's domain (airbnb.co.uk…).
  const small = html.length < 20000;
  const refresh = small && (html.match(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"'\s>]+)/i)
    ?? (() => { const m = html.match(/<title[^>]*>\s*redirecting to\s+([a-z0-9.-]+\.[a-z]{2,})/i); const u = new URL(url); return m && [, `https://${m[1]}${u.pathname}${u.search}`]; })());
  if (refresh) {
    try {
      const next = new URL(refresh[1].replace(/&amp;/g, "&"), url);
      if (isPreviewHost(next.hostname)) {
        const again = await fetch(next.href, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(8000) });
        if (again.ok && /html/i.test(again.headers.get("content-type") ?? "")) { url = next.href; html = await again.text(); }
      }
    } catch { /* keep the first page */ }
  }
  const probe = new URL(request.url).searchParams.get("probe"); // TEMP: see how a site embeds its data
  if (probe) return json({ bytes: html.length, hits: [...html.matchAll(new RegExp(`.{0,160}${probe.replace(/\W/g, "")}.{0,160}`, "gi"))].slice(0, 12).map((m) => m[0]) });
  const meta = parsePageMeta(html, url);
  // Say what came back, so a blocked site is easy to tell apart from a page we can't parse.
  if (meta.blocked && !meta.name) return json({ ok: false, error: "blocked", url, status: res.status, bytes: html.length, title: (html.match(/<title[^>]*>([\s\S]{0,120})/i)?.[1] ?? "").trim() });
  const out = json({ ok: true, url, ...meta }, DAY);
  waitUntil(cache.put(key, out.clone()));
  return out;
}
