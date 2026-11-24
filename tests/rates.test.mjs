// Home currency guess and conversion. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

// A tiny localStorage so the cache can be tested in Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { convert, getRates, guessHomeCountry, parseRates, RATES_MAX_AGE, loadHome, saveHome } = await import("../assets/js/lib/rates.js");

test("guessHomeCountry uses the time zone, then the language region, then Singapore", () => {
  assert.equal(guessHomeCountry({ languages: ["en-US"], timeZone: "Asia/Singapore" }), "SG");
  assert.equal(guessHomeCountry({ languages: ["ms-MY", "en"], timeZone: "Etc/UTC" }), "MY");
  assert.equal(guessHomeCountry({ languages: ["zh-Hant-TW"], timeZone: "" }), "TW");
  assert.equal(guessHomeCountry({ languages: ["en"], timeZone: "" }), "SG");
});

test("home settings round-trip", () => {
  assert.equal(loadHome(), null);
  saveHome({ country: "SG", currency: "SGD" });
  assert.deepEqual(loadHome(), { country: "SG", currency: "SGD" });
});

const table = { base: "SGD", rates: { SGD: 1, JPY: 115, USD: 0.75 } };

test("convert goes through the base currency", () => {
  assert.equal(convert(1150, "JPY", "SGD", table), 10);
  assert.equal(convert(10, "SGD", "JPY", table), 1150);
  assert.ok(Math.abs(convert(75, "USD", "JPY", table) - 11500) < 1e-9);
  assert.equal(convert(5, "EUR", "EUR", null), 5);
  assert.equal(convert(5, "XYZ", "SGD", table), null);
  assert.equal(convert(5, "JPY", "SGD", null), null);
});

test("parseRates reads both rate APIs", () => {
  assert.deepEqual(parseRates({ result: "success", base_code: "SGD", time_last_update_unix: 1, rates: { JPY: 115 } }),
    { base: "SGD", rates: { JPY: 115 }, updated: 1000, source: "er-api" });
  const f = parseRates({ base: "SGD", date: "2026-11-23", rates: { JPY: 115 } });
  assert.equal(f.rates.SGD, 1);
  assert.equal(f.source, "frankfurter");
  assert.equal(parseRates({ result: "error" }), null);
});

test("getRates caches, falls back to the second source, and serves stale rates offline", async () => {
  let calls = [];
  const ok = (body) => ({ ok: true, json: async () => body });
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("er-api")) throw new TypeError("offline");
    return ok({ base: "MYR", date: "2026-11-23", rates: { JPY: 35 } });
  };
  const t0 = 1_000_000;
  const first = await getRates("MYR", { fetchImpl, now: t0 });
  assert.equal(first.rates.JPY, 35);
  assert.equal(calls.length, 2);

  calls = [];
  await getRates("MYR", { fetchImpl, now: t0 + 1000 });
  assert.equal(calls.length, 0, "fresh cache is used without fetching");

  const offline = await getRates("MYR", { fetchImpl: async () => { throw new TypeError("offline"); }, now: t0 + RATES_MAX_AGE + 1 });
  assert.equal(offline.stale, true);
  assert.equal(offline.rates.JPY, 35);

  assert.equal(await getRates("EUR", { fetchImpl: async () => { throw new TypeError("offline"); } }), null);
});
