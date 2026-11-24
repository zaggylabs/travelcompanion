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

import { IDEA_TABS, ideaCost, ideaToItems, nightsBetween, tabOf } from "../assets/js/lib/ideas.js";

test("sub-tabs hold their groups", () => {
  assert.equal(tabOf("Stays").label, "Hotels");
  assert.equal(tabOf("Shopping").key, "Other");
  assert.equal(tabOf("whatever").key, "Other");
  assert.equal(IDEA_TABS.length, 5);
});

test("each kind works out its cost", () => {
  assert.equal(nightsBetween("2026-12-01", "2026-12-04"), 3);
  assert.equal(nightsBetween("2026-12-04", "2026-12-01"), 0);
  assert.equal(nightsBetween("", "2026-12-01"), 0);
  const hotel = { group: "Stays", info: { checkIn: "2026-12-01", checkOut: "2026-12-04", pricePerNight: 15000 } };
  assert.equal(ideaCost(hotel), 45000);
  assert.equal(ideaCost({ ...hotel, info: { ...hotel.info, total: 40000 } }), 40000);
  assert.equal(ideaCost({ group: "Activities", info: { pricePerPerson: 8600, people: 2 } }), 17200);
  assert.equal(ideaCost({ group: "Sights", info: { entryFee: 500, people: 3 } }), 1500);
  assert.equal(ideaCost({ group: "Food", info: { priceRange: "$$" } }), 0);
  assert.equal(ideaCost({ group: "Other", info: { cost: 12.5 } }), 12.5);
});

test("a hotel becomes check-in and check-out plans, with the cost on check-in", () => {
  const idea = { ...emptyIdea("Stays"), title: "Hotel Gracery Shinjuku", info: { checkIn: "2026-12-01", checkOut: "2026-12-04", pricePerNight: 15000, currency: "JPY", paid: true, confirmation: "ABC123" } };
  const [inn, out] = ideaToItems(idea, { checkIn: "2026-12-01", checkInTime: "15:00", checkOut: "2026-12-04", checkOutTime: "11:00" });
  assert.equal(inn.title, "Check in: Hotel Gracery Shinjuku");
  assert.equal(inn.date, "2026-12-01");
  assert.equal(inn.time, "15:00");
  assert.equal(inn.category, "Lodging");
  assert.equal(inn.estimatedCost, 45000);
  assert.equal(inn.paid, true);
  assert.equal(inn.currency, "JPY");
  assert.match(inn.notes, /3 nights · Confirmation: ABC123/);
  assert.equal(out.title, "Check out: Hotel Gracery Shinjuku");
  assert.equal(out.date, "2026-12-04");
  assert.equal(out.estimatedCost, 0);
  assert.equal(out.fromIdea, idea.id);
  const [act] = ideaToItems({ ...emptyIdea("Activities"), title: "teamLab", info: { pricePerPerson: 3800, people: 2 } }, { date: "2026-12-02", time: "10:00" });
  assert.equal(act.estimatedCost, 7600);
  assert.equal(act.paid, undefined);
  assert.match(ideaToItems({ ...emptyIdea("Food"), title: "Ichiran", info: { cuisine: "Ramen", priceRange: "$", diets: ["Halal"] } }, {})[0].notes, /Ramen · \$ · Halal/);
});
