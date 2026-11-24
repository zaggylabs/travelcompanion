import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { airportCode, airportLabel, parseAirports, searchAirports } from "../assets/js/lib/airports.js";

const list = parseAirports(readFileSync(new URL("../assets/data/airports.txt", import.meta.url), "utf8"));

test("airport list loads", () => {
  assert.ok(list.length > 2000);
  assert.equal(airportLabel(list.find((a) => a.code === "SIN")), "Singapore Changi Airport (SIN)");
});

test("search by code, name and city", () => {
  assert.equal(searchAirports(list, "sin")[0].code, "SIN");
  assert.equal(searchAirports(list, "Changi")[0].code, "SIN");
  const tokyo = searchAirports(list, "tokyo", { countries: ["JP"] }).map((a) => a.code);
  assert.ok(tokyo.slice(0, 2).includes("HND") && tokyo.includes("NRT"), tokyo.join());
  assert.ok(searchAirports(list, "osaka", { countries: ["JP"] }).slice(0, 2).some((a) => a.code === "KIX"));
  assert.equal(searchAirports(list, "kuala lumpur")[0].code, "KUL");
});

test("codes are read back from labels or typed codes", () => {
  assert.equal(airportCode("Singapore Changi Airport (SIN)"), "SIN");
  assert.equal(airportCode("hnd"), "HND");
  assert.equal(airportCode("Changi"), "");
});
