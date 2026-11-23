// Place info panel helpers. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { crowdTip, dayNote, kindFromTags, parseOsmRef, parseWikipediaTag, prettyHours } from "../assets/js/lib/placeinfo.js";
import { rankPlaces } from "../assets/js/lib/places.js";

test("prettyHours makes OSM opening_hours readable", () => {
  assert.deepEqual(prettyHours("Mo-Fr 09:00-17:00; Sa,Su 10:00-18:00; PH off"),
    ["Mon–Fri 09:00–17:00", "Sat, Sun 10:00–18:00", "Public holidays closed"]);
  assert.deepEqual(prettyHours("Mo-Su 06:00-17:00"), ["Every day 06:00–17:00"]);
  assert.deepEqual(prettyHours("24/7"), ["Open 24 hours, every day"]);
  assert.deepEqual(prettyHours(""), []);
  assert.deepEqual(prettyHours(undefined), []);
});

test("OSM and Wikipedia references parse", () => {
  assert.deepEqual(parseOsmRef("W1282875870"), { type: "way", id: 1282875870, letter: "W" });
  assert.equal(parseOsmRef("X1"), null);
  assert.deepEqual(parseWikipediaTag("ja:東京ディズニーランド"), { lang: "ja", title: "東京ディズニーランド" });
  assert.equal(parseWikipediaTag("nope"), null);
  assert.equal(kindFromTags({ building: "yes", tourism: "theme_park" }), "tourism=theme_park");
});

test("rankPlaces keeps the OSM reference for the info panel", () => {
  const [p] = rankPlaces([{ properties: { name: "Tokyo Disneyland", osm_type: "W", osm_id: 1282875870, osm_key: "tourism", osm_value: "theme_park" }, geometry: { coordinates: [139.88, 35.63] } }], "tokyo disneyland");
  assert.equal(p.osm, "W1282875870");
});

test("dayNote states facts about the day, never made-up crowd levels", () => {
  const hols = [{ date: "2026-11-23", name: "Labour Thanksgiving Day", localName: "勤労感謝の日" }];
  assert.match(dayNote("2026-11-23", hols).text, /public holiday \(Labour Thanksgiving Day/);
  assert.equal(dayNote("2026-11-23", hols).busy, true);
  assert.match(dayNote("2026-11-28", hols).text, /Saturday/);
  assert.match(dayNote("2026-11-24", hols).text, /next to a public holiday/);
  const quiet = dayNote("2026-12-01", hols);
  assert.equal(quiet.busy, false);
  assert.match(quiet.text, /Tuesday/);
  assert.equal(dayNote("", hols), null);
});

test("crowdTip gives a general tip by kind of place", () => {
  assert.match(crowdTip("tourism=theme_park"), /weekends/);
  assert.match(crowdTip("", "Food"), /12–1 pm/);
  assert.equal(crowdTip("", "Other"), "");
});
