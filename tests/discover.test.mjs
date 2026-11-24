// Discover tab. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, dietsOf, cacheKey, cleanKeyword, distanceM, formatDistance, infoScore, parsePhoton, parseResults, photonUrl, prettyCuisine, sortResults } from "../assets/js/lib/discover.js";

test("keywords can't break out of the Overpass query", () => {
  assert.equal(cleanKeyword('ramen"];out;'), "ramen out");
  assert.equal(cleanKeyword("  bubble   tea "), "bubble tea");
  assert.equal(cleanKeyword("ラーメン"), "ラーメン");
  assert.equal(cleanKeyword("a".repeat(80)).length, 40);
});

test("the query asks for named places of the type around the spot", () => {
  const q = buildQuery({ type: "food", lat: 35.6595, lon: 139.7005, radius: 1000, keyword: "" });
  assert.match(q, /\[out:json\]/);
  assert.match(q, /nwr\(around:1000,35\.65950,139\.70050\)\["amenity"~"\^\(restaurant\|fast_food\|food_court\)\$"\]\["name"\];/);
  assert.match(q, /out tags center 300;/);
  const k = buildQuery({ type: "food", lat: 1, lon: 2, radius: 99999, keyword: "bubble tea" });
  assert.match(k, /around:2000,/, "radius is capped");
  assert.match(k, /->\.c;/);
  assert.match(k, /nwr\.c\["name"~"bubble\[ _\]tea",i\]/);
  assert.match(k, /nwr\.c\["cuisine"~"bubble\[ _\]tea",i\]/);
  const s = buildQuery({ type: "sights", lat: 1, lon: 2, radius: 500, keyword: "castle" });
  assert.doesNotMatch(s, /cuisine/);
  assert.match(s, /place_of_worship"\]\["wikidata"\]/);
});

test("distances read nicely", () => {
  assert.equal(formatDistance(4), "10 m");
  assert.equal(formatDistance(243), "240 m");
  assert.equal(formatDistance(1530), "1.5 km");
  assert.equal(formatDistance(NaN), "");
  const d = distanceM({ lat: 35.6595, lon: 139.7005 }, { lat: 35.6695, lon: 139.7005 });
  assert.ok(d > 1100 && d < 1120, String(d));
});

test("Overpass results become a de-duplicated list, nearest first", () => {
  const center = { lat: 35.0, lon: 139.0 };
  const results = parseResults([
    { type: "node", id: 1, lat: 35.005, lon: 139.0, tags: { name: "Far Ramen", amenity: "restaurant", cuisine: "japanese;ramen", opening_hours: "Mo-Su 11:00-23:00" } },
    { type: "way", id: 2, center: { lat: 35.001, lon: 139.0 }, tags: { name: "一蘭", "name:en": "Ichiran", amenity: "fast_food", website: "https://ichiran.com", wikidata: "Q1" } },
    { type: "node", id: 3, lat: 35.001, lon: 139.0, tags: { name: "一蘭", "name:en": "Ichiran", amenity: "fast_food" } },
    { type: "node", id: 4, lat: 35.002, lon: 139.0, tags: { amenity: "restaurant" } },
  ], center);
  assert.deepEqual(results.map((r) => r.name), ["Ichiran", "Far Ramen"]);
  assert.equal(results[0].osm, "W2");
  assert.equal(results[0].localName, "一蘭");
  assert.equal(results[0].kind, "Fast food");
  assert.equal(results[1].cuisine, "Japanese, ramen");
  assert.equal(results[1].hours, "Mo-Su 11:00-23:00");
  assert.deepEqual(sortResults(results, "info").map((r) => r.name), ["Ichiran", "Far Ramen"]);
  assert.ok(infoScore({ wikidata: "Q1" }) > infoScore({ opening_hours: "24/7" }));
});

test("small helpers", () => {
  assert.equal(prettyCuisine("bubble_tea"), "Bubble tea");
  assert.equal(prettyCuisine(""), "");
  assert.equal(cacheKey({ type: "food", lat: 1.234567, lon: 2, radius: 500, keyword: " Ramen " }), "food|1.2346|2.0000|500|ramen|");
  assert.equal(cacheKey({ type: "food", lat: 1, lon: 2, radius: 500, keyword: "", diet: "halal" }), "food|1.0000|2.0000|500||halal");
  assert.equal(cacheKey({ type: "sights", lat: 1, lon: 2, radius: 500, keyword: "", diet: "halal" }), "sights|1.0000|2.0000|500||");
});

test("when Overpass is busy, Photon gives a basic list in the same shape", () => {
  const plain = new URL(photonUrl({ type: "food", lat: 35.66, lon: 139.7, radius: 1000, keyword: "" }));
  assert.equal(plain.pathname, "/reverse");
  assert.equal(plain.searchParams.get("radius"), "1");
  assert.deepEqual(plain.searchParams.getAll("osm_tag"), ["amenity:restaurant", "amenity:fast_food", "amenity:food_court"]);
  const kw = new URL(photonUrl({ type: "food", lat: 35.66, lon: 139.7, radius: 1000, keyword: "ramen" }));
  assert.equal(kw.pathname, "/api/");
  assert.equal(kw.searchParams.get("q"), "ramen");
  assert.equal(kw.searchParams.get("bbox").split(",").length, 4);
  const res = parsePhoton([
    { geometry: { coordinates: [139.7, 35.661] }, properties: { name: "Ramen Nagi", osm_type: "N", osm_id: 5, osm_key: "amenity", osm_value: "fast_food" } },
    { geometry: { coordinates: [139.7, 35.70] }, properties: { name: "Too far", osm_type: "N", osm_id: 6, osm_key: "amenity", osm_value: "restaurant" } },
  ], { lat: 35.66, lon: 139.7 }, 1000);
  assert.deepEqual(res.map((r) => [r.osm, r.name, r.kind]), [["N5", "Ramen Nagi", "Fast food"]]);
});

test("dietary filters: tags, names and cuisines count, and only for food and cafés", () => {
  const q = buildQuery({ type: "food", lat: 1, lon: 2, radius: 1000, keyword: "ramen", diet: "halal" });
  assert.match(q, /nwr\.c\["diet:halal"~"\^\(yes\|only\)\$"\]; nwr\.c\["name"~"halal",i\]; nwr\.c\["cuisine"~"halal",i\];\)->\.d;/);
  assert.match(q, /\(nwr\.d\["name"~"ramen",i\]; nwr\.d\["cuisine"~"ramen",i\];\)->\.k;\n\.k out/);
  assert.match(buildQuery({ type: "food", lat: 1, lon: 2, radius: 1000, diet: "vegetarian" }), /"diet:vegetarian".*"diet:vegan"/);
  assert.doesNotMatch(buildQuery({ type: "sights", lat: 1, lon: 2, radius: 1000, diet: "halal" }), /halal/);
  assert.deepEqual(dietsOf({ "diet:halal": "yes" }, "Ichiran"), [{ key: "halal", label: "Halal options" }]);
  assert.deepEqual(dietsOf({ "diet:halal": "only" }, "Naritaya"), [{ key: "halal", label: "Halal" }]);
  assert.deepEqual(dietsOf({ cuisine: "vegan" }, "T's Tantan"), [{ key: "vegan", label: "Vegan" }]);
  assert.deepEqual(dietsOf({}, "Gluten-Free Bakery"), [{ key: "gluten_free", label: "Gluten-free" }]);
  assert.deepEqual(dietsOf({ "diet:halal": "no" }, "Halal Corner"), []);
  assert.deepEqual(dietsOf({}, "Ramen Nagi"), []);
  const p = new URL(photonUrl({ type: "food", lat: 1, lon: 2, radius: 1000, keyword: "ramen", diet: "halal" }));
  assert.equal(p.searchParams.get("q"), "halal");
});
