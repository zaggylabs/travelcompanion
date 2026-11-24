// Saved places. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { IDEA_GROUPS, emptyIdea, groupForPlace, groupIdeas, groupOf, ideaToItem } from "../assets/js/lib/ideas.js";

test("picked places land in a sensible group", () => {
  assert.equal(groupForPlace({ category: "Food", kind: "restaurant" }), "Food");
  assert.equal(groupForPlace({ category: "Activities", kind: "theme park" }), "Activities");
  assert.equal(groupForPlace({ category: "Activities", kind: "attraction" }), "Sights");
  assert.equal(groupForPlace({ category: "Lodging", kind: "hotel" }), "Stays");
  assert.equal(groupForPlace({ category: null, kind: "neighbourhood" }), "Sights");
  assert.equal(groupForPlace({ category: "Transport", kind: "station" }), null);
});

test("adding a saved place makes a plan with its details", () => {
  const idea = { ...emptyIdea("Food"), title: "Ichiran Shibuya", location: "Shibuya, Tokyo", notes: "go late", link: "https://maps", place: { osm: "N1" } };
  const item = ideaToItem(idea, "2026-12-02", "21:30");
  assert.equal(item.title, "Ichiran Shibuya");
  assert.equal(item.category, "Food");
  assert.equal(item.date, "2026-12-02");
  assert.equal(item.time, "21:30");
  assert.equal(item.notes, "go late");
  assert.deepEqual(item.place, { name: "Ichiran Shibuya", osm: "N1" });
  assert.equal(item.fromIdea, idea.id);
  assert.notEqual(item.id, idea.id);
  assert.equal(ideaToItem({ ...idea, group: "Stays" }, "", "").category, "Lodging");
  assert.equal(groupOf("nonsense").key, "Other");
  assert.equal(ideaToItem({ ...idea, bookingLink: "https://www.booking.com/hotel/jp/x.html" }, "", "").link, "https://www.booking.com/hotel/jp/x.html");
});

test("groups keep their order and put added places last", () => {
  const a = { id: "a", group: "Food" }, b = { id: "b", group: "Sights" }, c = { id: "c", group: "Food" }, d = { id: "d", group: "weird" };
  const g = groupIdeas([a, b, c, d], (i) => i.id === "a");
  assert.deepEqual(g.map((x) => x.key), ["Food", "Sights", "Other"]);
  assert.deepEqual(g[0].ideas.map((i) => i.id), ["c", "a"]);
  assert.equal(IDEA_GROUPS.length, 6);
});
