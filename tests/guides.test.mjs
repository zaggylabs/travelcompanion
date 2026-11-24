// Guide tab helpers. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDES, getGuide, isSchengen, pickSections, visaFor, visaOverviewLink, wikivoyageTitle, wikivoyageUrl } from "../assets/js/lib/guides.js";

test("every curated guide has the sections the tab shows and only https links", () => {
  for (const [code, g] of Object.entries(GUIDES)) {
    assert.ok(g.visa.general, `${code} visa.general`);
    for (const k of ["dos", "donts", "money", "transport", "emergency"]) assert.ok(g[k].length > 0, `${code}.${k}`);
    assert.ok(g.plugs, `${code}.plugs`);
    const links = [...g.visa.links, ...g.links, ...g.visa.steps.map((s) => s.link).filter(Boolean)];
    for (const l of links) assert.match(l.url, /^https:\/\//, `${code} ${l.label}`);
  }
  assert.ok(getGuide("jp"));
  assert.equal(getGuide("ZZ"), null);
});

test("visa line is tailored only where it was checked", () => {
  const jp = getGuide("JP");
  assert.match(visaFor(jp, "JP", "SG").specific, /Singapore passport/);
  assert.equal(visaFor(jp, "JP", "SG").checkList, false);
  const fr = visaFor(jp, "JP", "FR");
  assert.equal(fr.specific, null);
  assert.equal(fr.checkList, true);
  assert.deepEqual(visaFor(jp, "JP", "jp"), { home: true });
  assert.equal(visaFor(null, "PE", "SG").checkList, true);
});

test("links that work for any country", () => {
  assert.equal(visaOverviewLink("SG").url, "https://en.wikipedia.org/wiki/Visa_requirements_for_Singaporean_citizens");
  assert.equal(visaOverviewLink("US").url, "https://en.wikipedia.org/wiki/Visa_requirements_for_United_States_citizens");
  assert.equal(visaOverviewLink("ZZ"), null);
  assert.equal(wikivoyageTitle("Myanmar (Burma)"), "Myanmar");
  assert.equal(wikivoyageUrl("New Zealand"), "https://en.wikivoyage.org/wiki/New_Zealand");
  assert.ok(isSchengen("fr") && !isSchengen("GB"));
});

test("pickSections finds the useful Wikivoyage sections", () => {
  const sections = [
    { toclevel: 1, line: "Understand", index: "1" },
    { toclevel: 1, line: "Get in", index: "5" },
    { toclevel: 2, line: "Entry requirements", index: "6" },
    { toclevel: 1, line: "Buy", index: "10" },
    { toclevel: 2, line: "Money", index: "11" },
    { toclevel: 1, line: "Respect", index: "20" },
    { toclevel: 1, line: "Stay safe", index: "21" },
    { toclevel: 3, line: "Respect", index: "T-1" },
  ];
  assert.deepEqual(pickSections(sections).map((s) => [s.key, s.index]), [["entry", "6"], ["respect", "20"], ["safe", "21"], ["money", "11"]]);
  assert.deepEqual(pickSections([]), []);
});

test("country facts: plugs, emergency numbers, driving side", async () => {
  const { getFacts, emergencyRows, plugAdvice } = await import("../assets/js/lib/countryfacts.js");
  const es = getFacts("es"), sg = getFacts("SG"), jp = getFacts("JP"), gb = getFacts("GB");
  assert.equal(es.drive, "right");
  assert.equal(gb.drive, "left");
  assert.deepEqual(emergencyRows(es), [["Police, ambulance and fire", "112"]]);
  assert.deepEqual(emergencyRows(sg), [["Police", "999"], ["Ambulance and fire", "995"]]);
  assert.deepEqual(emergencyRows(getFacts("MZ")), []);
  assert.match(plugAdvice(es, sg, "Singapore"), /Types C and F, 230 V\. Plugs from Singapore \(Type G\) need an adapter\.$/);
  assert.match(plugAdvice(gb, sg, "Singapore"), /Plugs from Singapore fit\./);
  assert.match(plugAdvice(jp, sg, "Singapore"), /voltage is different/);
  for (const code of Object.keys((await import("../assets/js/lib/guides.js")).GUIDES)) assert.ok(getFacts(code), `facts for ${code}`);
});
