import { parseLooseDate } from "./dates";
import { newId } from "./ids";
import { parseMoney } from "./money";
import { CATEGORIES, isCategory, type Category, type ItineraryItem } from "./types";

/** RFC 4180-style CSV parser: quoted fields, escaped quotes, CRLF or LF. Detects ; or tab delimiters. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => escapeCell(String(c))).join(",")).join("\r\n") + "\r\n";
}

export const EXPORT_HEADERS = [
  "Date",
  "Time",
  "Title",
  "Location",
  "Category",
  "Estimated cost",
  "Actual cost",
  "Notes",
  "Link",
];

export function itemsToCsv(items: ItineraryItem[]): string {
  const sorted = [...items].sort((a, b) =>
    (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time),
  );
  return toCsv([
    EXPORT_HEADERS,
    ...sorted.map((i) => [
      i.date,
      i.time,
      i.title,
      i.location,
      i.category,
      i.estimatedCost,
      i.actualCost ?? "",
      i.notes,
      i.link,
    ]),
  ]);
}

type Field = "date" | "time" | "title" | "location" | "category" | "estimatedCost" | "actualCost" | "notes" | "link";

/** Header names people tend to use in their own sheets, lowercased with spaces/punctuation removed. */
const HEADER_ALIASES: Record<Field, string[]> = {
  date: ["date", "day", "when"],
  time: ["time", "start", "starttime", "hour"],
  title: ["title", "activity", "item", "event", "what", "description", "name", "plan"],
  location: ["location", "place", "where", "address", "city", "venue"],
  category: ["category", "type", "kind"],
  estimatedCost: ["estimatedcost", "estimate", "estimated", "cost", "price", "plannedcost", "planned", "budget", "amount"],
  actualCost: ["actualcost", "actual", "spent", "paid", "paidamount"],
  notes: ["notes", "note", "comments", "comment", "details"],
  link: ["link", "url", "website", "booking", "bookinglink"],
};

const normalize = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

export function mapHeaders(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  const norm = headers.map(normalize);
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    for (const alias of HEADER_ALIASES[field]) {
      const idx = norm.findIndex((h, i) => h === alias && !Object.values(map).includes(i));
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

/** Guesses a category from free text, e.g. "Hotel" -> Lodging. */
export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  const exact = CATEGORIES.find((c) => c.toLowerCase() === t.trim());
  if (exact) return exact;
  const rules: [Category, RegExp][] = [
    ["Flights", /flight|airline|plane|airport/],
    ["Lodging", /hotel|hostel|airbnb|lodg|stay|accommodation|resort|room/],
    ["Transport", /train|tram|bus|taxi|uber|lyft|car|metro|subway|ferry|transport|transfer|rail|gas|fuel/],
    ["Food", /food|dinner|lunch|breakfast|restaurant|cafe|coffee|meal|drink|bar|brunch|groceries/],
    ["Activities", /tour|museum|ticket|activit|park|show|hike|excursion|entry|admission|sightsee|tasting|class|spa|beach/],
    ["Shopping", /shop|souvenir|gift|market|mall/],
  ];
  return rules.find(([, re]) => re.test(t))?.[0] ?? "Other";
}

export interface ImportResult {
  items: ItineraryItem[];
  skipped: number;
  /** Which of our fields were found in the file's header row. */
  matchedColumns: Field[];
}

export function csvToItems(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { items: [], skipped: 0, matchedColumns: [] };
  const map = mapHeaders(rows[0]);
  const get = (row: string[], f: Field) => (map[f] === undefined ? "" : (row[map[f]!] ?? "").trim());

  const items: ItineraryItem[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const title = get(row, "title") || get(row, "location");
    if (!title) {
      skipped++;
      continue;
    }
    const rawCategory = get(row, "category");
    const category = isCategory(rawCategory) ? rawCategory : guessCategory(rawCategory || title);
    items.push({
      id: newId(),
      date: parseLooseDate(get(row, "date")),
      time: normalizeTime(get(row, "time")),
      title,
      location: get(row, "title") ? get(row, "location") : "",
      category,
      estimatedCost: parseMoney(get(row, "estimatedCost")) ?? 0,
      actualCost: parseMoney(get(row, "actualCost")),
      notes: get(row, "notes"),
      link: get(row, "link"),
    });
  }
  return { items, skipped, matchedColumns: Object.keys(map) as Field[] };
}

/** "9:30 pm" -> "21:30", "0930" -> "09:30". Returns "" if unrecognized. */
export function normalizeTime(value: string): string {
  const m = value.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3];
  if (ampm?.startsWith("p") && h < 12) h += 12;
  if (ampm?.startsWith("a") && h === 12) h = 0;
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
