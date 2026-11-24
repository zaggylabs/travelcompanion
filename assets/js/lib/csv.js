import { CATEGORIES, isCategory, newId } from "./constants.js";
import { normalizeTime, parseLooseDate } from "./dates.js";
import { parseMoney } from "./money.js";

/** RFC 4180-style CSV parser (quoted fields, "" escapes, CRLF/LF). Detects , ; or tab. */
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const escapeCell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows) {
  return rows.map((r) => r.map((c) => escapeCell(String(c))).join(",")).join("\r\n") + "\r\n";
}

export const EXPORT_HEADERS = ["Date", "Time", "Title", "Location", "Category", "Cost", "Currency", "Notes", "Link"];

/** `currency` is the trip's: plans without their own currency are written with it. */
export function itemsToCsv(items, currency = "") {
  const sorted = [...items].sort((a, b) =>
    (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time));
  return toCsv([
    EXPORT_HEADERS,
    ...sorted.map((i) => [i.date, i.time, i.title, i.location, i.category, (i.actualCost ?? i.estimatedCost) || 0, i.currency || currency, i.notes, i.link]),
  ]);
}

/** Header names people use in their own sheets (lowercase, letters only). */
const HEADER_ALIASES = {
  date: ["date", "day", "when"],
  time: ["time", "start", "starttime", "hour"],
  title: ["title", "activity", "item", "event", "what", "description", "name", "plan"],
  location: ["location", "place", "where", "address", "city", "venue"],
  category: ["category", "type", "kind"],
  estimatedCost: ["estimatedcost", "estimate", "estimated", "cost", "price", "plannedcost", "planned", "budget", "amount"],
  actualCost: ["actualcost", "actual", "spent", "paid", "paidamount"],
  currency: ["currency", "cur", "ccy"],
  notes: ["notes", "note", "comments", "comment", "details"],
  link: ["link", "url", "website", "booking", "bookinglink"],
};

export function mapHeaders(headers) {
  const map = {};
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  for (const field of Object.keys(HEADER_ALIASES)) {
    for (const alias of HEADER_ALIASES[field]) {
      const idx = norm.findIndex((h, i) => h === alias && !Object.values(map).includes(i));
      if (idx !== -1) { map[field] = idx; break; }
    }
  }
  return map;
}

/** Guesses a category from free text, e.g. "Hotel" -> Lodging. */
export function guessCategory(text) {
  const t = String(text).toLowerCase();
  const exact = CATEGORIES.find((c) => c.toLowerCase() === t.trim());
  if (exact) return exact;
  const rules = [
    ["Flights", /flight|airline|plane|airport/],
    ["Lodging", /hotel|hostel|airbnb|lodg|stay|accommodation|resort|room/],
    ["Transport", /train|tram|bus|taxi|uber|lyft|grab|car|metro|subway|mrt|ferry|transport|transfer|rail|gas|fuel/],
    ["Food", /food|dinner|lunch|breakfast|restaurant|cafe|coffee|meal|drink|bar|brunch|groceries|hawker/],
    ["Activities", /tour|museum|ticket|activit|park|show|hike|excursion|entry|admission|sightsee|tasting|class|spa|beach/],
    ["Shopping", /shop|souvenir|gift|market|mall/],
  ];
  return rules.find(([, re]) => re.test(t))?.[0] ?? "Other";
}

/** Turns a CSV file's text into itinerary items. */
export function csvToItems(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { items: [], skipped: 0, matchedColumns: [] };
  const map = mapHeaders(rows[0]);
  const get = (row, f) => (map[f] === undefined ? "" : (row[map[f]] ?? "").trim());

  const items = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const title = get(row, "title") || get(row, "location");
    if (!title) { skipped++; continue; }
    const rawCategory = get(row, "category");
    const currency = get(row, "currency").toUpperCase();
    items.push({
      id: newId(),
      date: parseLooseDate(get(row, "date")),
      time: normalizeTime(get(row, "time")),
      title,
      location: get(row, "title") ? get(row, "location") : "",
      category: isCategory(rawCategory) ? rawCategory : guessCategory(rawCategory || title),
      estimatedCost: parseMoney(get(row, "estimatedCost")) ?? 0,
      actualCost: parseMoney(get(row, "actualCost")),
      notes: get(row, "notes"),
      link: get(row, "link"),
      ...(/^[A-Z]{3}$/.test(currency) ? { currency } : {}),
    });
  }
  return { items, skipped, matchedColumns: Object.keys(map) };
}
