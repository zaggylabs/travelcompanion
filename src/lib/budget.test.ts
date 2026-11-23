import { describe, expect, it } from "vitest";
import { summarizeBudget } from "./budget";
import { daysBetween, parseLooseDate } from "./dates";
import { parseMoney } from "./money";
import type { ItineraryItem, Trip } from "./types";

const item = (over: Partial<ItineraryItem>): ItineraryItem => ({
  id: Math.random().toString(),
  date: "2026-06-01",
  time: "",
  title: "x",
  location: "",
  category: "Other",
  estimatedCost: 0,
  actualCost: null,
  notes: "",
  link: "",
  ...over,
});

const trip: Trip = {
  id: "t",
  name: "Paris",
  destination: "Paris",
  startDate: "2026-06-01",
  endDate: "2026-06-03",
  currency: "EUR",
  travelers: 2,
  budget: { Food: 100, Lodging: 300 },
  items: [
    item({ category: "Food", estimatedCost: 40, actualCost: 55.1 }),
    item({ category: "Food", estimatedCost: 30, date: "2026-06-02" }),
    item({ category: "Lodging", estimatedCost: 320.2, actualCost: 320.2, date: "" }),
  ],
  createdAt: "",
  updatedAt: "",
};

describe("summarizeBudget", () => {
  const s = summarizeBudget(trip, 3);
  it("totals by category using actual cost when paid, estimate otherwise", () => {
    const food = s.categories.find((c) => c.category === "Food")!;
    expect(food).toMatchObject({ budget: 100, planned: 70, spent: 55.1, projected: 85.1 });
    expect(s.categories.find((c) => c.category === "Flights")!.budget).toBeNull();
  });
  it("computes totals, remaining, per person and per day", () => {
    expect(s.totalBudget).toBe(400);
    expect(s.totalProjected).toBe(405.3);
    expect(s.remaining).toBe(-5.3);
    expect(s.projectedPerPerson).toBe(202.65);
    expect(s.projectedPerDay).toBe(135.1);
    expect(s.byDay).toEqual({ "2026-06-01": 55.1, "2026-06-02": 30, "": 320.2 });
  });
});

describe("dates", () => {
  it("lists days inclusive, across month ends", () => {
    expect(daysBetween("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
    expect(daysBetween("2026-02-02", "2026-01-30")).toEqual([]);
    expect(daysBetween("", "2026-01-30")).toEqual([]);
  });
  it("parses spreadsheet dates", () => {
    expect(parseLooseDate("2026-06-01")).toBe("2026-06-01");
    expect(parseLooseDate("6/1/26")).toBe("2026-06-01");
    expect(parseLooseDate("25/12/2026")).toBe("2026-12-25");
    expect(parseLooseDate("13/13/2026")).toBe("");
    expect(parseLooseDate("")).toBe("");
  });
});

describe("parseMoney", () => {
  it.each([
    ["$1,234.50", 1234.5],
    ["1.234,50 €", 1234.5],
    ["12,5", 12.5],
    ["1,234", 1234],
    ["(20)", -20],
    ["", null],
    ["n/a", null],
  ])("%s -> %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });
});
