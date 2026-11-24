import test from "node:test";
import assert from "node:assert/strict";
import { bookingOf, budgetEntries, plansUsing } from "../assets/js/lib/bookings.js";
import { summarizeBudget } from "../assets/js/lib/budget.js";

const trip = {
  currency: "JPY", budget: {}, travelers: 2,
  bookings: [
    { id: "b1", title: "Disneyland passes", category: "Activities", amount: 18000, paid: true },
    { id: "b2", title: "Hotel", category: "Lodging", amount: 60000, paid: false, date: "2026-12-01", currency: "SGD" },
  ],
  items: [
    { id: "p1", date: "2026-12-03", title: "Disneyland", category: "Activities", estimatedCost: 99999, bookingId: "b1" },
    { id: "p2", date: "2026-12-02", title: "Disneyland again", category: "Activities", estimatedCost: 5, bookingId: "b1" },
    { id: "p3", date: "2026-12-02", title: "Lunch", category: "Food", estimatedCost: 1500 },
    { id: "p4", date: "2026-12-02", title: "Old link", category: "Food", estimatedCost: 700, bookingId: "gone" },
  ],
};

test("a booking is counted once, on its first plan's day, and its plans' own costs are left out", () => {
  const entries = budgetEntries(trip);
  assert.deepEqual(entries.map((e) => e.id), ["p3", "p4", "b1", "b2"]);
  const b1 = entries.find((e) => e.id === "b1");
  assert.equal(b1.date, "2026-12-02");
  assert.equal(b1.paid, true);
  assert.equal(entries.find((e) => e.id === "b2").currency, "SGD");
  const s = summarizeBudget(trip, 3, (a, from, to) => (from === to ? a : from === "SGD" ? a * 100 : null));
  assert.equal(s.totalProjected, 1500 + 700 + 18000 + 6000000);
  assert.equal(s.totalSpent, 18000);
  assert.equal(s.byDay["2026-12-02"], 1500 + 700 + 18000);
});

test("plans and bookings find each other; trips without bookings are unchanged", () => {
  assert.equal(bookingOf(trip, trip.items[0]).title, "Disneyland passes");
  assert.equal(bookingOf(trip, trip.items[3]), null);
  assert.deepEqual(plansUsing(trip, trip.bookings[0]).map((p) => p.id), ["p1", "p2"]);
  const plain = { items: [{ id: "x" }] };
  assert.equal(budgetEntries(plain), plain.items);
});
