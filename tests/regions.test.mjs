// Trip cities and where each day is based. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseLabel, basePoint, dayBase, destinationText, parseDestination, popularAreas, popularCities, tripCities } from "../assets/js/lib/regions.js";
import { nearBoost, rankPlaces } from "../assets/js/lib/places.js";

const days = ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"];

test("popular cities and areas come from the country and city", () => {
  assert.equal(popularCities("jp")[0], "Tokyo");
  assert.deepEqual(popularCities("ZZ"), []);
  assert.ok(popularAreas("JP", "tokyo").includes("Shibuya"));
  assert.deepEqual(popularAreas("KR", "Tokyo"), []);
});

test("older trips' destination text becomes a list of cities", () => {
  assert.deepEqual(parseDestination("Tokyo & Osaka"), ["Tokyo", "Osaka"]);
  assert.deepEqual(parseDestination("Tokyo, Kyoto and Osaka"), ["Tokyo", "Kyoto", "Osaka"]);
  assert.deepEqual(tripCities({ destination: "Bali" }), [{ name: "Bali" }]);
  assert.deepEqual(tripCities({ destination: "ignored", cities: [{ name: "Seoul" }] }), [{ name: "Seoul" }]);
  assert.equal(destinationText([{ name: "Tokyo" }, { name: "Kyoto" }, { name: "Osaka" }]), "Tokyo, Kyoto & Osaka");
  assert.equal(destinationText([]), "");
});

test("a day you don't set stays in the last city you picked", () => {
  const trip = {
    cities: [{ name: "Tokyo", lat: 35.68, lon: 139.76 }, { name: "Osaka", lat: 34.69, lon: 135.5 }],
    dayBases: { "2026-12-01": { city: "Tokyo", area: "Shibuya", lat: 35.66, lon: 139.7 }, "2026-12-03": { city: "Osaka" } },
  };
  assert.equal(dayBase(trip, days[0], days).set, true);
  assert.equal(baseLabel(dayBase(trip, days[0], days)), "Tokyo › Shibuya");
  const d2 = dayBase(trip, days[1], days);
  assert.equal(baseLabel(d2), "Tokyo", "the area doesn't carry over");
  assert.equal(d2.from, 0);
  assert.deepEqual(basePoint(trip, d2), { lat: 35.68, lon: 139.76 });
  assert.equal(baseLabel(dayBase(trip, days[3], days)), "Osaka");
  assert.deepEqual(basePoint(trip, dayBase(trip, days[2], days)), { lat: 34.69, lon: 135.5 }, "a city-only day uses the city's spot");
});

test("one-city trips are in that city every day; otherwise nothing is guessed", () => {
  assert.equal(dayBase({ destination: "Bali" }, days[2], days).city, "Bali");
  assert.equal(dayBase({ destination: "Tokyo & Osaka" }, days[0], days), null);
  assert.equal(basePoint({ destination: "Bali" }, { city: "Bali" }), null, "no spot until it's been looked up");
});

test("suggestions near the day's area rank higher", () => {
  const f = (name, lat, lon, value = "attraction") => ({ geometry: { coordinates: [lon, lat] }, properties: { name, osm_key: "tourism", osm_value: value, city: "x" } });
  const far = f("Sky Tower Far", 34.69, 135.5);
  const near = f("Sky Tower Near", 35.66, 139.7);
  assert.equal(rankPlaces([far, near], "sky")[0].name, "Sky Tower Far", "no bias: Photon's order wins");
  assert.equal(rankPlaces([far, near], "sky", 8, { near: { lat: 35.66, lon: 139.71 } })[0].name, "Sky Tower Near");
  assert.equal(nearBoost(1), 4);
  assert.equal(nearBoost(500), 0);
  assert.equal(nearBoost(NaN), 0);
});

test("the city picker only offers cities, towns and districts", () => {
  const city = { geometry: { coordinates: [139.7, 35.6] }, properties: { name: "Tokyo", osm_key: "place", osm_value: "city" } };
  const shop = { geometry: { coordinates: [139.7, 35.6] }, properties: { name: "Tokyo Shop", osm_key: "shop", osm_value: "gift" } };
  assert.deepEqual(rankPlaces([shop, city], "tok", 8, { only: "settlement" }).map((p) => p.name), ["Tokyo"]);
});
