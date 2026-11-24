import test from "node:test";
import assert from "node:assert/strict";
import { cityCountry, dayCountry, tripCountries } from "../assets/js/lib/regions.js";
import { itemCurrency, summarizeBudget } from "../assets/js/lib/budget.js";
import { csvToItems, itemsToCsv } from "../assets/js/lib/csv.js";

const days = ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"];

test("older one-country trips read as a list of one", () => {
  assert.deepEqual(tripCountries({ country: "JP" }), ["JP"]);
  assert.deepEqual(tripCountries({ country: "" }), []);
  assert.deepEqual(tripCountries({ country: "ES", countries: ["ES", "FR", "ES"] }), ["ES", "FR"]);
  assert.equal(cityCountry({ country: "JP", destination: "Tokyo & Osaka" }, "Osaka"), "JP", "cities saved without a country are in the trip's");
  assert.equal(dayCountry({ country: "JP" }, days[2], days), "JP");
});

test("each day of a multi-country trip is in its city's country", () => {
  const trip = {
    country: "ES", countries: ["ES", "FR"],
    cities: [{ name: "Barcelona", country: "ES" }, { name: "Paris", country: "FR" }],
    dayBases: { "2026-12-01": { city: "Barcelona" }, "2026-12-03": { city: "Paris", area: "Le Marais" } },
  };
  assert.equal(dayCountry(trip, days[0], days), "ES");
  assert.equal(dayCountry(trip, days[1], days), "ES", "a day you didn't set stays where you were");
  assert.equal(dayCountry(trip, days[2], days), "FR");
  assert.equal(dayCountry(trip, days[3], days), "FR");
  assert.equal(dayCountry(trip, "", days), "ES", "unscheduled counts as the first country");
  assert.equal(dayCountry({ ...trip, dayBases: {} }, days[2], days), "ES");
});

test("budget totals convert plans in other currencies, and say which couldn't be", () => {
  const plan = (id, cost, currency, extra = {}) => ({ id, date: days[0], time: "", title: id, location: "", category: "Food", estimatedCost: cost, actualCost: null, notes: "", link: "", ...(currency ? { currency } : {}), ...extra });
  const trip = { currency: "SGD", travelers: 2, budget: {}, items: [plan("a", 100, "EUR"), plan("b", 50, "", { paid: true, actualCost: 40 }), plan("c", 1000, "KRW")] };
  const rates = { EUR: 1.5 };
  const convert = (amount, from, to) => (from === to ? amount : to === "SGD" && rates[from] ? amount * rates[from] : null);
  assert.equal(itemCurrency(trip.items[0], trip), "EUR");
  assert.equal(itemCurrency(trip.items[1], trip), "SGD");
  const s = summarizeBudget(trip, 4, convert);
  assert.equal(s.totalProjected, 190); // 100 EUR = 150 SGD, + 40 SGD paid
  assert.equal(s.totalSpent, 40);
  assert.equal(s.byDay[days[0]], 190);
  assert.deepEqual(s.byCurrency, { EUR: 100, SGD: 40, KRW: 1000 });
  assert.deepEqual(s.unconverted, ["KRW"]);
  // Without a converter only the trip's own currency counts, as before.
  assert.equal(summarizeBudget(trip, 4).totalProjected, 40);
});

test("CSV keeps each plan's currency", () => {
  const { items } = csvToItems("Date,Title,Cost,Currency\n2026-12-01,Tapas,30,eur\n2026-12-03,Louvre,22,\n");
  assert.equal(items[0].currency, "EUR");
  assert.equal("currency" in items[1], false);
  const csv = itemsToCsv(items, "SGD");
  assert.match(csv, /Tapas,,\w+,30,EUR,/);
  assert.match(csv, /Louvre,,\w+,22,SGD,/);
  assert.equal(csvToItems(csv).items[1].currency, "SGD");
});
