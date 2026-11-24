// Popular column on Discover. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, parsePoint, parsePopular, popularQuery, thumb } from "../assets/js/lib/popular.js";

test("descriptions sort places into things to do, sights, or neither", () => {
  assert.equal(classify("theme park in Japan, owned by The Oriental Land Company"), "do");
  assert.equal(classify("art museum in Tokyo, Japan"), "do");
  assert.equal(classify("tower in Tokyo, Japan"), "see");
  assert.equal(classify("Shinto shrine in Tokyo, Japan"), "see");
  assert.equal(classify("town located in Taitō-ku, Tokyo"), "see");
  assert.equal(classify("special ward in the Tokyo Metropolis, Japan"), null);
  assert.equal(classify("railway and metro station in Chiyoda"), null);
  assert.equal(classify("national university in Tokyo, Japan"), null);
  assert.equal(classify("building in Tokyo, Japan"), null);
  assert.equal(classify(""), null);
});

test("bindings become two ranked lists", () => {
  const b = (id, label, desc, links, img) => ({ item: { value: `http://www.wikidata.org/entity/${id}` }, label: { value: label }, desc: { value: desc }, links: { value: String(links) }, coord: { value: "Point(139.7454 35.6586)" }, ...(img ? { image: { value: img } } : {}) });
  const out = parsePopular([
    b("Q1", "Tokyo", "capital and largest city of Japan", 300),
    b("Q2", "Tokyo Tower", "tower in Tokyo, Japan", 69, "http://commons.wikimedia.org/wiki/Special:FilePath/Tokyo%20Tower.jpg"),
    b("Q2", "Tokyo Tower", "tower in Tokyo, Japan", 69, "http://commons.wikimedia.org/wiki/Special:FilePath/Other.jpg"),
    b("Q3", "Tokyo National Museum", "art museum in Tokyo, Japan", 52),
  ], { lat: 35.68, lon: 139.77 });
  assert.deepEqual(out.see.map((x) => x.name), ["Tokyo Tower"]);
  assert.deepEqual(out.todo.map((x) => x.name), ["Tokyo National Museum"]);
  assert.equal(out.see[0].desc, "Tower in Tokyo, Japan");
  assert.equal(out.see[0].image, "https://commons.wikimedia.org/wiki/Special:FilePath/Tokyo%20Tower.jpg?width=160");
  assert.ok(out.see[0].distance > 2000 && out.see[0].distance < 5000);
  assert.deepEqual(parsePoint("Point(139.7 35.6)"), { lon: 139.7, lat: 35.6 });
  assert.equal(thumb(""), "");
  assert.match(popularQuery(35.6812, 139.7671), /Point\(139\.77 35\.68\)/);
});
