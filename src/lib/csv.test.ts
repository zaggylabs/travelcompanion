import { describe, expect, it } from "vitest";
import { csvToItems, guessCategory, itemsToCsv, normalizeTime, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside fields", () => {
    const rows = parseCsv('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line1\nline2"],
    ]);
  });

  it("detects semicolon delimiters (European Excel exports) and strips the BOM", () => {
    expect(parseCsv("﻿Date;Activity;Cost\n2026-06-01;Louvre;17,50\n")).toEqual([
      ["Date", "Activity", "Cost"],
      ["2026-06-01", "Louvre", "17,50"],
    ]);
  });

  it("drops blank rows", () => {
    expect(parseCsv("a,b\n\n,\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("csvToItems", () => {
  it("maps a typical hand-made spreadsheet", () => {
    const csv = [
      "Day,Time,Activity,Place,Type,Cost,Paid,Notes",
      '6/1/2026,9:30 AM,Flight to Paris,CDG,Flight,"$1,200.00",1150,Window seat',
      "06/02/2026,7pm,Dinner,Le Comptoir,,85,,",
      ",,Museum pass,,,62,,",
      ",,,,,,,",
    ].join("\n");
    const { items, skipped } = csvToItems(csv);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      date: "2026-06-01",
      time: "09:30",
      title: "Flight to Paris",
      location: "CDG",
      category: "Flights",
      estimatedCost: 1200,
      actualCost: 1150,
      notes: "Window seat",
    });
    expect(items[1]).toMatchObject({ date: "2026-06-02", time: "19:00", category: "Food", actualCost: null });
    expect(items[2]).toMatchObject({ date: "", category: "Activities", estimatedCost: 62 });
  });

  it("round-trips its own export", () => {
    const { items } = csvToItems(
      "Date,Time,Title,Location,Category,Estimated cost,Actual cost,Notes,Link\n2026-06-03,10:00,\"Tour, guided\",Rome,Activities,40,38,\"Bring \"\"ID\"\"\",https://x.test\n",
    );
    const again = csvToItems(itemsToCsv(items)).items;
    const withoutIds = (list: typeof items) => list.map((i) => ({ ...i, id: "" }));
    expect(withoutIds(again)).toEqual(withoutIds(items));
  });

  it("counts rows with no title as skipped", () => {
    expect(csvToItems("Title,Cost\n,10\nHotel,100\n").skipped).toBe(1);
  });
});

describe("helpers", () => {
  it("normalizes times", () => {
    expect(normalizeTime("12am")).toBe("00:00");
    expect(normalizeTime("12:15 pm")).toBe("12:15");
    expect(normalizeTime("0930")).toBe("09:30");
    expect(normalizeTime("25:00")).toBe("");
    expect(normalizeTime("noonish")).toBe("");
  });

  it("guesses categories", () => {
    expect(guessCategory("Airbnb in Lisbon")).toBe("Lodging");
    expect(guessCategory("Train to Porto")).toBe("Transport");
    expect(guessCategory("lodging")).toBe("Lodging");
    expect(guessCategory("misc")).toBe("Other");
  });
});
