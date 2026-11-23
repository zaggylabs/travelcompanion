// Run with: npm test   (no install needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToItems, guessCategory, itemsToCsv, parseCsv } from "../assets/js/lib/csv.js";
import { summarizeBudget } from "../assets/js/lib/budget.js";
import { daysBetween, normalizeTime, parseLooseDate } from "../assets/js/lib/dates.js";
import { parseMoney } from "../assets/js/lib/money.js";

test("parseCsv handles quotes, escaped quotes, commas and newlines in fields", () => {
  assert.deepEqual(parseCsv('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n'), [
    ["a", "b", "c"],
    ["x, y", 'say "hi"', "line1\nline2"],
  ]);
});

test("parseCsv detects semicolons, strips the BOM and drops blank rows", () => {
  assert.deepEqual(parseCsv("﻿Date;Activity;Cost\n\n;;\n2026-06-01;Louvre;17,50\n"), [
    ["Date", "Activity", "Cost"],
    ["2026-06-01", "Louvre", "17,50"],
  ]);
});

test("csvToItems maps a typical hand-made spreadsheet", () => {
  const csv = [
    "Day,Time,Activity,Place,Type,Cost,Paid,Notes",
    '1/6/2026,9:30 AM,Flight to Bali,SIN,Flight,"$1,200.00",1150,Window seat',
    "02/06/2026,7pm,Dinner,Seminyak,,85,,",
    ",,Museum pass,,,62,,",
    ",,,,,,,",
  ].join("\n");
  const { items, skipped } = csvToItems(csv);
  assert.equal(skipped, 0);
  assert.equal(items.length, 3);
  assert.equal(items[0].date, "2026-06-01");
  assert.equal(items[0].time, "09:30");
  assert.equal(items[0].title, "Flight to Bali");
  assert.equal(items[0].location, "SIN");
  assert.equal(items[0].category, "Flights");
  assert.equal(items[0].estimatedCost, 1200);
  assert.equal(items[0].actualCost, 1150);
  assert.equal(items[0].notes, "Window seat");
  assert.equal(items[1].date, "2026-06-02");
  assert.equal(items[1].time, "19:00");
  assert.equal(items[1].category, "Food");
  assert.equal(items[1].actualCost, null);
  assert.equal(items[2].date, "");
  assert.equal(items[2].category, "Activities");
});

test("export then import gives the same items back", () => {
  const { items } = csvToItems(
    'Date,Time,Title,Location,Category,Estimated cost,Actual cost,Notes,Link\n2026-06-03,10:00,"Tour, guided",Rome,Activities,40,38,"Bring ""ID""",https://x.test\n',
  );
  const strip = (list) => list.map((i) => ({ ...i, id: "" }));
  assert.deepEqual(strip(csvToItems(itemsToCsv(items)).items), strip(items));
});

test("rows with no title are skipped", () => {
  assert.equal(csvToItems("Title,Cost\n,10\nHotel,100\n").skipped, 1);
});

test("guessCategory", () => {
  assert.equal(guessCategory("Airbnb in Ubud"), "Lodging");
  assert.equal(guessCategory("Grab to airport"), "Flights"); // airport wins: it's checked first
  assert.equal(guessCategory("Train to Porto"), "Transport");
  assert.equal(guessCategory("lodging"), "Lodging");
  assert.equal(guessCategory("misc"), "Other");
});

test("summarizeBudget uses actual cost when paid, estimate otherwise", () => {
  const item = (o) => ({ id: "x", date: "2026-06-01", time: "", title: "x", location: "", category: "Other",
    estimatedCost: 0, actualCost: null, notes: "", link: "", ...o });
  const trip = {
    travelers: 2,
    budget: { Food: 100, Lodging: 300 },
    items: [
      item({ category: "Food", estimatedCost: 40, actualCost: 55.1 }),
      item({ category: "Food", estimatedCost: 30, date: "2026-06-02" }),
      item({ category: "Lodging", estimatedCost: 320.2, actualCost: 320.2, date: "" }),
    ],
  };
  const s = summarizeBudget(trip, 3);
  const food = s.categories.find((c) => c.category === "Food");
  assert.deepEqual([food.budget, food.planned, food.spent, food.projected], [100, 70, 55.1, 85.1]);
  assert.equal(s.categories.find((c) => c.category === "Flights").budget, null);
  assert.equal(s.totalBudget, 400);
  assert.equal(s.totalProjected, 405.3);
  assert.equal(s.remaining, -5.3);
  assert.equal(s.projectedPerPerson, 202.65);
  assert.equal(s.projectedPerDay, 135.1);
  assert.deepEqual(s.byDay, { "2026-06-01": 55.1, "2026-06-02": 30, "": 320.2 });
});

test("daysBetween is inclusive and crosses month ends", () => {
  assert.deepEqual(daysBetween("2026-01-30", "2026-02-02"), ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  assert.deepEqual(daysBetween("2026-02-02", "2026-01-30"), []);
  assert.deepEqual(daysBetween("", "2026-01-30"), []);
});

test("parseLooseDate reads day/month/year, falling back to month/day/year", () => {
  assert.equal(parseLooseDate("2026-06-01"), "2026-06-01");
  assert.equal(parseLooseDate("1/6/26"), "2026-06-01");
  assert.equal(parseLooseDate("25/12/2026"), "2026-12-25");
  assert.equal(parseLooseDate("12/25/2026"), "2026-12-25");
  assert.equal(parseLooseDate("31/2/2026"), "");
  assert.equal(parseLooseDate(""), "");
});

test("normalizeTime", () => {
  assert.equal(normalizeTime("12am"), "00:00");
  assert.equal(normalizeTime("12:15 pm"), "12:15");
  assert.equal(normalizeTime("0930"), "09:30");
  assert.equal(normalizeTime("25:00"), "");
  assert.equal(normalizeTime("noonish"), "");
});

test("parseMoney", () => {
  for (const [input, expected] of [
    ["$1,234.50", 1234.5], ["1.234,50 €", 1234.5], ["S$12,5", 12.5], ["1,234", 1234],
    ["(20)", -20], ["", null], ["n/a", null],
  ]) assert.equal(parseMoney(input), expected, input);
});
