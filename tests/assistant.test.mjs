// Country picker and place suggestions. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_CURRENCIES, COUNTRIES, currencyForCountry, findCountry, flag, searchCountries } from "../assets/js/lib/countries.js";
import { categoryForPlace, mapsLink, rankPlaces } from "../assets/js/lib/places.js";

test("each country has a currency, and picking one sets it", () => {
  assert.ok(COUNTRIES.length > 190);
  assert.equal(currencyForCountry("JP"), "JPY");
  assert.equal(currencyForCountry("fr"), "EUR");
  assert.equal(currencyForCountry("SG"), "SGD");
  for (const c of COUNTRIES) assert.match(c.currency, /^[A-Z]{3}$/, c.code);
  assert.equal(ALL_CURRENCIES[0], "SGD");
  assert.equal(new Set(ALL_CURRENCIES).size, ALL_CURRENCIES.length);
});

test("searchCountries matches names, aliases and prefixes", () => {
  assert.equal(searchCountries("jap")[0].code, "JP");
  assert.equal(searchCountries("korea")[0].code, "KR");
  assert.equal(searchCountries("uk")[0].code, "GB");
  assert.equal(searchCountries("zealand")[0].code, "NZ");
  assert.equal(findCountry("  japan ").code, "JP");
  assert.equal(findCountry("USA").code, "US");
  assert.equal(findCountry("Tokyo"), null);
  assert.equal(flag("JP"), "🇯🇵");
});

const feature = (name, key, value, extra = {}) => ({
  geometry: { coordinates: [139.88, 35.63] },
  properties: { name, osm_key: key, osm_value: value, city: "Urayasu", state: "Chiba Prefecture", country: "Japan", countrycode: "JP", ...extra },
});

test("rankPlaces puts landmarks above shops and hides car parks and duplicates", () => {
  const ranked = rankPlaces([
    feature("Disney store", "shop", "toys", { city: "Tokyo" }),
    feature("Disneyland parking structure", "amenity", "parking"),
    feature("Disney Resort Line", "railway", "monorail"),
    feature("Tokyo Disneyland", "tourism", "theme_park"),
    feature("Tokyo Disneyland", "tourism", "theme_park"),
    feature("Tokyo DisneySea", "tourism", "theme_park"),
  ], "disney");
  assert.deepEqual(ranked.slice(0, 2).map((p) => p.name), ["Tokyo Disneyland", "Tokyo DisneySea"]);
  assert.ok(!ranked.some((p) => p.name.includes("parking")));
  assert.equal(ranked.filter((p) => p.name === "Tokyo Disneyland").length, 1);
  assert.equal(ranked[0].area, "Urayasu, Chiba Prefecture");
  assert.equal(ranked[0].category, "Activities");
});

test("categoryForPlace guesses the itinerary category", () => {
  assert.equal(categoryForPlace({ osm_key: "amenity", osm_value: "restaurant" }), "Food");
  assert.equal(categoryForPlace({ osm_key: "tourism", osm_value: "hotel" }), "Lodging");
  assert.equal(categoryForPlace({ osm_key: "aeroway", osm_value: "aerodrome" }), "Flights");
  assert.equal(categoryForPlace({ osm_key: "railway", osm_value: "station" }), "Transport");
  assert.equal(categoryForPlace({ osm_key: "shop", osm_value: "mall" }), "Shopping");
  assert.equal(categoryForPlace({ osm_key: "office", osm_value: "company" }), null);
});

test("mapsLink builds a Google Maps search link", () => {
  assert.equal(mapsLink({ name: "Tokyo Disneyland", area: "Urayasu", country: "Japan" }),
    "https://www.google.com/maps/search/?api=1&query=Tokyo%20Disneyland%2C%20Urayasu%2C%20Japan");
});
