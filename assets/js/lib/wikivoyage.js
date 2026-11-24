// Live "good to know" sections from Wikivoyage for countries without a
// hand-written guide. Keyless and CORS-friendly (origin=*). Text only: the HTML
// is parsed into an inert document and we keep paragraph and list text.
import { pickSections, wikivoyageTitle, wikivoyageUrl } from "./guides.js";

const API = "https://en.wikivoyage.org/w/api.php";
const TIMEOUT = 10000;
const MAX_BLOCKS = 6; // paragraphs or bullet lists per section
const cache = new Map();

async function api(params) {
  const q = new URLSearchParams({ action: "parse", format: "json", formatversion: "2", origin: "*", redirects: "1", ...params });
  const res = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Wikivoyage ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.info || "Wikivoyage error");
  return data.parse;
}

const clean = (t) => t.replace(/\[\d+\]|\[edit\]/g, "").replace(/\s+/g, " ").trim();

/** HTML of one section -> [{ type: "p", text } | { type: "ul", items }], skipping headings and boxes. */
function blocksFrom(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style, script, .mw-editsection, sup.reference, .thumb, figure, table, .noprint, .pagebanner, .toc, #toc, .mw-toc, .toclimit-2, .toclimit-3").forEach((n) => n.remove());
  const blocks = [];
  for (const el of doc.body.querySelectorAll("p, ul, dl")) {
    if (el.closest("li")) continue; // nested lists are part of their parent
    if (el.tagName === "P") {
      const text = clean(el.textContent);
      if (text.length > 20) blocks.push({ type: "p", text });
    } else {
      const items = [...el.querySelectorAll(":scope > li, :scope > dd, :scope > dt")].map((li) => clean(li.textContent)).filter((t) => t.length > 3);
      if (items.length) blocks.push({ type: "ul", items: items.slice(0, 8) });
    }
    if (blocks.length >= MAX_BLOCKS) break;
  }
  return blocks;
}

/** { title, url, sections: [{ key, title, blocks, truncated }] } or throws. */
export function getWikivoyage(countryName) {
  const title = wikivoyageTitle(countryName);
  if (!title) return Promise.reject(new Error("No country"));
  if (!cache.has(title)) {
    const p = (async () => {
      const { sections, title: resolved } = await api({ page: title, prop: "sections" });
      const wanted = pickSections(sections);
      const parts = await Promise.all(wanted.map(async (w) => {
        try {
          const { text } = await api({ page: resolved || title, prop: "text", section: w.index, disableeditsection: "1" });
          const blocks = blocksFrom(text);
          return blocks.length ? { key: w.key, title: w.title, blocks } : null;
        } catch {
          return null;
        }
      }));
      return { title: resolved || title, url: wikivoyageUrl(resolved || title), sections: parts.filter(Boolean) };
    })();
    p.catch(() => cache.delete(title)); // let a later visit retry
    cache.set(title, p);
  }
  return cache.get(title);
}
