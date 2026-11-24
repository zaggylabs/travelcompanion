import test from "node:test";
import assert from "node:assert/strict";
import { arrivals, nextDate, travelTitle, travelTimes } from "../assets/js/lib/travel.js";
import { dayBase, dayCountry } from "../assets/js/lib/regions.js";

const days = ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"];
const fly = (date, from, to, extra = {}) => ({ id: `${from}-${to}`, date, time: "08:00", title: "", travel: { mode: "flight", from, to, arrive: "15:00", ...extra } });

test("travel titles and times", () => {
  assert.equal(travelTitle({ mode: "flight", number: "SQ 12", from: "Singapore", to: "Tokyo" }), "Flight SQ 12 · Singapore → Tokyo");
  assert.equal(travelTitle({ mode: "train", from: "Tokyo", to: "Kyoto" }), "Train · Tokyo → Kyoto");
  assert.equal(travelTimes({ time: "23:00", travel: { arrive: "07:00", nextDay: true } }), "23:00 → 07:00 (+1)");
  assert.equal(nextDate("2026-12-31"), "2027-01-01");
});

test("arrivals land on the arrival date and skip places off the trip", () => {
  const items = [fly(days[0], "Singapore", "Tokyo"), fly(days[2], "Tokyo", "Seoul", { nextDay: true }), fly(days[3], "Seoul", "Singapore")];
  assert.deepEqual(arrivals(items, (n) => n !== "Singapore"), { [days[0]]: "Tokyo", [days[3]]: "Seoul" });
});

test("a travel plan's arrival city becomes the day's base until a later 📍", () => {
  const trip = {
    countries: ["JP", "KR"],
    cities: [{ name: "Tokyo", country: "JP" }, { name: "Seoul", country: "KR" }],
    dayBases: { "2026-12-04": { city: "Tokyo" } },
    items: [fly(days[0], "Singapore", "Tokyo"), fly(days[1], "Tokyo", "Seoul")],
  };
  assert.equal(dayBase(trip, days[0], days).city, "Tokyo");
  assert.equal(dayBase(trip, days[0], days).arrived, true);
  assert.equal(dayBase(trip, days[1], days).city, "Seoul");
  assert.equal(dayBase(trip, days[2], days).city, "Seoul", "carries on after arriving");
  assert.equal(dayCountry(trip, days[2], days), "KR");
  assert.equal(dayBase(trip, days[3], days).city, "Tokyo", "a 📍 you set wins");
});

test("landing in a country puts you in its first city on the trip", () => {
  const trip = { countries: ["JP"], cities: [{ name: "Osaka", country: "JP" }, { name: "Tokyo", country: "JP" }], dayBases: {}, items: [fly(days[0], "Singapore", "Japan")] };
  assert.equal(dayBase(trip, days[1], days).city, "Osaka");
});
