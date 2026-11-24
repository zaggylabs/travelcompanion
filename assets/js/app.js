import { CATEGORIES, newId } from "./lib/constants.js";
import { prettyHours } from "./lib/placeinfo.js";
import { ALL_CURRENCIES, currencyForCountry, findCountry, flag, getCountry, searchCountries } from "./lib/countries.js";
import { locatePlace, mapsLink, searchPlaces } from "./lib/places.js";
import { baseLabel, basePoint, cityCountry, dayBase, dayCountry, destinationText, popularAreas, popularCities, sameName, tripCities, tripCountries } from "./lib/regions.js";
import { crowdTip, dayNote, getHolidays, getPlaceInfo } from "./lib/placeinfo.js";
import { GUIDES_CHECKED, SCHENGEN_NOTE, getGuide, homeAdviceLink, isSchengen, visaFor, visaOverviewLink, wikivoyageUrl } from "./lib/guides.js";
import { getWikivoyage } from "./lib/wikivoyage.js";
import { emergencyRows, getFacts, plugAdvice } from "./lib/countryfacts.js";
import { DIETS, DISCOVER_TYPES, RADII, cachedPlaces, detailedPlaces, discoverType, quickPlaces, formatDistance, getDiet, hasDiets, sortResults } from "./lib/discover.js";
import { autocomplete } from "./autocomplete.js";
import { daysBetween, formatDay } from "./lib/dates.js";
import { formatMoney } from "./lib/money.js";
import { browserGuess, convert, getRates, savedHome, saveHome } from "./lib/rates.js";
import { expectedCost, isPaid, itemCurrency, setPaid, summarizeBudget } from "./lib/budget.js";
import { BOOKING_SITES, PAID_BY, bookingOf, bookingsOf, budgetEntries, emptyBooking, plansUsing } from "./lib/bookings.js";
import { csvToItems, itemsToCsv } from "./lib/csv.js";
import { parseBookingLink } from "./lib/booking.js";
import { airportCode, airportLabel, loadAirports, searchAirports } from "./lib/airports.js";
import { TRAVEL_MODES, airportRoute, routeText, travelMode, travelTimes, travelTitle } from "./lib/travel.js";
import { IDEA_TABS, PRICE_RANGES, emptyIdea, groupForPlace, groupIdeas, groupOf, ideaCost, ideaToItem, ideaToItems, nightsBetween, tabOf } from "./lib/ideas.js";
import { deleteTrip, loadTrips, saveTrip, STORAGE_KEY } from "./lib/store.js";
import {
  ACCEPT, MAX_FILE_BYTES, deleteFile, deleteItemFiles, deleteTripFiles, formatSize, getFile, isAllowedType, putFile, requestPersistence,
} from "./lib/files.js";

/* ---------- tiny DOM helper ---------- */

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------- state ---------- */

const ui = {
  tab: "itinerary",
  creatingTrip: null, // boolean | null (null = decide from trip count)
  editingTrip: false,
  confirmDelete: false,
  editingItem: null, // { mode: "new", date } | { mode: "edit", id }
  notice: null,
  attachOpen: null, // item id whose attachments panel is open
  attachBusy: false,
  attachError: null,
  confirmRemoveFile: null, // attachment id awaiting "Remove?" confirmation
  selectedItem: null, // plan whose place info shows in the info panel
  summaryMore: false, // budget breakdown opened in the right column
  homeOpen: false, // home currency settings card
  selectedIdea: null, // saved place whose info shows in the info panel
  editingIdea: null, // saved place id being edited
  schedulingIdea: null, // saved place id whose "Add to itinerary" picker is open
  discover: null, // the Discover tab's search and results (see discoverState)
  editingBase: null, // date whose "where are you this day" picker is open
};

/* ---------- home currency ---------- */

// Until the user picks, assume the browser's country; the first-run card asks them to confirm.
let home = savedHome() ?? browserGuess();
let rates = null; // { base: home.currency, rates, updated, source, stale? }
let ratesStatus = "loading"; // loading | ok | stale | failed

function loadRates() {
  const base = home.currency;
  ratesStatus = "loading";
  getRates(base).then((table) => {
    if (base !== home.currency) return; // home changed meanwhile
    rates = table;
    ratesStatus = !table ? "failed" : table.stale ? "stale" : "ok";
    refreshAfterRates();
  });
}

/** Someone is typing or has a form open, so rebuilding the page now would wipe what they've entered. */
function formBusy() {
  const typing = root.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  const draftIdea = Boolean(ui.addingIdea || root.querySelector(".idea-new input[name=title]")?.value);
  const newTrip = Boolean(root.querySelector("form.trip-form"));
  return typing || newTrip || draftIdea || Boolean(ui.editingItem || ui.editingTrip || ui.editingIdea || ui.schedulingIdea || ui.editingBase || ui.editingBooking);
}

// Don't rebuild the page under someone who's typing; the summary can still update in place.
function refreshAfterRates() {
  if (!formBusy()) return render();
  const trip = loadTrips().find((t) => t.id === currentTripId());
  if (trip && activeSummary?.box.isConnected) activeSummary.update(trip);
}

/** Amount in the home currency, or null when it's the same currency or there's no rate. */
function toHome(amount, currency) {
  if (!currency || currency === home.currency) return null;
  return convert(amount, currency, home.currency, rates);
}
const homeText = (amount, currency) => {
  const v = toHome(amount, currency);
  return v === null ? "" : `≈ ${formatMoney(v, home.currency)}`;
};
/** A small "≈ S$12.30" line under a trip-currency amount. */
const alt = (amount, currency, cls = "") => {
  const t = amount > 0 ? homeText(amount, currency) : "";
  return t ? h("span", { class: `alt num ${cls}` }, t) : null;
};

/** Amount from one currency into another with today's rates (null when there's no rate). */
const convertAmount = (amount, from, to) => (from === to ? amount : convert(amount, from, to, rates));
/** Budget totals in the trip's currency, with plans in other currencies converted. */
const summarize = (trip, dayCount) => summarizeBudget(trip, dayCount, convertAmount);

const isMulti = (trip) => tripCountries(trip).length > 1;
/**
 * The currency a new plan starts in: on a multi-country trip, the currency of the
 * country it's in (the day's, or the picked place's); otherwise the trip's currency.
 */
function planCurrency(trip, cc) {
  if (!isMulti(trip) || !cc) return trip.currency;
  return currencyForCountry(cc) ?? trip.currency;
}
/** Plans only store a currency when it differs from the trip's. */
const withCurrency = (item, currency, trip) => {
  const { currency: _old, ...rest } = item;
  return currency && currency !== trip.currency ? { ...rest, currency } : rest;
};
/** The country a plan (or saved place, or Discover result) is in. */
const itemCountry = (item, trip, days) => item?.place?.cc || item?.cc || dayCountry(trip, item?.date, days) || tripCountries(trip)[0] || "";

function setHome(next) {
  const changed = next.currency !== home.currency;
  home = next;
  saveHome(next);
  if (changed) { rates = null; loadRates(); }
  updateHomeButton();
}

const homeBtn = document.getElementById("home-btn");
function updateHomeButton() {
  if (!homeBtn) return;
  homeBtn.hidden = false;
  homeBtn.textContent = `Home: ${home.currency}`;
  homeBtn.title = "Change your home currency";
}
homeBtn?.addEventListener("click", () => { ui.homeOpen = true; render(); window.scrollTo({ top: 0 }); });

// Wide screens get three columns (place info | itinerary | budget); narrower ones show the info under the selected plan.
// Resizing (or turning a phone) mid-form waits until the form is done, so nothing typed is lost.
const WIDE = window.matchMedia("(min-width: 960px)");
let layoutPending = false;
WIDE.addEventListener("change", () => { if (formBusy()) layoutPending = true; else render(); });
document.addEventListener("focusout", () => setTimeout(() => { if (layoutPending && !formBusy()) render(); }, 0));

function currentTripId() {
  const m = location.hash.match(/^#trip\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function openTrip(id) {
  Object.assign(ui, { tab: "itinerary", editingBase: null, selectedItem: null, editingTrip: false, confirmDelete: false, editingItem: null, notice: null, attachOpen: null, attachError: null, confirmRemoveFile: null, selectedIdea: null, editingIdea: null, schedulingIdea: null, discover: null, guideCountry: null });
  location.hash = id ? `trip/${encodeURIComponent(id)}` : "";
  if (!id) history.replaceState(null, "", location.pathname + location.search);
  render();
}

function emptyTrip() {
  const now = new Date().toISOString();
  return {
    id: newId(), name: "", country: "", destination: "", cities: [], dayBases: {}, startDate: "", endDate: "",
    currency: "SGD", travelers: 1, budget: {}, items: [], createdAt: now, updatedAt: now,
  };
}

function emptyItem(date, travel = false) {
  return {
    id: newId(), date: date || "", time: "", title: "", location: "", category: "Activities",
    estimatedCost: 0, actualCost: null, notes: "", link: "",
    ...(travel ? { category: "Flights", travel: { mode: "flight", from: "", to: "", number: "", arrive: "", nextDay: false } } : {}),
  };
}

function byTime(a, b) {
  if (!a.time && b.time) return 1;
  if (a.time && !b.time) return -1;
  return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
}
const sortItems = (items) => [...items].sort(byTime);

/* ---------- rendering ---------- */

const root = document.getElementById("app");

function render() {
  layoutPending = false;
  revokeFileUrls();
  const trips = loadTrips();
  const id = currentTripId();
  const trip = trips.find((t) => t.id === id);
  document.body.classList.toggle("trip-page", Boolean(trip));
  const firstRun = !savedHome();
  const showHome = ui.homeOpen || (firstRun && !trip);
  root.replaceChildren(...[showHome && homeCard(firstRun), trip ? tripView(trip) : tripList(trips, showHome)].filter(Boolean));
  root.querySelector("[autofocus]")?.focus();
}

window.addEventListener("hashchange", render);
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) render();
  if (e.key?.startsWith("travelcompanion:home")) { const saved = savedHome(); if (saved) { setHome(saved); render(); } }
});

/* ----- home currency card ----- */

function homeCard(firstRun) {
  let country = getCountry(home.country);
  const currencies = ALL_CURRENCIES.includes(home.currency) ? ALL_CURRENCIES : [home.currency, ...ALL_CURRENCIES];
  const currencySelect = h("select", { name: "homeCurrency" }, currencies.map((c) => h("option", { selected: c === home.currency }, c)));
  const countryInput = h("input", { name: "homeCountry", placeholder: "Start typing, e.g. Singapore", value: country?.name ?? "", autofocus: !firstRun });
  const countryFlag = h("span", { class: "country-flag", "aria-hidden": "true" }, countryIcon(country?.code));
  const setCountry = (c, picked) => {
    country = c;
    countryFlag.textContent = countryIcon(c?.code);
    if (!c) return;
    if (picked) countryInput.value = c.name;
    if (![...currencySelect.options].some((o) => o.value === c.currency)) currencySelect.prepend(h("option", null, c.currency));
    currencySelect.value = c.currency;
  };
  const countryBox = autocomplete(countryInput, {
    search: (q) => searchCountries(q),
    renderItem: (c) => [FLAGS_OK && h("span", { class: "ac-icon", "aria-hidden": "true" }, flag(c.code)), h("span", { class: "ac-main" }, h("span", { class: "ac-title" }, c.name)), h("span", { class: "ac-tag num" }, c.currency)].filter(Boolean),
    onPick: (c) => setCountry(c, true),
    emptyText: () => "No country matches that.",
  });
  countryInput.addEventListener("input", () => setCountry(findCountry(countryInput.value), false));

  const form = h("form", { class: "form-grid two" },
    field("I'm from", h("div", { class: "with-flag" }, countryFlag, countryBox.el)),
    field("Home currency", currencySelect),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, firstRun ? "Continue" : "Save"),
      !firstRun && h("button", { class: "btn", type: "button", onclick: () => { ui.homeOpen = false; render(); } }, "Cancel")));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const c = country ?? findCountry(countryInput.value);
    setHome({ country: c?.code ?? "", currency: currencySelect.value });
    ui.homeOpen = false;
    render();
  });
  return h("section", { class: "card pad home-card" },
    h("h2", null, firstRun ? "Welcome! Where are you from?" : "Your home currency"),
    h("p", { class: "muted" }, "Enter trip costs in the local currency and we'll also show what they come to in your home currency, at today's exchange rate. You can change this any time with the Home button at the top."),
    form);
}

/* ----- trip list ----- */

function tripCard(t) {
  const days = daysBetween(t.startDate, t.endDate).length;
  const s = summarize(t, days);
  return h("li", null, h("button", { class: "trip-card", type: "button", onclick: () => openTrip(t.id) },
    h("strong", null, t.name),
    h("span", { class: "muted" }, placeLine(t) || "No destination yet"),
    h("span", { class: "small muted" }, t.startDate && t.endDate
      ? `${formatDay(t.startDate)} to ${formatDay(t.endDate)} · ${plural(days, "day")}`
      : "Dates not set"),
    h("span", { class: "small muted" },
      `${plural(t.items.length, "plan")} · ${formatMoney(s.totalProjected, t.currency)}`,
      s.totalBudget > 0 ? ` of ${formatMoney(s.totalBudget, t.currency)}` : "",
      s.totalProjected > 0 && homeText(s.totalProjected, t.currency) ? ` (${homeText(s.totalProjected, t.currency)})` : "")));
}

// Home page, top to bottom: an invitation to plan, the new-trip card, then your saved trips.
function tripList(trips, homeShowing) {
  const creating = !homeShowing && (ui.creatingTrip ?? trips.length === 0);
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (t) => Boolean(t.endDate) && t.endDate < today;
  const upcoming = trips.filter((t) => !isPast(t)).sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
  const past = trips.filter(isPast).sort((a, b) => b.endDate.localeCompare(a.endDate));
  const start = () => { ui.creatingTrip = true; render(); };

  return h("div", { class: "stack home" },
    h("header", { class: "hero" },
      h("h1", null, trips.length ? "Where to next?" : "Let's plan your next getaway"),
      h("p", { class: "muted" }, "Pick a country, your cities and dates, and we'll help you map out every day and keep an eye on what it costs. No spreadsheet needed, just a cup of coffee.")),
    h("section", { class: `card new-trip${creating ? " pad open" : ""}`, "aria-label": "New trip" }, creating
      ? [h("h2", null, "Plan a new trip"),
         tripForm(emptyTrip(), "Create trip", (t) => {
           saveTrip(t);
           ui.creatingTrip = false;
           openTrip(t.id);
         }, trips.length ? () => { ui.creatingTrip = false; render(); } : null)]
      : h("button", { class: "new-trip-btn", type: "button", onclick: start },
          h("span", { class: "new-trip-plus", "aria-hidden": "true" }, "+"),
          h("span", null, h("strong", null, "Start a new adventure"), h("span", { class: "small muted" }, "Country, cities and dates, one easy step at a time")))),
    upcoming.length > 0 && h("section", { class: "stack-sm" },
      h("h2", null, past.length ? "Upcoming trips" : "Your trips"),
      h("ul", { class: "trip-grid" }, upcoming.map(tripCard))),
    past.length > 0 && h("section", { class: "stack-sm" },
      h("h2", null, "Past trips"),
      h("ul", { class: "trip-grid past" }, past.map(tripCard))));
}

// Windows has no flag emoji (it shows the letters "JP"), so only use flags where they draw in colour.
const FLAGS_OK = (() => {
  try {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    ctx.canvas.width = ctx.canvas.height = 20;
    ctx.font = "16px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("\u{1F1EF}\u{1F1F5}", 0, 0); // Japan: should have red in it
    const px = ctx.getImageData(0, 0, 20, 20).data;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 150 && px[i + 1] < 100 && px[i + 2] < 100) return true;
  } catch { /* no canvas */ }
  return false;
})();
const countryIcon = (code) => (FLAGS_OK && code ? flag(code) : "🌏");

// "🇯🇵 Japan · Tokyo & Osaka", "🇪🇸 Spain & 🇫🇷 France · Barcelona, Madrid & Paris"
function placeLine(trip) {
  const names = tripCountries(trip).map(getCountry).filter(Boolean).map((c) => (FLAGS_OK ? `${flag(c.code)} ${c.name}` : c.name));
  return [destinationText(names), trip.destination].filter(Boolean).join(" · ");
}

/** A warm, centred empty state card: big emoji, a short title, one line of help. */
function emptyState(icon, title, text) {
  return h("div", { class: "card empty-state" },
    h("span", { class: "empty-icon", "aria-hidden": "true" }, icon), h("strong", null, title), text && h("p", { class: "small" }, text));
}

function field(label, control, cls) {
  return h("label", { class: `field ${cls || ""}` }, h("span", null, label), control);
}

// Optional fields start folded behind small "+ Link" chips; one that already has something starts open.
function foldable(parts) {
  const chips = h("div", { class: "add-chips span-all" });
  const draw = () => {
    chips.replaceChildren(...parts.filter((p) => p.els[0].hidden).map((p) => h("button", { class: "chip small plain", type: "button", "data-part": p.label,
      onclick: () => { for (const el of p.els) el.hidden = false; draw(); p.els[0].querySelector("input:not([type=file]), textarea, select, button")?.focus(); } }, `+ ${p.label}`)));
    chips.hidden = !chips.childElementCount;
  };
  // ✕ on an open part empties it (unticks, unlinks, drops files) and folds it back into its chip.
  const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const clear = (p) => {
    for (const el of p.els) {
      for (const c of el.querySelectorAll("input:not([type=file]), textarea, select")) {
        if (c.type === "checkbox") { if (c.checked) { c.checked = false; fire(c); } }
        else if (c.tagName === "SELECT") { if ([...c.options].some((o) => o.value === "") && c.value) { c.value = ""; fire(c); } }
        else if (c.value) { c.value = ""; fire(c); }
      }
      el.clearFiles?.();
      el.hidden = true;
    }
    draw();
  };
  // A part is one element (el) or several shown together (els).
  for (const p of parts) {
    p.els = (p.els ?? [p.el]).filter(Boolean);
    for (const el of p.els) el.hidden = !p.open;
    const x = h("button", { class: "fold-x", type: "button", title: `Remove ${p.label.toLowerCase()}`, "aria-label": `Remove ${p.label.toLowerCase()}`,
      onclick: (e) => { e.preventDefault(); clear(p); } }, "✕ Remove");
    const head = p.els[0];
    head.classList.add("foldable");
    if (head.setFoldX) head.setFoldX(x); else head.append(x);
  }
  draw();
  return [...parts.flatMap((p) => p.els), chips];
}

const settlementRow = (p) => [
  h("span", { class: "ac-icon", "aria-hidden": "true" }, "📍"),
  h("span", { class: "ac-main" }, h("span", { class: "ac-title" }, p.name), h("span", { class: "ac-sub small muted" }, p.area)),
  p.kind && h("span", { class: "ac-tag" }, p.kind),
].filter(Boolean);
const osmFooter = () => h("span", { class: "small muted" }, "Places from © OpenStreetMap contributors");

function tripForm(initial, submitLabel, onSubmit, onCancel) {
  const error = h("p", { class: "error", hidden: true }, "The end date is before the start date.");

  // Countries: pick one (or several, in the order you'll visit) and the currency follows.
  // Older trips without a country get a guess from the destination.
  const guessed = initial.country === undefined ? findCountry(initial.destination) : null;
  const countries = (tripCountries(initial).length ? tripCountries(initial) : guessed ? [guessed.code] : []).map(getCountry).filter(Boolean);
  const startCurrency = initial.currency || home.currency;
  const currencies = ALL_CURRENCIES.includes(startCurrency) ? ALL_CURRENCIES : [startCurrency, ...ALL_CURRENCIES];
  const currencySelect = h("select", { name: "currency" }, currencies.map((c) => h("option", { selected: c === startCurrency }, c)));
  const currencyLabel = h("span", null, "Currency");
  const currencyHint = h("span", { class: "hint-inline" });
  const totalsNote = h("p", { class: "small muted form-note span-all" });
  let currencyTouched = false;
  const countryInput = h("input", { name: "countryName", placeholder: "Start typing, e.g. Japan", autofocus: true });
  const countryLabel = h("span", null, "Country");
  const countryTags = h("div", { class: "city-tags country-tags" });
  const nameInput = h("input", { name: "name", value: initial.name });
  const countryFlag = h("span", { class: "country-flag", "aria-hidden": "true" }, countryIcon(null));

  const setCurrency = (code, why) => {
    if (!code) return;
    if (![...currencySelect.options].some((o) => o.value === code)) currencySelect.prepend(h("option", null, code));
    const changed = currencySelect.value !== code;
    currencySelect.value = code;
    currencyHint.textContent = changed ? why : "";
  };
  // The trip's currency is what totals and budget limits are in: the country's own for a
  // one-country trip, your home currency when the trip crosses borders.
  const pickCurrency = () => {
    const multi = countries.length > 1;
    if (!currencyTouched) {
      if (multi) setCurrency(home.currency, `Totals set to ${home.currency}, your home currency, to add up costs from ${destinationText(countries.map((c) => c.name))}`);
      else if (countries[0]) setCurrency(countries[0].currency, `Set to ${countries[0].currency} for ${countries[0].name}`);
    }
    currencyLabel.textContent = multi ? "Totals in" : "Currency";
    const local = [...new Set(countries.map((c) => c.currency))];
    totalsNote.textContent = multi
      ? `Each plan's cost is entered in the money of the country it's in (${local.join(", ")}). Totals and budget limits add them up in ${currencySelect.value}.`
      : "";
    totalsNote.hidden = !multi;
  };

  const drawCountries = () => {
    countryFlag.textContent = countryIcon(null);
    countryLabel.textContent = countries.length ? "Add another country (optional)" : "Country";
    countryInput.placeholder = countries.length ? "Going on somewhere else? e.g. France" : "Start typing, e.g. Japan";
    countryTags.replaceChildren(...countries.map((c, i) =>
      h("span", { class: "city-tag" }, countries.length > 1 && h("span", { class: "num muted" }, `${i + 1}`), FLAGS_OK ? `${flag(c.code)} ` : "", c.name,
        h("button", { type: "button", "aria-label": `Remove ${c.name}`, onclick: () => removeCountry(c) }, "✕"))));
    countryTags.hidden = countries.length === 0;
    const first = countries[0];
    nameInput.placeholder = countries.length > 1 ? `${destinationText(countries.map((c) => c.name))} trip` : first ? `${first.name} trip` : "e.g. Japan with the family";
  };
  const addCountry = (c) => {
    if (!c || countries.some((x) => x.code === c.code)) return;
    countries.push(c);
    countryInput.value = "";
    drawCountries();
    pickCurrency();
    drawCities();
  };
  const removeCountry = (c) => {
    countries.splice(countries.indexOf(c), 1);
    for (let i = cities.length - 1; i >= 0; i--) if (cities[i].country === c.code) cities.splice(i, 1);
    drawCountries();
    pickCurrency();
    drawCities();
  };
  const countryBox = autocomplete(countryInput, {
    search: (q) => searchCountries(q).filter((c) => !countries.some((x) => x.code === c.code)),
    renderItem: (c) => [FLAGS_OK && h("span", { class: "ac-icon", "aria-hidden": "true" }, flag(c.code)), h("span", { class: "ac-main" }, h("span", { class: "ac-title" }, c.name)), h("span", { class: "ac-tag num" }, c.currency)].filter(Boolean),
    onPick: (c) => { addCountry(c); cityInputs.get(c.code)?.input.focus(); },
    emptyText: () => "No country matches that.",
  });
  countryInput.addEventListener("input", () => { countryFlag.textContent = countryIcon(findCountry(countryInput.value)?.code); });
  // Enter adds a country typed out in full.
  countryInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.defaultPrevented) return;
    e.preventDefault();
    const c = findCountry(countryInput.value);
    if (c) addCountry(c);
  });
  currencySelect.addEventListener("change", () => { currencyTouched = true; currencyHint.textContent = ""; pickCurrency(); });

  // Cities: tap a popular one, or search for any city or town, in each country.
  const cities = tripCities(initial).map((c) => ({ ...c, country: c.country || countries[0]?.code || "" }));
  const cityBox = h("div", { class: "city-picker" });
  const cityInputs = new Map(); // country code -> { input, el }, kept across redraws so typing isn't lost
  const addCity = (c, code) => {
    if (!c.name || cities.some((x) => sameName(x.name, c.name) && (x.country || "") === (code || ""))) return;
    const city = { name: c.name, ...(code ? { country: code } : {}), ...(Number.isFinite(c.lat) ? { lat: c.lat, lon: c.lon } : {}) };
    cities.push(city);
    if (!Number.isFinite(city.lat)) locatePlace(city.name, code, { only: "settlement" }).then((pt) => { if (pt) Object.assign(city, pt); });
    drawCities();
  };
  const cityInputFor = (c) => {
    const code = c?.code ?? "";
    if (cityInputs.has(code)) return cityInputs.get(code);
    const input = h("input", { name: "cityQuery", "data-country": code, placeholder: countries.length > 1 && c ? `Add a city or town in ${c.name}` : "Add a city or town" });
    const ac = autocomplete(input, {
      delay: 300,
      search: (q, signal) => searchPlaces(q, code, signal, { only: "settlement", minChars: 2 }),
      renderItem: settlementRow,
      footer: osmFooter,
      onPick: (p) => { input.value = ""; addCity(p, code); cityInputs.get(code)?.input.focus(); },
    });
    // Enter adds what's typed, even if it isn't in the suggestions.
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      e.preventDefault();
      const name = input.value.trim();
      if (name) { input.value = ""; addCity({ name }, code); cityInputs.get(code)?.input.focus(); }
    });
    const entry = { input, el: ac.el };
    cityInputs.set(code, entry);
    return entry;
  };
  const cityTag = (c) => {
    const i = cities.indexOf(c);
    return h("span", { class: "city-tag" }, h("span", { class: "num muted" }, `${i + 1}`), c.name,
      h("button", { type: "button", "aria-label": `Remove ${c.name}`, onclick: () => { cities.splice(cities.indexOf(c), 1); drawCities(); } }, "✕"));
  };
  function drawCities() {
    const multi = countries.length > 1;
    const groups = countries.length ? countries : [null];
    for (const c of cities) if (!countries.some((x) => x.code === c.country) && countries[0]) c.country = countries[0].code;
    for (const code of [...cityInputs.keys()]) if (!groups.some((g) => (g?.code ?? "") === code)) cityInputs.delete(code);
    cityBox.replaceChildren(...groups.map((country) => {
      const own = cities.filter((c) => !country || c.country === country.code);
      const popular = popularCities(country?.code).filter((n) => !own.some((c) => sameName(c.name, n)));
      return h("div", { class: `city-group${multi ? " multi" : ""}` },
        multi && h("p", { class: "city-group-head" }, FLAGS_OK ? `${flag(country.code)} ` : "", h("strong", null, country.name)),
        own.length > 0 && h("div", { class: "city-tags" }, own.map(cityTag)),
        (() => {
          const entry = cityInputFor(country);
          entry.input.placeholder = multi ? `Add a city or town in ${country.name}` : "Add a city or town";
          return entry.el;
        })(),
        popular.length > 0 && h("div", { class: "city-suggest" },
          h("span", { class: "small muted" }, `Popular in ${country.name}:`),
          popular.slice(0, multi ? 8 : 12).map((n) => h("button", { class: "chip small", type: "button", onclick: () => addCity({ name: n }, country.code) }, "+ ", n))));
    }),
    ...[
      !countries.length && h("p", { class: "small muted" }, "Pick the country first and we'll suggest its cities."),
      cities.length > 1 && h("p", { class: "small muted" }, multi
        ? "The numbers are the order you'll visit them. On the itinerary you pick which city each day is in, and that sets the day's country."
        : "In the order you'll visit them. You'll pick which city (and area) each day is in on the itinerary."),
    ].filter(Boolean));
  }
  drawCountries();
  drawCities();
  // A currency chosen on purpose (not the one we'd pick) is left alone when countries change.
  const autoCurrency = countries.length > 1 ? home.currency : countries[0]?.currency;
  currencyTouched = Boolean(autoCurrency) && startCurrency !== autoCurrency;
  pickCurrency();
  currencyHint.textContent = "";

  const step = (n, title, ...body) => h("fieldset", { class: "step span-all" }, h("legend", null, h("span", { class: "step-n" }, n), title), ...body);
  const form = h("form", { class: "form-grid two trip-form" },
    step(1, "Where are you going?",
      countryTags,
      h("label", { class: "field" }, countryLabel, h("div", { class: "with-flag" }, countryFlag, countryBox.el)),
      h("p", { class: "small muted form-note" }, currencyHint)),
    step(2, "Which cities?", cityBox),
    step(3, "When?", h("div", { class: "form-grid two" },
      field("Start date", h("input", { name: "startDate", type: "date", value: initial.startDate })),
      field("End date", h("input", { name: "endDate", type: "date", value: initial.endDate })))),
    step(4, "The details", h("div", { class: "form-grid two" },
      field("Trip name", nameInput),
      h("div", { class: "form-grid two tight" },
        h("label", { class: "field" }, currencyLabel, currencySelect),
        field("Travelers", h("input", { name: "travelers", type: "number", min: 1, value: initial.travelers }))),
      totalsNote)),
    error,
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, submitLabel),
      onCancel && h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel")));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const startDate = String(f.get("startDate"));
    const endDate = String(f.get("endDate"));
    if (startDate && endDate && endDate < startDate) { error.hidden = false; return; }
    const typedCountry = findCountry(countryInput.value);
    if (typedCountry) addCountry(typedCountry);
    for (const [code, { input }] of cityInputs) {
      const typed = input.value.trim();
      if (typed && !cities.some((x) => sameName(x.name, typed))) cities.push({ name: typed, ...(code ? { country: code } : {}) });
    }
    const codes = countries.map((c) => c.code);
    const fallbackName = countries.length > 1 ? `${destinationText(countries.map((c) => c.name))} trip` : countries[0] ? `${countries[0].name} trip` : cities[0] ? `${cities[0].name} trip` : "My trip";
    onSubmit({
      ...initial,
      name: String(f.get("name")).trim() || fallbackName,
      country: codes[0] ?? "",
      countries: codes,
      cities,
      destination: destinationText(cities),
      currency: String(f.get("currency")),
      travelers: Math.max(1, Number(f.get("travelers")) || 1),
      startDate,
      endDate,
    });
  });
  return form;
}

/**
 * Saving an edited trip whose currency changed: plans priced before keep the currency
 * they were entered in, and budget limits are converted so they mean the same amount.
 */
function keepCurrencies(before, after) {
  if (!before.currency || before.currency === after.currency) return after;
  const items = after.items.map((i) => (i.currency ? withCurrency(i, i.currency, after) : withCurrency(i, before.currency, after)));
  const budget = {};
  for (const [cat, v] of Object.entries(after.budget ?? {})) {
    const n = convertAmount(v, before.currency, after.currency);
    budget[cat] = n === null ? v : Math.round(n);
  }
  return { ...after, items, budget };
}

/* ----- trip view ----- */

// Look up where the trip's cities and day areas are (once), so searches can favour places nearby.
const locating = new Set();
function updateTrip(tripId, fn) {
  const current = loadTrips().find((t) => t.id === tripId);
  if (current) saveTrip(fn(current));
}
function fillCoords(trip) {
  for (const city of tripCities(trip)) {
    const cc = city.country || tripCountries(trip)[0];
    const key = `${trip.id}|city|${city.name}`;
    if (Number.isFinite(city.lat) || locating.has(key)) continue;
    locating.add(key);
    locatePlace(city.name, cc, { only: "settlement" }).then((pt) => {
      if (!pt) return;
      updateTrip(trip.id, (t) => ({ ...t, cities: tripCities(t).map((c) => (sameName(c.name, city.name) ? { ...c, ...pt } : c)) }));
      const updated = loadTrips().find((t) => t.id === trip.id);
      if (updated) fillCoords(updated); // now its areas can be found too
    });
  }
  for (const [date, b] of Object.entries(trip.dayBases ?? {})) {
    if (!b?.area || Number.isFinite(b.lat)) continue;
    const key = `${trip.id}|area|${b.city}|${b.area}`;
    const near = basePoint(trip, { city: b.city });
    if (locating.has(key) || !near) continue; // wait for the city first
    locating.add(key);
    locateArea(b.area, cityCountry(trip, b.city), near).then((pt) => {
      if (pt) updateTrip(trip.id, (t) => {
        const cur = t.dayBases?.[date];
        return cur && cur.area === b.area ? { ...t, dayBases: { ...t.dayBases, [date]: { ...cur, ...pt } } } : t;
      });
    });
  }
}
async function locateArea(name, cc, near) {
  return (await locatePlace(name, cc, { near, only: "settlement" })) ?? locatePlace(name, cc, { near });
}

function tripView(trip) {
  const days = daysBetween(trip.startDate, trip.endDate);
  fillCoords(trip);
  const fileInput = h("input", { type: "file", accept: ".csv,text/csv", hidden: true, "aria-label": "CSV file to import" });
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    fileInput.value = "";
    if (f) importCsv(trip, await f.text());
  });

  const header = ui.editingTrip
    ? h("section", { class: "card pad" },
        h("h2", null, "Edit trip"),
        tripForm(trip, "Save", (t) => { saveTrip(keepCurrencies(trip, t)); ui.editingTrip = false; render(); },
          () => { ui.editingTrip = false; ui.confirmDelete = false; render(); }),
        h("div", { class: "danger-zone" }, ui.confirmDelete
          ? [h("span", null, "Delete this trip and all its plans? This can't be undone."),
             h("button", { class: "btn danger", type: "button", onclick: () => { deleteTrip(trip.id); deleteTripFiles(trip.id); openTrip(null); } }, "Yes, delete"),
             h("button", { class: "btn", type: "button", onclick: () => { ui.confirmDelete = false; render(); } }, "Keep it")]
          : h("button", { class: "btn danger", type: "button", onclick: () => { ui.confirmDelete = true; render(); } }, "Delete trip")))
    : h("div", { class: "page-head" },
        h("div", null,
          h("h1", null, trip.name),
          h("p", { class: "muted" }, [
            placeLine(trip),
            days.length ? `${formatDay(days[0])} to ${formatDay(days[days.length - 1])} · ${plural(days.length, "day")}` : "Dates not set",
            plural(trip.travelers, "traveler"),
          ].filter(Boolean).join(" · "))),
        h("div", { class: "actions" },
          guideButton(trip),
          h("button", { class: "btn", type: "button", onclick: () => { ui.editingTrip = true; render(); } }, "Edit trip"),
          h("button", { class: "btn", type: "button", title: "In Excel: File › Save As › CSV, then import that file", onclick: () => fileInput.click() }, "Import CSV"),
          h("button", { class: "btn", type: "button", disabled: trip.items.length === 0, title: "Opens in Excel or Google Sheets", onclick: () => exportCsv(trip) }, "Export CSV"),
          fileInput));

  return h("div", { class: "stack" },
    h("button", { class: "link-back", type: "button", onclick: () => openTrip(null) }, "← All trips"),
    header,
    ui.notice && h("div", { class: "notice", role: "status" },
      h("span", null, ui.notice),
      h("button", { type: "button", "aria-label": "Dismiss", onclick: () => { ui.notice = null; render(); } }, "✕")),
    h("div", { class: "trip-layout" },
      WIDE.matches && h("aside", { class: "trip-info", "aria-label": "About this place" },
        infoPanel(ui.tab === "ideas" ? ideaAsItem(selectedIdea(trip)) : ui.tab === "discover" ? (selectedPopularItem(trip) ?? discoverAsItem(selectedResult(trip), trip)) : selectedItem(trip, days), trip, days)),
      h("div", { class: "trip-main stack" },
        h("div", { class: "tabs", role: "tablist" }, Object.entries(TABS).map(([t, label]) =>
          h("button", { role: "tab", type: "button", "data-tab": t, "aria-selected": String(ui.tab === t), class: ui.tab === t ? "active" : "",
            onclick: () => { Object.assign(ui, { tab: t, editingItem: null, attachOpen: null, editingIdea: null, schedulingIdea: null, editingBooking: null }); render(); } },
            label, t === "ideas" && trip.ideas?.length ? h("span", { class: "tab-count num" }, trip.ideas.length)
              : t === "bookings" && trip.bookings?.length ? h("span", { class: "tab-count num" }, trip.bookings.length) : null))),
        ui.tab === "guide" ? guideView(trip) : ui.tab === "budget" ? budgetView(trip, days) : ui.tab === "ideas" ? ideasView(trip, days) : ui.tab === "bookings" ? bookingsView(trip, days)
          : ui.tab === "discover" ? discoverView(trip, days) : itineraryView(trip, days)),
      ui.tab === "discover"
        ? h("aside", { class: "trip-budget", "aria-label": "Popular places" }, popularPanel(trip, days))
        : h("aside", { class: "trip-budget", "aria-label": "Budget" }, budgetSummary(trip, days))));
}

// "Good to know" is about the destination, not one day of the trip, so it sits by the trip's name rather than in the tabs.
function guideButton(trip) {
  const ccs = tripCountries(trip);
  if (!ccs.length) return null;
  const open = ui.tab === "guide";
  const where = ccs.length === 1 ? [countryIcon(ccs[0]), " ", getCountry(ccs[0])?.name ?? ccs[0]] : ccs.map((c) => countryIcon(c)).join(" ");
  return h("button", { class: `btn guide-btn${open ? " active" : ""}`, type: "button", "aria-pressed": String(open),
    title: open ? "Back to the itinerary" : "Visas, money, plugs, etiquette and emergency numbers",
    onclick: () => { Object.assign(ui, { tab: open ? "itinerary" : "guide", editingItem: null, attachOpen: null, editingIdea: null, schedulingIdea: null, editingBooking: null }); render(); } },
    "💡 Good to know · ", where);
}

const TABS = { itinerary: "Itinerary", discover: "Discover", ideas: "Saved places", bookings: "Bookings", budget: "Budget" };

/* ----- "Good to know" tab: entry rules, etiquette, money, plugs, emergency numbers ----- */

const ext = (link, text) => h("a", { href: link.url, target: "_blank", rel: "noopener" }, text ?? link.label, " ↗");
const linkList = (links) => h("ul", { class: "guide-links" }, links.filter(Boolean).map((l) => h("li", null, ext(l))));
const guideSec = (title, ...body) => h("section", { class: "card guide-sec" }, h("h3", null, title), ...body);
const bullets = (items, cls) => h("ul", { class: `guide-list ${cls || ""}` }, items.map((t) => h("li", null, t)));

function guideView(trip) {
  const all = tripCountries(trip).map(getCountry).filter(Boolean);
  // A multi-country trip gets a tab per country, starting with where you are today (or the first).
  if (!all.some((c) => c.code === ui.guideCountry)) {
    const days = daysBetween(trip.startDate, trip.endDate);
    const today = new Date().toISOString().slice(0, 10);
    ui.guideCountry = days.includes(today) ? dayCountry(trip, today, days) : all[0]?.code ?? null;
  }
  const dest = all.find((c) => c.code === ui.guideCountry) ?? all[0];
  if (!dest) {
    return h("div", { class: "card pad guide-empty" },
      h("h2", null, "Good to know"),
      h("p", { class: "muted" }, "Set this trip's country to see entry rules, do's and don'ts, money tips, plugs and emergency numbers for it."),
      h("button", { class: "btn primary", type: "button", onclick: () => { ui.editingTrip = true; render(); window.scrollTo({ top: 0 }); } }, "Set the country"));
  }
  const homeC = getCountry(home.country);
  const guide = getGuide(dest.code);
  const going = homeC && homeC.code === dest.code;
  const entrySlot = !guide && !going ? h("div", { class: "guide-entry-wv" }) : null;

  const intro = h("div", { class: "guide-head" },
    h("h2", null, `Good to know: ${dest.name}`),
    h("p", { class: "small muted" },
      homeC ? `Tailored for a ${homeC.name} passport. ` : "",
      h("button", { class: "linkish", type: "button", onclick: () => { ui.homeOpen = true; render(); window.scrollTo({ top: 0 }); } }, homeC ? "Not your passport?" : "Set where you're from"),
      " Entry rules change, so always confirm on the official sites before you book or fly."));

  const picker = all.length > 1 && h("div", { class: "guide-countries", role: "tablist", "aria-label": "Country" }, all.map((c) =>
    h("button", { type: "button", role: "tab", class: `chip${c.code === dest.code ? " active" : ""}`, "aria-selected": String(c.code === dest.code),
      onclick: () => { ui.guideCountry = c.code; render(); } }, FLAGS_OK ? `${flag(c.code)} ` : "", c.name)));

  return h("div", { class: "guide stack" }, picker, intro,
    going
      ? guideSec("Entry", h("p", null, `This is your home country, so you won't need a visa. Make sure your passport is valid.`))
      : visaSection(guide, dest, homeC, entrySlot),
    guideSections(guide, dest, homeC, entrySlot));
}

function visaSection(guide, dest, homeC, entrySlot) {
  const v = visaFor(guide, dest.code, homeC?.code);
  const schengen = isSchengen(dest.code);
  const rows = [];
  if (v.specific) rows.push(h("p", { class: "guide-visa" }, h("strong", null, v.specific)));
  if (v.general) rows.push(h("p", null, v.general));
  if (v.checkList) {
    rows.push(h("p", { class: "guide-check" }, guide
      ? `We haven't checked the rules for ${homeC ? `${homeC.name} passports` : "your passport"} here, so look your passport up in the official list below.`
      : `We don't have a checked summary for ${dest.name} yet. Check the official sources below for your passport.`));
  }
  if (schengen && !guide?.visa?.schengen) rows.push(h("p", null, SCHENGEN_NOTE.text, " ", ext(SCHENGEN_NOTE.link)));
  const steps = guide?.visa?.steps ?? [];
  if (steps.length) {
    rows.push(h("h4", null, "Before you go"),
      h("ul", { class: "guide-list" }, steps.map((s) => h("li", null, s.text, s.link && [" ", ext(s.link)]))));
  }
  rows.push(h("h4", null, "Official sources"),
    linkList([
      ...(guide?.visa?.links ?? []),
      homeAdviceLink(homeC?.code),
      { label: "IATA Travel Centre: passport, visa and health rules by nationality", url: "https://www.iatatravelcentre.com/" },
      visaOverviewLink(homeC?.code),
    ]));
  if (entrySlot) rows.push(entrySlot);
  rows.push(h("p", { class: "small muted guide-note" }, `Checked ${guide ? GUIDES_CHECKED : "against the links above"}. Visa rules depend on your passport and the purpose of your trip, and they change. The official sites have the final say.`));
  return guideSec("Visa and entry", ...rows);
}

const telHref = (n) => `tel:${n.split(" ")[0].replace(/[^\d+]/g, "")}`;
const sosList = (rows) => h("ul", { class: "guide-sos" }, rows.map(([label, n]) =>
  h("li", null, h("span", null, label), h("a", { class: "num", href: telHref(n) }, n))));

let currencyNames = null;
try { currencyNames = new Intl.DisplayNames(["en"], { type: "currency" }); } catch { /* old browser */ }
const currencyLine = (code) => code && `Currency: ${(() => { try { return currencyNames?.of(code); } catch { return null; } })() || code} (${code}).`;

/** Plugs line: tailored to the traveller's home plugs when both are in the facts table. */
function plugsText(dest, homeC, curated) {
  const df = getFacts(dest.code);
  const hf = homeC && homeC.code !== dest.code ? getFacts(homeC.code) : null;
  if (df && hf) return plugAdvice(df, hf, homeC.name);
  return curated || (df ? plugAdvice(df) : null);
}

/** Keep Wikivoyage paragraphs skimmable: whole sentences up to about 320 characters. */
function shorten(text, limit = 320) {
  if (text.length <= limit) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const s of sentences) { if ((out + s).length > limit) break; out += s; }
  return (out.trim() || `${text.slice(0, limit).replace(/\s+\S*$/, "")}…`);
}

const AVOID = /^(don['’]t|do not|never|avoid|refrain|it is (considered )?(rude|impolite|offensive))/i;

function wvBlocks(blocks, max = 4) {
  return blocks.slice(0, max).map((b) => b.type === "p" ? h("p", null, shorten(b.text)) : bullets(b.items.slice(0, 6).map((t) => shorten(t, 240))));
}

/** Same cards for every country: hand-written where we have a guide, otherwise facts + live Wikivoyage text. */
function guideSections(g, dest, homeC, entryWv) {
  const facts = getFacts(dest.code);
  const sos = g?.emergency ?? emergencyRows(facts);
  const plugs = plugsText(dest, homeC, g?.plugs);
  const wvLink = { label: `${dest.name} on Wikivoyage (community travel guide)`, url: wikivoyageUrl(dest.name) };

  // Slots filled from Wikivoyage when there's no hand-written text.
  const slot = (title, cls) => {
    const body = h("div", { class: "guide-slot" }, h("p", { class: "small muted info-loading" }, "Loading tips from Wikivoyage…"));
    return { body, card: guideSec(title, body), cls };
  };
  const respect = !g && slot("Respect and etiquette");
  const moneyWv = !g && h("div", { class: "guide-slot" });
  const aroundWv = !g && h("div", { class: "guide-slot" });
  const safe = !g && slot("Stay safe");

  if (!g) {
    getWikivoyage(dest.name).then((wv) => {
      const by = Object.fromEntries(wv.sections.map((s) => [s.key, s]));
      const fill = (el, key, max, empty) => el.replaceChildren(...(by[key] ? wvBlocks(by[key].blocks, max) : empty ? [h("p", { class: "small muted" }, empty)] : []));
      fill(respect.body, "respect", 5, "Wikivoyage has no etiquette section for this country yet.");
      // Pull "don't / avoid / never" bullets into their own list so they stand out like the hand-written guides.
      const avoid = (by.respect?.blocks ?? []).flatMap((b) => b.type === "ul" ? b.items : []).filter((t) => AVOID.test(t));
      if (avoid.length) {
        respect.body.querySelectorAll("li").forEach((li) => { if (AVOID.test(li.textContent)) li.remove(); });
        respect.body.querySelectorAll("ul").forEach((ul) => { if (!ul.children.length) ul.remove(); });
        respect.body.append(h("h4", null, "Avoid"), bullets(avoid.slice(0, 6).map((t) => shorten(t, 240)), "dont"));
      }
      fill(safe.body, "safe", 5, "Wikivoyage has no safety section for this country yet.");
      fill(moneyWv, "money", 3);
      fill(aroundWv, "around", 3);
      if (by.entry) entryWv?.replaceChildren(h("details", { class: "guide-more" }, h("summary", null, "What travellers say about getting in (Wikivoyage)"), ...wvBlocks(by.entry.blocks, 5)));
      credit.replaceChildren("Etiquette, safety, money and transport tips come from ", ext({ url: wv.url }, `Wikivoyage's ${wv.title} guide`),
        ", written by travellers (CC BY-SA). For entry rules, trust the official sources above.");
    }).catch(() => {
      for (const el of [respect.body, safe.body]) el.replaceChildren(h("p", { class: "small muted" }, "Couldn't load tips right now. ", ext(wvLink, "Read it on Wikivoyage")));
      moneyWv.replaceChildren(); aroundWv.replaceChildren();
    });
  }
  const credit = h("p", { class: "small muted" });

  const drive = facts && `Traffic drives on the ${facts.drive}.`;
  return [
    g ? h("div", { class: "guide-grid" },
        guideSec("Do", bullets(g.dos, "do")),
        guideSec("Don't", bullets(g.donts, "dont")))
      : respect.card,
    h("div", { class: "guide-grid" },
      guideSec("Money and tipping", g ? bullets(g.money) : [currencyLine(dest.currency) && h("p", null, currencyLine(dest.currency)), moneyWv]),
      guideSec("Emergency numbers",
        sos.length ? sosList(sos) : h("p", { class: "small muted" }, "We haven't checked this country's numbers. 112 works from mobiles in many countries, but confirm locally when you arrive."),
        plugs && [h("h4", null, "Plugs and power"), h("p", null, plugs)])),
    guideSec("Getting around", g ? bullets(drive && !g.transport.some((t) => /drives? on the/i.test(t)) ? [...g.transport, drive] : g.transport) : [drive && h("p", null, h("strong", null, drive)), aroundWv]),
    !g && safe.card,
    guideSec("More reading", linkList([...(g?.links ?? []), wvLink])),
    !g && credit,
  ];
}

/* ----- live budget summary (right column) ----- */

let activeSummary = null; // { update(trip, draft) } for the summary on screen

function budgetSummary(trip, days) {
  const box = h("div", { class: "card summary", "aria-live": "polite" });
  const update = (t, draft = false) => box.replaceChildren(...summaryContent(t, days, draft));
  update(trip);
  activeSummary = { box, update };
  return box;
}

/** "Made up of €1,200.00 + CHF 340.00": what a multi-currency total is in each currency. */
function madeUpOf(s, trip) {
  const parts = Object.entries(s.byCurrency).filter(([, v]) => v > 0);
  if (!parts.length || (parts.length === 1 && parts[0][0] === trip.currency)) return null;
  return h("p", { class: "small muted made-of" }, "Made up of ", parts.sort((a, b) => (a[0] === trip.currency) - (b[0] === trip.currency))
    .map(([c, v], i) => [i ? " + " : "", h("span", { class: "num" }, formatMoney(v, c))]));
}

/** Plans whose currency we have no rate for are left out of totals, so say so. */
function unconvertedNote(s, trip) {
  if (!s.unconverted.length || ratesStatus === "loading") return null;
  return h("p", { class: "small bad" }, `Plans in ${s.unconverted.join(", ")} aren't in these totals: there's no exchange rate to ${trip.currency} right now.`);
}

function summaryContent(trip, days, draft) {
  const money = (n) => formatMoney(n, trip.currency);
  const s = summarize(trip, days.length);
  const toPay = Math.max(0, s.totalProjected - s.totalSpent);
  const cats = s.categories.filter((c) => c.projected > 0 || c.spent > 0).sort((a, b) => b.projected - a.projected);
  const hasBudget = s.totalBudget > 0;
  const over = hasBudget && s.remaining < 0;
  const pct = (v, of) => `${Math.min(100, of > 0 ? (v / of) * 100 : 0)}%`;

  const dayRows = days.map((d, i) => ({ label: `Day ${i + 1}`, sub: formatDay(d).split(", ")[1] ?? d, v: s.byDay[d] ?? 0 }));
  const daySet = new Set(days);
  const otherDays = Object.entries(s.byDay).filter(([d, v]) => v > 0 && !daySet.has(d));
  for (const [d, v] of otherDays.filter(([d]) => d).sort()) dayRows.push({ label: formatDay(d), sub: "", v });
  if (s.byDay[""] > 0) dayRows.push({ label: "Unscheduled", sub: "", v: s.byDay[""] });
  const maxDay = Math.max(1, ...dayRows.map((r) => r.v));

  const goBudget = () => { ui.tab = "budget"; ui.editingItem = null; ui.attachOpen = null; render(); };

  if (s.totalProjected === 0 && s.totalSpent === 0 && !s.unconverted.length) {
    return [h("div", { class: "summary-body" },
      h("h2", null, "Budget"),
      h("p", { class: "small muted" }, "Add a cost to any plan and it shows up here as a to-pay checklist. Tick things off as you pay for them."))];
  }

  return [h("div", { class: "summary-body" },
    h("div", { class: "summary-head" }, h("h2", null, "Budget"), draft && h("span", { class: "summary-draft small" }, "Includes unsaved changes")),
    h("div", null,
      h("p", { class: "small muted" }, "Total cost"),
      h("p", { class: "summary-total num" }, money(s.totalProjected)),
      alt(s.totalProjected, trip.currency, "summary-alt"),
      madeUpOf(s, trip),
      unconvertedNote(s, trip),
      h("p", { class: "small muted" }, `${money(s.projectedPerPerson)} per person`, s.projectedPerDay !== null ? ` · ${money(s.projectedPerDay)} per day` : "")),
    h("div", { class: "summary-split" },
      h("div", null, h("span", { class: "small muted" }, "Paid so far"), h("strong", { class: "num good" }, money(s.totalSpent)), alt(s.totalSpent, trip.currency)),
      h("div", null, h("span", { class: "small muted" }, "Still to pay"), h("strong", { class: "num" }, money(toPay)), alt(toPay, trip.currency))),
    s.totalProjected > 0 && h("div", { class: "bar", title: `${Math.round((s.totalSpent / s.totalProjected) * 100)}% paid` }, h("div", { style: `width:${pct(s.totalSpent, s.totalProjected)}` })),
    // Compare with the total budget only when every category with costs has a limit; otherwise call out each category that's over.
    hasBudget && cats.every((c) => c.budget !== null) && h("p", { class: `small ${over ? "bad strong" : "muted"}` },
      over ? `${money(Math.abs(s.remaining))} over your ${money(s.totalBudget)} budget` : `${money(s.remaining)} left of your ${money(s.totalBudget)} budget`,
      homeText(Math.abs(s.remaining), trip.currency) && ` (${homeText(Math.abs(s.remaining), trip.currency)})`),
    hasBudget && !cats.every((c) => c.budget !== null) && cats.filter((c) => c.budget !== null && c.projected > c.budget).map((c) =>
      h("p", { class: "small bad strong" }, `${c.category} is ${money(c.projected - c.budget)} over its ${money(c.budget)} limit`)),
    toPayList(trip, days),
    h("details", { class: "summary-more", open: ui.summaryMore, ontoggle: (e) => { ui.summaryMore = e.currentTarget.open; } },
      h("summary", null, "Breakdown by category and day"),
    h("section", { class: "summary-sec" },
      h("h3", null, "By category"),
      h("ul", { class: "summary-list" }, cats.map((c) => h("li", null,
        h("span", { class: "summary-row" },
          h("span", null, h("i", { class: `dot cat-${c.category}` }), c.category),
          h("span", { class: "summary-amt" },
            h("span", { class: `num ${c.budget !== null && c.projected > c.budget ? "bad strong" : ""}` }, money(c.projected)),
            alt(c.projected, trip.currency))),
        h("span", { class: "bar thin" }, h("span", { class: `cat-${c.category}`, style: `width:${pct(c.projected, s.totalProjected)}` })),
        c.spent > 0 && h("span", { class: "small muted" }, `${money(c.spent)} paid`))))),
    dayRows.some((r) => r.v > 0) && h("section", { class: "summary-sec" },
      h("h3", null, "By day"),
      h("ul", { class: "summary-days" }, dayRows.map((r) => h("li", { class: r.v ? "" : "zero" },
        h("span", null, r.label, r.sub && h("span", { class: "muted" }, ` ${r.sub}`)),
        h("span", { class: "bar thin" }, h("span", { style: `width:${pct(r.v, maxDay)}` })),
        h("span", { class: "num", title: r.v ? homeText(r.v, trip.currency) || null : null }, r.v ? money(r.v) : "–")))))),
    rateNote(trip),
    ui.tab !== "budget" && h("button", { class: "btn", type: "button", onclick: goBudget }, hasBudget ? "Budget limits" : "Set budget limits"))];
}

/** Every plan with a cost, in itinerary order, as a checklist: tick it when it's paid. */
function toPayList(trip, days) {
  const rows = orderedItems({ items: budgetEntries(trip) }, days).filter((i) => expectedCost(i) > 0 || isPaid(i));
  if (!rows.length) return null;
  const left = rows.filter((i) => !isPaid(i)).length;
  const dayLabel = (d) => {
    if (!d) return "Unscheduled";
    const i = days.indexOf(d);
    return i >= 0 ? `Day ${i + 1}` : formatDay(d);
  };
  const toggle = (item, paid) => {
    const fresh = loadTrips().find((t) => t.id === trip.id) ?? trip;
    const next = item.booking
      ? { ...fresh, bookings: bookingsOf(fresh).map((b) => (b.id === item.id ? { ...b, paid } : b)) }
      : { ...fresh, items: fresh.items.map((i) => (i.id === item.id ? setPaid(i, paid) : i)) };
    saveTrip(next);
    // Don't wipe a plan that's being edited: just refresh the summary.
    if (ui.editingItem && activeSummary?.box.isConnected) activeSummary.update(next);
    else render();
  };
  return h("section", { class: "summary-sec" },
    h("div", { class: "summary-row" }, h("h3", null, "To pay"),
      h("span", { class: "small muted" }, left ? `${left} of ${rows.length} left` : "All paid 🎉")),
    h("ul", { class: "pay-list" }, rows.map((item) => {
      const paid = isPaid(item);
      const amount = expectedCost(item);
      const cur = itemCurrency(item, trip);
      const box = h("input", { type: "checkbox", checked: paid, "aria-label": `${item.title}: paid` });
      box.addEventListener("change", () => toggle(item, box.checked));
      return h("li", { class: paid ? "paid-row" : "" },
        h("label", null,
          box,
          h("span", { class: "pay-main" },
            h("span", { class: "pay-title" }, item.title),
            h("span", { class: "small muted" }, h("i", { class: `dot cat-${item.category}` }), item.booking ? "🎟️ Booking · " : "", dayLabel(item.date))),
          h("span", { class: "pay-amt" },
            h("span", { class: "num" }, formatMoney(amount, cur)),
            alt(amount, cur))));
    })));
}

const shortDate = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Every currency the trip's costs are in, the trip's own first. */
function tripCurrencyList(trip) {
  return [...new Set([trip.currency, ...trip.items.filter((i) => i.estimatedCost > 0 || i.actualCost > 0).map((i) => itemCurrency(i, trip))].filter(Boolean))];
}

/** "¥1,000 = S$8.70 · €1.00 = S$1.45 · rates from 23 Nov 2026", plus what to do when rates can't load. */
function rateNote(trip) {
  const foreign = tripCurrencyList(trip).filter((c) => c !== home.currency);
  if (!foreign.length) return null;
  const link = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
  if (ratesStatus === "loading" && !rates) return h("p", { class: "small muted rate-note" }, `Loading ${home.currency} exchange rate…`);
  if (!rates) {
    return h("p", { class: "small muted rate-note" }, `Couldn't load exchange rates, so ${home.currency} amounts are hidden. `,
      h("button", { class: "linkish", type: "button", onclick: () => { loadRates(); render(); } }, "Try again"));
  }
  const pairs = foreign.slice(0, 4).map((cur) => {
    let unit = 1;
    while (unit < 1e6 && (toHome(unit, cur) ?? 1) < 1) unit *= 10;
    const v = toHome(unit, cur);
    return v === null ? `no rate for ${cur}` : `${formatMoney(unit, cur)} = ${formatMoney(v, home.currency)}`;
  });
  return h("p", { class: "small muted rate-note" },
    `${pairs.join(" · ")} · `,
    rates.stale ? `offline, using rates from ${shortDate(rates.updated)}` : `rates from ${shortDate(rates.updated)}`, " · ",
    rates.source === "er-api" ? link("https://www.exchangerate-api.com", "Rates by Exchange Rate API") : link("https://frankfurter.dev", "Frankfurter (ECB)"));
}

/** Itinerary order: trip days, then dates outside the trip, then unscheduled. */
function orderedItems(trip, days) {
  const daySet = new Set(days);
  const rank = (i) => (daySet.has(i.date) ? `0${i.date}` : i.date ? `1${i.date}` : "2");
  return [...trip.items].sort((a, b) => rank(a).localeCompare(rank(b)) || byTime(a, b));
}

/** The plan the info panel is about: the one being edited, the one picked, or the first plan. */
function selectedItem(trip, days) {
  const e = ui.editingItem;
  const id = e?.mode === "edit" ? e.id : ui.selectedItem;
  return trip.items.find((i) => i.id === id) ?? orderedItems(trip, days)[0] ?? null;
}

function exportCsv(trip) {
  const blob = new Blob([itemsToCsv(trip.items, trip.currency)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: `${trip.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "trip"}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importCsv(trip, text) {
  const { items, skipped, matchedColumns } = csvToItems(text);
  if (items.length === 0) {
    ui.notice = matchedColumns.length === 0
      ? "Couldn't find any columns we recognize. The first row should have headers like Date, Activity, Cost."
      : "No rows with a title or activity were found in that file.";
    render();
    return;
  }
  const dated = items.map((i) => i.date).filter(Boolean).sort();
  const patch = !trip.startDate && !trip.endDate && dated.length ? { startDate: dated[0], endDate: dated[dated.length - 1] } : {};
  // A Currency column is kept per row; rows without one are in the trip's currency.
  const imported = items.map((i) => withCurrency(i, i.currency, trip));
  const noCurrency = !matchedColumns.includes("currency") && isMulti(trip) && items.some((i) => i.estimatedCost || i.actualCost);
  saveTrip({ ...trip, ...patch, items: [...trip.items, ...imported] });
  ui.notice = `Imported ${plural(items.length, "plan")}${skipped ? `, skipped ${plural(skipped, "empty row")}` : ""}.` +
    (noCurrency ? ` The file has no Currency column, so its costs were read as ${trip.currency}. Edit a plan to change its currency.` : "");
  render();
}

/* ----- itinerary ----- */

function itineraryView(trip, days) {
  const daySet = new Set(days);
  const groups = days.map((d, i) => ({ key: d, day: true, label: `Day ${i + 1}`, sub: formatDay(d), items: sortItems(trip.items.filter((it) => it.date === d)) }));
  const outside = trip.items.filter((it) => !daySet.has(it.date));
  for (const d of [...new Set(outside.map((i) => i.date).filter(Boolean))].sort()) {
    groups.push({ key: d, label: formatDay(d), sub: "Outside trip dates", items: sortItems(outside.filter((i) => i.date === d)) });
  }
  groups.push({ key: "", label: "Unscheduled", sub: "Ideas and things without a day yet", items: sortItems(outside.filter((i) => !i.date)) });

  const saveItem = (item) => {
    const exists = trip.items.some((i) => i.id === item.id);
    saveTrip({ ...trip, items: exists ? trip.items.map((i) => (i.id === item.id ? item : i)) : [...trip.items, item] });
    ui.editingItem = null;
    render();
  };
  const cancel = () => { ui.editingItem = null; render(); };
  const selected = selectedItem(trip, days);
  const byDay = summarize(trip, days.length).byDay;

  return h("div", { class: "stack" },
    days.length === 0 && h("p", { class: "hint" }, "Set start and end dates in Edit trip to get a day-by-day plan."),
    groups.map((g) => {
      // In the trip's currency; plans in other currencies are converted (and skipped if there's no rate).
      // A booking counts on the day of the first plan that uses it.
      const total = byDay[g.key] ?? 0;
      const e = ui.editingItem;
      return h("section", { class: "day", "aria-label": g.label },
        h("div", { class: "day-head" },
          h("h3", null, g.label), g.sub && h("span", { class: "muted" }, g.sub),
          g.day && baseButton(trip, days, g.key),
          total > 0 && h("span", { class: "muted num push" }, formatMoney(total, trip.currency), homeText(total, trip.currency) && ` · ${homeText(total, trip.currency)}`)),
        travelLine(g.items),
        g.day && ui.editingBase === g.key && basePicker(trip, days, g.key),
        h("ul", { class: "items" },
          g.items.map((item) => h("li", null, e?.mode === "edit" && e.id === item.id
            ? itemForm(item, trip, days, saveItem, cancel, () => {
                saveTrip({ ...trip, items: trip.items.filter((i) => i.id !== item.id) });
                deleteItemFiles(item.id);
                ui.editingItem = null;
                render();
              })
            : [itemRow(item, trip, selected?.id === item.id), ui.attachOpen === item.id && attachPanel(item, trip),
               !WIDE.matches && selected?.id === item.id && ui.selectedItem === item.id && h("div", { class: "info-inline" }, infoPanel(item, trip, days))])),
          h("li", null, e?.mode === "new" && e.date === g.key
            ? itemForm(emptyItem(g.key), trip, days, saveItem, cancel)
            : h("button", { class: "btn ghost", type: "button", onclick: () => { ui.editingItem = { mode: "new", date: g.key }; ui.attachOpen = null; render(); } }, "+ Add a plan"))));
    }));
}

/** "✈ Travel day: Singapore → Tokyo" under a day's heading. */
function travelLine(items) {
  const trips = items.filter((i) => i.travel && routeText(i.travel));
  if (!trips.length) return null;
  return h("p", { class: "travel-day small" }, trips.map((i, n) => [n ? " · " : "",
    h("span", { "aria-hidden": "true" }, `${travelMode(i.travel.mode).icon} `), n ? "" : "Travel day: ", routeText(i.travel)]));
}

/* ----- where you are each day ----- */

function baseButton(trip, days, date) {
  const b = dayBase(trip, date, days);
  const open = ui.editingBase === date;
  const title = !b ? "Pick the city and area you'll be in"
    : b.set ? "Change where you are this day"
    : b.arrived && b.from === undefined ? `Arriving in ${b.city} by your travel plan. Click to pick an area.`
    : b.from !== undefined ? `Still in ${b.city} from Day ${b.from + 1}. Click to pick an area or another city.` : "Click to pick an area";
  return h("button", { class: `day-base${b?.set ? " set" : ""}${open ? " open" : ""}`, type: "button", title, "aria-expanded": String(open),
    onclick: () => { ui.editingBase = open ? null : date; render(); } },
    h("span", { "aria-hidden": "true" }, "📍"), " ",
    b && isMulti(trip) && FLAGS_OK ? `${flag(cityCountry(trip, b.city))} ` : "",
    b ? baseLabel(b) : "Where are you this day?",
    b && !b.area && h("span", { class: "day-base-add" }, " · pick an area"));
}

function setDayBase(trip, date, base) {
  updateTrip(trip.id, (t) => {
    const dayBases = { ...(t.dayBases ?? {}) };
    if (base) dayBases[date] = base; else delete dayBases[date];
    let cities = tripCities(t);
    if (base?.city && !cities.some((c) => sameName(c.name, base.city))) {
      const country = base.cityCountry && tripCountries(t).includes(base.cityCountry) ? base.cityCountry : tripCountries(t)[0];
      cities = [...cities, { name: base.city, ...(country ? { country } : {}), ...(base.cityPoint ?? {}) }];
    }
    delete base?.cityPoint;
    delete base?.cityCountry;
    return { ...t, dayBases, cities, destination: destinationText(cities) };
  });
}

function basePicker(trip, days, date) {
  const i = days.indexOf(date);
  const cities = tripCities(trip);
  const b = dayBase(trip, date, days);
  const city = b?.city ?? "";
  const ccs = tripCountries(trip);
  const multi = ccs.length > 1;
  const cc = city ? cityCountry(trip, city) : ccs[0];
  const country = getCountry(ccs[0]);
  const close = () => { ui.editingBase = null; render(); };
  const pickCity = (name, point, cityCc) => {
    if (sameName(name, b?.city) && b?.set) { render(); return; }
    setDayBase(trip, date, { city: name, cityPoint: point, cityCountry: cityCc });
    render();
  };
  const pickArea = (name, point) => {
    setDayBase(trip, date, { city, area: name, ...(point ?? {}) });
    ui.editingBase = null;
    render();
  };

  // Another city, searched in the trip's country.
  const otherCity = h("input", { name: "otherCity", placeholder: cities.length ? "Another city…" : `A city${country && !multi ? ` in ${country.name}` : ""}`, autofocus: !cities.length || null });
  const otherCityBox = autocomplete(otherCity, {
    delay: 300,
    search: (q, signal) => searchPlaces(q, ccs, signal, { only: "settlement", minChars: 2 }),
    renderItem: multi ? (p) => [...settlementRow(p), FLAGS_OK && p.countryCode && h("span", { class: "ac-tag" }, flag(p.countryCode))].filter(Boolean) : settlementRow,
    footer: osmFooter,
    onPick: (p) => pickCity(p.name, Number.isFinite(p.lat) ? { lat: p.lat, lon: p.lon } : null, p.countryCode),
  });
  otherCity.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.defaultPrevented && otherCity.value.trim()) { e.preventDefault(); pickCity(otherCity.value.trim()); }
  });
  const cityChoices = [...cities.map((c) => c.name), ...popularCities(ccs[0]).filter((n) => !cities.some((c) => sameName(c.name, n))).slice(0, cities.length ? 0 : 6)];
  const cityChip = (n) => (multi && FLAGS_OK ? `${flag(cityCountry(trip, n))} ${n}` : n);

  // Areas in the chosen city: popular ones, or search for any neighbourhood, station or landmark near it.
  const near = basePoint(trip, { city });
  const areaInput = h("input", { name: "otherArea", placeholder: "Another area, station or landmark…", autofocus: Boolean(city) || null });
  const areaBox = autocomplete(areaInput, {
    delay: 350,
    search: (q, signal) => searchPlaces(q, cc, signal, { near }),
    renderItem: settlementRow, footer: osmFooter,
    onPick: (p) => pickArea(p.name, Number.isFinite(p.lat) ? { lat: p.lat, lon: p.lon } : null),
  });
  areaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.defaultPrevented && areaInput.value.trim()) { e.preventDefault(); pickArea(areaInput.value.trim()); }
  });
  const areas = popularAreas(cc, city);

  return h("div", { class: "card pad base-picker stack" },
    h("p", { class: "base-q" }, h("strong", null, `Where are you on Day ${i + 1}?`),
      b && !b.set && b.from !== undefined && h("span", { class: "small muted" }, ` Days you don't set stay in the last city you picked (${b.city}, from Day ${b.from + 1}).`)),
    h("div", { class: "base-row" },
      h("span", { class: "base-label small muted" }, "City"),
      h("div", { class: "base-choices" },
        cityChoices.map((n) => h("button", { type: "button", class: `chip small${sameName(n, city) ? " active" : ""}`, "aria-pressed": String(sameName(n, city)), onclick: () => pickCity(n) }, cityChip(n))),
        h("div", { class: "base-other" }, otherCityBox.el))),
    city && h("div", { class: "base-row" },
      h("span", { class: "base-label small muted" }, "Area"),
      h("div", { class: "base-choices" },
        h("button", { type: "button", class: `chip small${b?.set && !b.area ? " active" : ""}`, onclick: () => { if (!b?.set || b.area) setDayBase(trip, date, { city }); close(); } }, `All over ${city}`),
        areas.map((a) => h("button", { type: "button", class: `chip small${sameName(a, b?.area) ? " active" : ""}`, "aria-pressed": String(sameName(a, b?.area)), onclick: () => pickArea(a) }, a)),
        h("div", { class: "base-other" }, areaBox.el))),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "button", onclick: close }, "Done"),
      b?.set && h("button", { class: "btn ghost", type: "button", onclick: () => { setDayBase(trip, date, null); close(); } }, "Clear this day"),
      h("span", { class: "small muted push" }, "Discover and place suggestions for this day will look around here first.")));
}

const clipIcon = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<path d="M21.4 11.1 12.2 20.3a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
};

const pencilIcon = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
};

const editItem = (item) => { Object.assign(ui, { editingItem: { mode: "edit", id: item.id }, selectedItem: item.id, attachOpen: null }); render(); };

function itemRow(item, trip, selected) {
  const files = [...(item.attachments ?? []), ...(bookingOf(trip, item)?.attachments ?? [])];
  const open = ui.attachOpen === item.id;
  return h("div", { class: `item-wrap${open ? " open" : ""}${selected ? " selected" : ""}` },
    itemButton(item, trip, selected),
    h("button", { class: "attach-btn", type: "button", "aria-label": `Edit ${item.title}`, title: "Edit plan", onclick: () => editItem(item) }, pencilIcon()),
    h("button", {
      class: `attach-btn${files.length ? " has" : ""}`, type: "button",
      "aria-expanded": String(open),
      "aria-label": `Attachments for ${item.title}${files.length ? ` (${files.length})` : ""}`,
      title: files.length ? `${plural(files.length, "attachment")}` : "Attach tickets or files",
      onclick: () => {
        Object.assign(ui, { attachOpen: open ? null : item.id, attachError: null, confirmRemoveFile: null, editingItem: null, selectedItem: item.id });
        render();
      },
    }, clipIcon(), files.length ? h("span", { class: "num" }, files.length) : null));
}

// Clicking a plan shows its place info; clicking it again (or the pencil) edits it.
function itemButton(item, trip, selected) {
  const booking = bookingOf(trip, item);
  return h("button", {
    class: `item${item.travel ? " cat-line-Flights" : ` cat-line-${item.category}`}`, type: "button", "aria-pressed": String(Boolean(selected)),
    title: selected ? "Click again to edit" : "Show info about this place",
    onclick: () => {
      if (selected && ui.selectedItem === item.id) return editItem(item);
      Object.assign(ui, { selectedItem: item.id, editingItem: null });
      render();
    },
  },
    h("span", { class: "item-time num muted" }, item.time || "--:--"),
    h("span", { class: "item-main" },
      h("span", { class: "item-title" }, item.title),
      h("span", { class: "item-meta" },
        item.travel
          ? h("span", null, `${travelMode(item.travel.mode).icon} `, [item.travel.number, airportRoute(item.travel), travelTimes(item)].filter(Boolean).join(" · ") || travelMode(item.travel.mode).label)
          : h("span", null, h("i", { class: `dot cat-${item.category}` }), item.category),
        !item.travel && item.location && h("span", null, item.location),
        item.notes && h("em", null, item.notes),
        item.link && h("span", null, "🔗"),
        booking && h("span", { class: "booking-tag" }, "🎟️ ", booking.title))),
    booking ? bookingCost(booking, trip) : h("span", { class: "item-cost num" },
      expectedCost(item) > 0 || isPaid(item)
        ? [formatMoney(expectedCost(item), itemCurrency(item, trip)), alt(expectedCost(item), itemCurrency(item, trip)),
           isPaid(item) ? h("small", { class: "paid" }, "✓ Paid")
             : h("small", { class: "muted" }, "To pay")]
        : ""));
}

/* ----- bookings: what's booked and paid, with its tickets; plans can point at one ----- */

// The cost column for a booking (on its card, and on plans that use it).
function bookingCost(b, trip) {
  const amount = Number(b.amount) || 0;
  const cur = b.currency || trip.currency;
  return h("span", { class: "item-cost num" },
    amount > 0 || b.paid
      ? [formatMoney(amount, cur), alt(amount, cur),
         b.paid ? h("small", { class: "paid" }, "✓ Paid", b.paidBy ? ` · ${b.paidBy}` : "") : h("small", { class: "muted" }, "To pay")]
      : "");
}

function saveBookings(tripId, fn) {
  const trip = loadTrips().find((t) => t.id === tripId);
  if (trip) saveTrip({ ...trip, bookings: fn(bookingsOf(trip)) });
}

function bookingsView(trip, days) {
  const first = (b) => plansUsing(trip, b).map((p) => p.date).filter(Boolean).sort()[0] || b.date || "9";
  const list = [...bookingsOf(trip)].sort((a, b) => first(a).localeCompare(first(b)));
  const done = () => { ui.editingBooking = null; render(); };
  const save = (b) => { saveBookings(trip.id, (all) => (all.some((x) => x.id === b.id) ? all.map((x) => (x.id === b.id ? b : x)) : [...all, b])); done(); };
  const remove = (b) => {
    const t = loadTrips().find((x) => x.id === trip.id) ?? trip;
    // Plans that used it keep going, just without the booking.
    saveTrip({ ...t, bookings: bookingsOf(t).filter((x) => x.id !== b.id),
      items: t.items.map((i) => { if (i.bookingId !== b.id) return i; const { bookingId: _b, ...rest } = i; return rest; }) });
    deleteItemFiles(b.id);
    done();
  };
  const adding = ui.editingBooking === "new";
  return h("div", { class: "stack bookings" },
    h("div", { class: "ideas-head" },
      h("h2", null, "Bookings"),
      h("p", { class: "small muted" }, "Keep what you've booked here: how much, how it was paid, and the tickets. In a plan, press ",
        h("strong", null, "+ Booking"), " to use one. The plan then shows its tickets and cost, and the budget counts it once.")),
    adding
      ? h("div", { class: "card pad idea-new" }, h("h3", null, "🎟️ New booking"), bookingForm(emptyBooking(), trip, save, done))
      : h("button", { class: "btn primary idea-add-btn", type: "button", onclick: () => { Object.assign(ui, { editingBooking: "new", attachOpen: null }); render(); } }, "＋ Add a booking"),
    list.length === 0
      ? !adding && emptyState("🎟️", "No bookings yet", "Add hotel stays, flights, theme park tickets or tours once they're booked, with their confirmation and tickets.")
      : h("ul", { class: "items" }, list.map((b) => h("li", null, ui.editingBooking === b.id
          ? bookingForm(b, trip, save, done, () => remove(b))
          : [bookingRow(b, trip, days), ui.attachOpen === b.id && attachPanel(b, trip)]))));
}

function bookingRow(b, trip, days) {
  const files = b.attachments ?? [];
  const open = ui.attachOpen === b.id;
  const plans = plansUsing(trip, b).sort((x, y) => (x.date || "9").localeCompare(y.date || "9") || byTime(x, y));
  const when = b.date && (b.endDate && b.endDate !== b.date ? `${shortDay(b.date)} to ${shortDay(b.endDate)}` : shortDay(b.date));
  const edit = () => { Object.assign(ui, { editingBooking: b.id, attachOpen: null }); render(); };
  return h("div", { class: `item-wrap${open ? " open" : ""}` },
    h("div", { class: `item booking-card cat-line-${b.category}` },
      h("span", { class: "item-main" },
        h("span", { class: "item-title" }, b.title),
        h("span", { class: "item-meta" },
          h("span", null, h("i", { class: `dot cat-${b.category}` }), b.category),
          when && h("span", null, when),
          b.provider && h("span", null, b.provider),
          b.confirmation && h("span", null, "Ref ", h("span", { class: "num" }, b.confirmation)),
          b.link && h("a", { href: b.link, target: "_blank", rel: "noopener" }, "Open booking ↗"),
          b.notes && h("em", null, b.notes)),
        h("span", { class: "idea-plans" }, plans.length
          ? plans.map((p) => h("button", { class: "idea-plan", type: "button", title: "Show it in the itinerary", onclick: () => goToPlan(p.id) },
              "✓ ", p.title, " · ", dayLabel(p.date, days)))
          : h("span", { class: "small muted" }, "Not in the itinerary yet. Pick it in a plan with + Booking."))),
      bookingCost(b, trip)),
    h("button", { class: "attach-btn", type: "button", "aria-label": `Edit ${b.title}`, title: "Edit booking", onclick: edit }, pencilIcon()),
    h("button", {
      class: `attach-btn${files.length ? " has" : ""}`, type: "button", "aria-expanded": String(open),
      "aria-label": `Tickets for ${b.title}${files.length ? ` (${files.length})` : ""}`,
      title: files.length ? plural(files.length, "attachment") : "Attach tickets or files",
      onclick: () => { Object.assign(ui, { attachOpen: open ? null : b.id, attachError: null, confirmRemoveFile: null, editingBooking: null }); render(); },
    }, clipIcon(), files.length ? h("span", { class: "num" }, files.length) : null));
}

function bookingForm(b, trip, onSave, onCancel, onDelete) {
  const isNew = !onDelete;
  const startCur = b.currency || trip.currency;
  const curOptions = [...new Set([startCur, trip.currency, ...tripCountries(trip).map(currencyForCountry), home.currency, ...ALL_CURRENCIES].filter(Boolean))];
  const currencySelect = h("select", { name: "currency", "aria-label": "Currency" }, curOptions.map((c) => h("option", { selected: c === startCur }, c)));
  const amount = costField("Amount", h("input", { name: "amount", type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "0", value: Number(b.amount) || "" }), () => currencySelect.value);
  currencySelect.addEventListener("change", amount.update);
  const titleInput = h("input", { name: "title", value: b.title, placeholder: "e.g. Tokyo Disneyland 1-Day Passport", autocomplete: "off" });
  const sites = `sites-${b.id}`;
  const files = formFiles(b);
  const form = h("form", { class: "card pad form-grid six editing" },
    field("What", titleInput, "span-4"),
    field("Type", h("select", { name: "category" }, CATEGORIES.map((c) => h("option", { selected: c === b.category }, c))), "span-2"),
    field("Booked on", h("input", { name: "provider", list: sites, value: b.provider, placeholder: "e.g. Klook" }), "span-3"),
    h("datalist", { id: sites }, BOOKING_SITES.map((x) => h("option", { value: x }))),
    field("Confirmation no.", h("input", { name: "confirmation", value: b.confirmation, placeholder: "Optional" }), "span-3"),
    field("Date", h("input", { name: "date", type: "date", value: b.date }), "span-2"),
    field("Until (optional)", h("input", { name: "endDate", type: "date", value: b.endDate }), "span-2"),
    field("Paid by", h("select", { name: "paidBy" }, h("option", { value: "" }, "Not set"), PAID_BY.map((x) => h("option", { selected: x === b.paidBy }, x))), "span-2"),
    amount.el,
    field("Currency", currencySelect, "span-1"),
    h("label", { class: "check span-3 next-day" }, h("input", { type: "checkbox", name: "paid", checked: Boolean(b.paid) }), h("span", null, "Paid")),
    files.el,
    foldable([
      { label: "Link", el: field("Link", h("input", { name: "link", type: "url", placeholder: "https://", value: b.link }), "span-all"), open: Boolean(b.link) },
      { label: "Notes", el: field("Notes", h("textarea", { name: "notes", rows: 2 }, b.notes), "span-all"), open: Boolean(b.notes?.trim()) }]),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, isNew ? "Save booking" : "Save"),
      h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"),
      onDelete && h("button", { class: "btn danger push", type: "button", onclick: onDelete }, "Delete")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.saving) return;
    const f = new FormData(form);
    const title = String(f.get("title")).trim();
    if (!title) { titleInput.focus(); return; }
    let attachments = b.attachments ?? [];
    if (files.changed()) {
      form.dataset.saving = "1";
      attachments = await files.commit(trip.id, b.id);
      delete form.dataset.saving;
      if (!attachments) return;
    }
    const cur = String(f.get("currency"));
    const { currency: _c, attachments: _a, pendingFiles: _p, removingFiles: _r, ...rest } = b;
    onSave({
      ...rest, title,
      category: String(f.get("category")),
      provider: String(f.get("provider")).trim(),
      confirmation: String(f.get("confirmation")).trim(),
      date: String(f.get("date") ?? ""), endDate: String(f.get("endDate") ?? ""),
      paidBy: String(f.get("paidBy") ?? ""),
      amount: Math.max(0, Number(f.get("amount")) || 0),
      ...(cur !== trip.currency ? { currency: cur } : {}),
      paid: f.get("paid") === "on",
      link: String(f.get("link") ?? "").trim(),
      notes: String(f.get("notes") ?? ""),
      ...(attachments.length ? { attachments } : {}),
    });
  });
  queueMicrotask(() => { if (isNew) titleInput.focus(); });
  return form;
}

/* ----- saved places: a scratchpad of places, each one a click away from the itinerary ----- */

const plansFrom = (trip, idea) => trip.items.filter((i) => i.fromIdea === idea.id);

/** The saved place the info panel is about: the one being edited, picked or scheduled, or the first one. */
function selectedIdea(trip) {
  const ideas = trip.ideas ?? [];
  const id = ui.editingIdea ?? ui.selectedIdea ?? ui.schedulingIdea;
  const tab = ideaTab(trip);
  return ideas.find((i) => i.id === id)
    ?? groupIdeas(ideas, (i) => plansFrom(trip, i).length > 0).filter((g) => tab.groups.includes(g.key))[0]?.ideas[0] ?? null;
}

// The info panel works on plans, so give it a saved place in that shape.
const ideaAsItem = (idea) => idea && {
  id: idea.id, title: idea.title, location: idea.location, link: idea.link, place: idea.place,
  category: groupOf(idea.group).category, group: idea.group, date: "", time: "", saved: true,
};

// Re-reads the trip before writing so the list never overwrites newer edits.
function updateIdeas(tripId, fn) {
  const trip = loadTrips().find((t) => t.id === tripId);
  if (trip) saveTrip({ ...trip, ideas: fn(trip.ideas ?? []) });
}

function dayLabel(date, days) {
  if (!date) return "Unscheduled";
  const i = days.indexOf(date);
  return i >= 0 ? `Day ${i + 1}` : formatDay(date);
}

function goToPlan(planId) {
  Object.assign(ui, { tab: "itinerary", selectedItem: planId, editingItem: null, attachOpen: null, editingIdea: null, schedulingIdea: null });
  render();
  root.querySelector(".item-wrap.selected")?.scrollIntoView({ block: "center" });
}

/** The open Saved places sub-tab: the one picked, else the first with something in it, else Hotels. */
function ideaTab(trip) {
  const ideas = trip.ideas ?? [];
  return IDEA_TABS.find((t) => t.key === ui.ideaTab)
    ?? IDEA_TABS.find((t) => ideas.some((i) => tabOf(i.group).key === t.key)) ?? IDEA_TABS[0];
}

/** Add a saved place to the itinerary: one plan, or a hotel's check-in and check-out. */
function addIdeaPlans(trip, idea, when, days) {
  const current = loadTrips().find((t) => t.id === trip.id);
  if (!current) return;
  const plans = ideaToItems(idea, when).map((p) =>
    withCurrency(p, idea.info?.currency || planCurrency(current, idea.place?.cc || dayCountry(current, p.date, days)), current));
  saveTrip({ ...current, items: [...current.items, ...plans] });
}

function ideasView(trip, days) {
  const ideas = trip.ideas ?? [];
  const tab = ideaTab(trip);
  const isAdded = (i) => plansFrom(trip, i).length > 0;
  const list = groupIdeas(ideas, isAdded).filter((g) => tab.groups.includes(g.key)).flatMap((g) => g.ideas);
  const selected = selectedIdea(trip);

  const addNew = (idea) => {
    updateIdeas(trip.id, (l) => [...l, idea]);
    Object.assign(ui, { addingIdea: false, selectedIdea: idea.id });
    render();
  };
  const saveEdit = (idea) => {
    updateIdeas(trip.id, (l) => l.map((i) => (i.id === idea.id ? idea : i)));
    ui.editingIdea = null;
    render();
  };
  const remove = (idea) => {
    updateIdeas(trip.id, (l) => l.filter((i) => i.id !== idea.id));
    Object.assign(ui, { editingIdea: null, selectedIdea: null, schedulingIdea: null });
    render();
  };
  const switchTab = (key) => { Object.assign(ui, { ideaTab: key, addingIdea: false, editingIdea: null, schedulingIdea: null, selectedIdea: null }); render(); };
  const count = (t) => ideas.filter((i) => tabOf(i.group).key === t.key).length;

  return h("div", { class: "stack ideas" },
    h("div", { class: "ideas-head" },
      h("h2", null, "Saved places"),
      h("p", { class: "small muted" }, "Keep hotels, activities and food spots here with their prices and bookings. When you know the day, press ",
        h("strong", null, "Add to itinerary"), " and the cost goes into your budget.")),
    h("div", { class: "subtabs", role: "tablist", "aria-label": "Kinds of saved places" }, IDEA_TABS.map((t) =>
      h("button", { type: "button", role: "tab", class: "subtab", "aria-selected": String(t.key === tab.key), onclick: () => switchTab(t.key) },
        h("span", { "aria-hidden": "true" }, t.icon), t.label, count(t) ? h("span", { class: "tab-count num" }, count(t)) : null))),
    ui.addingIdea
      ? h("div", { class: "card pad idea-new" },
          h("h3", null, `${tab.icon} ${tab.add}`),
          ideaForm(emptyIdea(tab.groups[0]), trip, days, { isNew: true, focus: true, onSave: addNew, onCancel: () => { ui.addingIdea = false; render(); } }))
      : h("button", { class: "btn primary idea-add-btn", type: "button", onclick: () => { Object.assign(ui, { addingIdea: true, editingIdea: null, schedulingIdea: null }); render(); } }, `＋ ${tab.add}`),
    list.length === 0
      ? !ui.addingIdea && emptyState(tab.icon, `No ${tab.label.toLowerCase()} saved yet`, tab.key === "Stays"
          ? "Add the hotels you've booked or are eyeing, with dates and prices. Paste a booking link to fill in the details."
          : "Save them here with what they cost, then drop them into a day when you're ready.")
      : h("ul", { class: "items" }, list.map((idea) => h("li", null,
          ui.editingIdea === idea.id
            ? ideaForm(idea, trip, days, { onSave: saveEdit, onCancel: () => { ui.editingIdea = null; render(); }, onDelete: () => remove(idea), focus: true })
            : [ideaRow(idea, trip, days, selected?.id === idea.id),
               ui.schedulingIdea === idea.id && (tabOf(idea.group).key === "Stays"
                 ? stayPanel(idea, days, (when) => { addIdeaPlans(trip, idea, when, days); ui.schedulingIdea = null; }, () => { ui.schedulingIdea = null; })
                 : schedulePanel(idea.title, days, (date, time) => { addIdeaPlans(trip, idea, { date, time }, days); ui.schedulingIdea = null; }, () => { ui.schedulingIdea = null; }, idea.info?.date)),
               !WIDE.matches && selected?.id === idea.id && ui.selectedIdea === idea.id && h("div", { class: "info-inline" }, infoPanel(ideaAsItem(idea), trip, days))]))),
    ideas.length > 0 && h("p", { class: "small muted" }, "Saved places stay in this browser and aren't part of CSV exports. Plans you add from them are."));
}

const shortDay = (d) => (d ? formatDay(d).split(", ").slice(1).join(", ") || d : "");

/** The line of facts under a saved place's name, by kind: dates and price for hotels, price × people for activities… */
function ideaFacts(idea, trip) {
  const i = idea.info ?? {};
  const cur = i.currency || trip.currency;
  const money = (n) => formatMoney(n, cur);
  const cost = ideaCost(idea);
  const paid = cost > 0 && (i.paid ? h("span", { class: "paid strong" }, "✓ Paid") : h("span", { class: "muted" }, "Not paid yet"));
  const facts = [];
  switch (tabOf(idea.group).key) {
    case "Stays": {
      const nights = nightsBetween(i.checkIn, i.checkOut);
      if (i.checkIn || i.checkOut) facts.push(`📅 ${shortDay(i.checkIn) || "?"} → ${shortDay(i.checkOut) || "?"}${nights ? ` · ${plural(nights, "night")}` : ""}`);
      if (cost) facts.push(h("span", { class: "num" }, money(cost), nights && !i.total && i.pricePerNight ? ` (${money(i.pricePerNight)}/night)` : nights && i.total ? ` (${money(cost / nights)}/night)` : ""));
      if (i.confirmation) facts.push(`Conf. ${i.confirmation}`);
      break;
    }
    case "Activities":
      if (i.date) facts.push(`📅 ${shortDay(i.date)}`);
      if (cost) facts.push(h("span", { class: "num" }, i.pricePerPerson && !i.total && (i.people || 1) > 1 ? `${money(i.pricePerPerson)} × ${i.people} = ${money(cost)}` : money(cost)));
      if (i.duration) facts.push(`⏱ ${i.duration}`);
      break;
    case "Food":
      facts.push(...[i.cuisine, i.priceRange].filter(Boolean));
      for (const d of i.diets ?? []) facts.push(h("span", { class: "diet-tag" }, d));
      break;
    case "Sights":
      if (i.hours) facts.push(`🕘 ${i.hours}`);
      if (i.entryFee) facts.push(h("span", { class: "num" }, `Entry ${money(i.entryFee)}${(i.people || 1) > 1 ? ` × ${i.people}` : ""}`));
      break;
    default:
      if (cost) facts.push(h("span", { class: "num" }, money(cost)));
  }
  if (paid) facts.push(paid);
  return facts.length ? h("span", { class: "item-meta idea-facts" }, facts.map((f) => h("span", null, f))) : null;
}

function ideaRow(idea, trip, days, selected) {
  const plans = plansFrom(trip, idea);
  const scheduling = ui.schedulingIdea === idea.id;
  const edit = () => { Object.assign(ui, { editingIdea: idea.id, selectedIdea: idea.id, schedulingIdea: null, addingIdea: false }); render(); };
  return h("div", { class: `item-wrap idea${selected ? " selected" : ""}${plans.length ? " added" : ""}` },
    h("div", { class: "item idea-card", role: "button", tabindex: "0", "aria-pressed": String(Boolean(selected)),
      title: selected ? "Click again to edit" : "Show info about this place",
      onclick: (e) => {
        if (e.target.closest("a, button")) return; // the "on Day 2" links inside
        if (selected && ui.selectedIdea === idea.id) return edit();
        Object.assign(ui, { selectedIdea: idea.id, editingIdea: null });
        render();
      },
      onkeydown: (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); e.currentTarget.click(); } } },
      idea.details?.image && h("img", { class: "idea-thumb", src: idea.details.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (e) => e.target.remove() }),
      h("span", { class: "item-main" },
        h("span", { class: "item-title" }, idea.title),
        h("span", { class: "item-meta" },
          idea.location && h("span", null, idea.location),
          idea.notes && h("em", null, idea.notes)),
        ideaFacts(idea, trip),
        idea.details?.rating && h("span", { class: "idea-rating small" }, "★ ", String(idea.details.rating), idea.details.ratingScale ? `/${idea.details.ratingScale}` : "",
          idea.details.reviews ? h("span", { class: "muted" }, ` (${idea.details.reviews.toLocaleString("en-GB")} reviews)`) : ""),
        idea.bookingLink && siteChip(idea.bookingLink),
        plans.length > 0 && h("span", { class: "idea-plans" }, plans
          .sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || byTime(a, b))
          .map((p) => h("button", { class: "idea-plan", type: "button", title: "Show it in the itinerary", onclick: () => goToPlan(p.id) },
            "✓ ", dayLabel(p.date, days), p.time && ` · ${p.time}`))))),
    h("button", { class: `btn idea-add${scheduling ? " active" : ""}`, type: "button", "aria-expanded": String(scheduling),
      onclick: () => { Object.assign(ui, { schedulingIdea: scheduling ? null : idea.id, selectedIdea: idea.id, editingIdea: null }); render(); } },
      plans.length ? "Add again" : "Add to itinerary"),
    h("button", { class: "attach-btn", type: "button", "aria-label": `Edit ${idea.title}`, title: "Edit", onclick: edit }, pencilIcon()));
}

/** "Add <hotel> to your itinerary": check-in and check-out dates and times, from the hotel's own dates. */
function stayPanel(idea, days, onAdd, onCancel) {
  const i = idea.info ?? {};
  const checkIn = h("input", { name: "checkIn", type: "date", required: true, autofocus: true, value: i.checkIn || days[0] || "" });
  const checkOut = h("input", { name: "checkOut", type: "date", value: i.checkOut || "" });
  const nights = h("span", { class: "small muted" });
  const update = () => { const n = nightsBetween(checkIn.value, checkOut.value); nights.textContent = n ? plural(n, "night") : ""; };
  checkIn.addEventListener("input", update);
  checkOut.addEventListener("input", update);
  update();
  const form = h("form", { class: "attach-panel card schedule-panel" },
    h("p", { class: "small" }, "Add ", h("strong", null, idea.title), " to your itinerary as a check-in and a check-out. The stay's cost goes on the check-in day."),
    h("div", { class: "schedule-row" },
      field("Check-in", checkIn), field("Time", h("input", { name: "checkInTime", type: "time", value: "15:00" })),
      field("Check-out", checkOut), field("Time", h("input", { name: "checkOutTime", type: "time", value: "11:00" })),
      nights,
      h("div", { class: "actions" },
        h("button", { class: "btn primary", type: "submit" }, "Add stay"),
        h("button", { class: "btn", type: "button", onclick: () => { onCancel(); render(); } }, "Cancel"))));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    onAdd({ checkIn: String(f.get("checkIn")), checkInTime: String(f.get("checkInTime")), checkOut: String(f.get("checkOut")), checkOutTime: String(f.get("checkOutTime")) });
    render();
  });
  return form;
}

/** What /api/link-preview read from a booking page, or null when it couldn't (or we're on a plain static server). */
async function linkPreview(url, signal) {
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal });
    if (!res.ok || !/json/.test(res.headers.get("content-type") ?? "")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const looseName = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(hotel|the|by|and|&|resort|hostel)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The map place a booking page is about: same name, or the nearest result when the page gave coordinates. */
async function matchPlace(name, ccs, page, signal) {
  const results = await searchPlaces(name, ccs, signal);
  const want = looseName(name);
  const km = (p) => (page.lat && page.lon && p.lat && p.lon ? Math.hypot(p.lat - page.lat, (p.lon - page.lon) * Math.cos((p.lat * Math.PI) / 180)) * 111 : null);
  return results.find((p) => km(p) !== null && km(p) < 0.5)
    ?? results.find((p) => { const n = looseName(p.name); return n && want && (n === want || n.includes(want) || want.includes(n)) && (km(p) === null || km(p) < 5); })
    ?? null;
}

/** "Booking.com ↗" pill that opens the saved link. */
function siteChip(url) {
  const b = parseBookingLink(url);
  if (!b) return null;
  return h("a", { class: "site-chip", href: b.url, target: "_blank", rel: "noopener noreferrer", title: b.url },
    h("i", { style: b.color ? `background:${b.color}` : null }, b.site[0].toUpperCase()), b.site, " ↗");
}

/** "Add <title> to your itinerary" with a day and an optional time. `onAdd(date, time)` saves it. */
function schedulePanel(title, days, onAdd, onCancel, preferDate) {
  const fallback = [preferDate, ui.lastScheduleDate].find((d) => d && days.includes(d)) ?? days[0] ?? "";
  const daySelect = days.length
    ? h("select", { name: "date", autofocus: true },
        days.map((d, i) => h("option", { value: d, selected: d === fallback }, `Day ${i + 1} · ${formatDay(d)}`)),
        h("option", { value: "" }, "Unscheduled"))
    : h("input", { name: "date", type: "date", autofocus: true, value: preferDate || ui.lastScheduleDate || "" });
  const form = h("form", { class: "attach-panel card schedule-panel" },
    h("p", { class: "small" }, "Add ", h("strong", null, title), " to your itinerary"),
    h("div", { class: "schedule-row" },
      field("Day", daySelect),
      field("Time (optional)", h("input", { name: "time", type: "time" })),
      h("div", { class: "actions" },
        h("button", { class: "btn primary", type: "submit" }, "Add"),
        h("button", { class: "btn", type: "button", onclick: () => { onCancel(); render(); } }, "Cancel"))),
    days.length === 0 && h("p", { class: "small muted" }, "Tip: set the trip's dates in Edit trip to pick from Day 1, Day 2 and so on."));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const date = String(f.get("date") ?? "");
    const time = String(f.get("time") ?? "");
    onAdd(date, time);
    ui.lastScheduleDate = date;
    render();
  });
  return form;
}

/**
 * The fields only one kind of saved place has, and how to read them back into `idea.info`.
 * Hotels: dates, nights, price per night, total, currency, confirmation, paid.
 * Activities: date, duration, price per person, people, total, currency, hours, paid.
 * Food: cuisine, price range, dietary tags. Places: hours, entry fee. Other: cost.
 */
function kindFields(kind, info, trip) {
  const num = (name, value, attrs = {}) => h("input", { name, type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "0", value: value || "", ...attrs });
  const currencies = [...new Set([info.currency, trip.currency, ...tripCountries(trip).map((c) => currencyForCountry(c)), home.currency].filter(Boolean))];
  const currency = () => field("Currency", h("select", { name: "currency" }, currencies.map((c) => h("option", { selected: c === (info.currency || trip.currency) }, c))), "span-2");
  const paid = () => h("label", { class: "check span-2" }, h("input", { name: "paid", type: "checkbox", checked: Boolean(info.paid) }), "Paid already");
  const n = (f, k) => Number(f.get(k)) || 0;
  const str = (f, k) => String(f.get(k) ?? "").trim();
  const clean = (o) => { for (const k in o) if (o[k] === "" || o[k] === 0 || o[k] === false || o[k] == null || (Array.isArray(o[k]) && !o[k].length)) delete o[k]; return o; };

  // A total that follows price × count until it's typed over.
  const autoTotal = (priceIn, countOf, totalIn, note) => {
    let typed = Boolean(info.total);
    const sync = () => {
      const count = countOf();
      const price = Number(priceIn.value) || 0;
      if (!typed) totalIn.value = price && count ? String(Math.round(price * count * 100) / 100) : "";
      note?.(count);
    };
    totalIn.addEventListener("input", () => { typed = totalIn.value.trim() !== ""; if (!typed) sync(); });
    return sync;
  };

  if (kind === "Stays") {
    const checkIn = h("input", { name: "checkIn", type: "date", value: info.checkIn || "" });
    const checkOut = h("input", { name: "checkOut", type: "date", value: info.checkOut || "" });
    const price = num("pricePerNight", info.pricePerNight);
    const total = num("total", info.total || (info.pricePerNight && nightsBetween(info.checkIn, info.checkOut) ? info.pricePerNight * nightsBetween(info.checkIn, info.checkOut) : ""));
    const nights = h("output", { class: "nights num" });
    const sync = autoTotal(price, () => nightsBetween(checkIn.value, checkOut.value), total, (c) => { nights.textContent = c ? plural(c, "night") : "–"; });
    for (const el of [checkIn, checkOut, price]) el.addEventListener("input", sync);
    sync();
    return {
      els: [field("Check-in", checkIn, "span-2"), field("Check-out", checkOut, "span-2"), field("Nights", nights, "span-2"),
        field("Price per night", price, "span-2"), field("Total", total, "span-2"), currency(),
        field("Confirmation no.", h("input", { name: "confirmation", placeholder: "Optional", value: info.confirmation || "" }), "span-4"), paid()],
      read: (f) => clean({ checkIn: str(f, "checkIn"), checkOut: str(f, "checkOut"), pricePerNight: n(f, "pricePerNight"), total: n(f, "total"), currency: str(f, "currency"), confirmation: str(f, "confirmation"), paid: f.get("paid") === "on" }),
    };
  }
  if (kind === "Activities") {
    const price = num("pricePerPerson", info.pricePerPerson);
    const people = h("input", { name: "people", type: "number", min: 1, step: 1, value: info.people || trip.travelers || 1 });
    const total = num("total", info.total || (info.pricePerPerson ? info.pricePerPerson * (info.people || trip.travelers || 1) : ""));
    const sync = autoTotal(price, () => Number(people.value) || 1, total);
    for (const el of [price, people]) el.addEventListener("input", sync);
    sync();
    return {
      els: [field("Date (optional)", h("input", { name: "date", type: "date", value: info.date || "" }), "span-2"),
        field("Duration", h("input", { name: "duration", placeholder: "e.g. 3 hours", value: info.duration || "" }), "span-2"), currency(),
        field("Price per person", price, "span-2"), field("People", people, "span-2"), field("Total", total, "span-2"),
        field("Opening hours or meeting point", h("input", { name: "hours", placeholder: "Optional", value: info.hours || "" }), "span-4"), paid()],
      read: (f) => clean({ date: str(f, "date"), duration: str(f, "duration"), currency: str(f, "currency"), pricePerPerson: n(f, "pricePerPerson"), people: n(f, "people"), total: n(f, "total"), hours: str(f, "hours"), paid: f.get("paid") === "on" }),
    };
  }
  if (kind === "Food") {
    const diets = new Set(info.diets ?? []);
    return {
      els: [field("Cuisine", h("input", { name: "cuisine", placeholder: "e.g. Ramen, Thai, café", value: info.cuisine || "" }), "span-3"),
        field("Price range", h("select", { name: "priceRange" }, h("option", { value: "" }, "Not sure"),
          PRICE_RANGES.map(([v, label]) => h("option", { value: v, selected: v === info.priceRange }, label))), "span-3"),
        h("fieldset", { class: "span-all diet-checks" }, h("legend", null, "Dietary"),
          DIETS.map((d) => h("label", { class: "check" }, h("input", { name: "diets", type: "checkbox", value: d.label, checked: diets.has(d.label) }), d.label)))],
      read: (f) => clean({ cuisine: str(f, "cuisine"), priceRange: str(f, "priceRange"), diets: f.getAll("diets").map(String) }),
    };
  }
  if (kind === "Sights") {
    return {
      els: [field("Opening hours", h("input", { name: "hours", placeholder: "e.g. 9:00–17:00", value: info.hours || "" }), "span-2"),
        field("Entry fee per person", num("entryFee", info.entryFee), "span-2"), currency(),
        h("input", { name: "people", type: "hidden", value: info.people || trip.travelers || 1 })],
      read: (f) => clean({ hours: str(f, "hours"), entryFee: n(f, "entryFee"), currency: str(f, "currency"), people: n(f, "people") }),
    };
  }
  return {
    els: [field("Cost", num("cost", info.cost), "span-2"), currency(), paid()],
    read: (f) => clean({ cost: n(f, "cost"), currency: str(f, "currency"), paid: f.get("paid") === "on" }),
  };
}

function ideaForm(idea, trip, days, { onSave, onCancel, onDelete, focus, isNew = false }) {
  const kind = tabOf(idea.group);
  const withLinks = kind.links || Boolean(idea.bookingLink);
  const ccs = tripCountries(trip);
  const country = ccs.length === 1 ? getCountry(ccs[0]) : null;
  const titleInput = h("input", {
    name: "title", required: true, autofocus: focus || null, value: idea.title,
    placeholder: { Stays: "Hotel name", Activities: "e.g. teamLab Planets, a cooking class", Food: "Restaurant, café or stall", Sights: "e.g. a temple, a viewpoint" }[kind.key]
      ?? (ccs.length ? `A place in ${destinationText(ccs.map((c) => getCountry(c)?.name).filter(Boolean))}` : "Name"),
  });
  // The sub-tab decides the kind, so there's no type picker; pages and suggestions don't move it either.
  const groupSelect = { value: idea.group };
  const locationInput = h("input", { name: "location", placeholder: kind.key === "Stays" ? "Filled in from the link or a suggestion" : "Filled in when you pick a suggestion", value: idea.location });
  const groupTouched = true;
  const extra = kindFields(kind.key, idea.info ?? {}, trip);
  let autoLocation = null;
  let picked = null;

  // A booking link (Booking.com, Klook, Airbnb…): shows the site, then reads the page (through our
  // /api/link-preview function) for the name, address, rating and photo, and finds the place on the map.
  const linkInput = h("input", { name: "bookingLink", type: "url", inputmode: "url", placeholder: "Paste a Booking.com, Agoda, Klook or Airbnb link", value: idea.bookingLink || "" });
  const linkHint = h("span", { class: "small muted link-hint", "aria-live": "polite" });
  let autoTitle = null;
  let details = idea.details ?? null; // what the booking page says: address, rating, photo…
  let fetchedFor = idea.details ? idea.bookingLink : null;
  let linkTimer = null;
  let linkController = null;
  const hint = (...parts) => { linkHint.replaceChildren(...parts.filter(Boolean)); };
  const setTitle = (name) => { titleInput.value = autoTitle = name; };
  const titleIsOurs = () => !titleInput.value.trim() || titleInput.value === autoTitle;

  const applyPage = async (b, r, signal) => {
    const name = r.name;
    if (name && titleIsOurs()) setTitle(name);
    const where = r.address || r.area;
    if (where && (!locationInput.value.trim() || locationInput.value === autoLocation)) locationInput.value = autoLocation = where;
    const g = r.group || b.group;
    if (g && !groupTouched) groupSelect.value = g;
    details = { address: r.address, area: r.area, rating: r.rating, ratingScale: r.ratingScale, reviews: r.reviews, stars: r.stars, image: r.image, price: r.price };
    for (const k in details) if (details[k] === null || details[k] === undefined) delete details[k];
    const got = [name && "name", where && "address", r.rating && "rating", r.image && "photo"].filter(Boolean);
    const swap = name && titleInput.value.trim() && titleInput.value !== name
      ? h("button", { class: "linkish", type: "button", onclick: () => { setTitle(name); readLink(); } }, `Use "${name}"`) : null;
    hint(siteChip(b.url), got.length ? ` Filled in from the page: ${got.join(", ")}.` : " The page didn't say much, so check the details.", swap && " ", swap);
    // Find it on the map too, so the info panel and Maps link point at the right place.
    if (!name) return;
    const found = await matchPlace(name, ccs, r, signal).catch(() => null);
    if (signal.aborted) return;
    picked = found
      ? { link: mapsLink(found), place: found.osm ? { osm: found.osm, lat: found.lat, lon: found.lon, kind: found.kind, area: found.area, ...(found.countryCode ? { cc: found.countryCode } : {}) } : undefined }
      : { link: mapsLink({ name, area: r.address || r.area }), place: undefined };
    if (activeInfo?.isConnected) fillInfo(activeInfo, { ...ideaAsItem(idea), title: titleInput.value, group: groupSelect.value, place: picked.place }, trip, days);
  };

  const readLink = (fetchPage = true) => {
    const b = parseBookingLink(linkInput.value);
    if (!linkInput.value.trim()) { hint(); details = null; fetchedFor = null; return; }
    if (!b) { hint("That doesn't look like a web link."); return; }
    if (b.group && !groupTouched) groupSelect.value = b.group;
    if (!fetchPage || b.url === fetchedFor) {
      if (!fetchPage) return;
      return hint(siteChip(b.url));
    }
    // Straight away: a guess from the link itself. Then the page, which knows better.
    if (b.name && titleIsOurs()) setTitle(b.name);
    hint(siteChip(b.url), " Reading the page…");
    clearTimeout(linkTimer);
    linkController?.abort();
    const controller = linkController = new AbortController();
    linkTimer = setTimeout(async () => {
      const r = await linkPreview(b.url, controller.signal);
      if (controller.signal.aborted) return;
      fetchedFor = b.url;
      if (r?.ok) return applyPage(b, r, controller.signal);
      // Followed a share link? Its real address may name the place.
      const real = r?.url ? parseBookingLink(r.url) : null;
      if (real?.name && titleIsOurs()) setTitle(real.name);
      const guess = titleInput.value.trim();
      if (!guess) return hint(siteChip(b.url), ` ${b.site} doesn't let apps read its pages, and this link doesn't include the name. Type it above and pick it from the suggestions.`);
      // Use the name from the link to find the place on the map, for its area and Maps link.
      hint(siteChip(b.url), ` ${b.site} doesn't let apps read its pages, so we're finding "${guess}" on the map…`);
      const found = await matchPlace(guess, ccs, {}, controller.signal).catch(() => null);
      if (controller.signal.aborted) return;
      if (!found) return hint(siteChip(b.url), ` ${b.site} doesn't let apps read its pages, so the name is a guess from the link. Pick it from the suggestions to fill in the rest.`);
      if (titleIsOurs()) setTitle(found.name);
      const area = [found.area, !country && found.country].filter(Boolean).join(", ");
      if (area && (!locationInput.value.trim() || locationInput.value === autoLocation)) locationInput.value = autoLocation = area;
      const g = groupForPlace(found);
      if (g && !groupTouched) groupSelect.value = g;
      picked = { link: mapsLink(found), place: found.osm ? { osm: found.osm, lat: found.lat, lon: found.lon, kind: found.kind, area: found.area, ...(found.countryCode ? { cc: found.countryCode } : {}) } : undefined };
      if (activeInfo?.isConnected) fillInfo(activeInfo, { ...ideaAsItem(idea), title: titleInput.value, group: groupSelect.value, place: picked.place }, trip, days);
      hint(siteChip(b.url), ` Found on the map from the name in the link (${b.site} doesn't let apps read its pages). Check it's the right place.`);
    }, 300);
  };
  linkInput.addEventListener("input", () => readLink());
  // An older saved place with a link but no details: read its page when it's opened for editing.
  if (!isNew && idea.bookingLink && !idea.details) queueMicrotask(() => readLink());

  const placeBox = autocomplete(titleInput, {
    delay: 350,
    search: (q, signal) => searchPlaces(q, ccs, signal),
    renderItem: (p) => [
      h("span", { class: "ac-icon", "aria-hidden": "true" }, "📍"),
      h("span", { class: "ac-main" },
        h("span", { class: "ac-title" }, p.name),
        h("span", { class: "ac-sub small muted" }, [p.area, !country && p.country].filter(Boolean).join(", "))),
      p.kind && h("span", { class: "ac-tag" }, p.kind),
    ].filter(Boolean),
    footer: () => h("span", { class: "small muted" }, "Places from © OpenStreetMap contributors"),
    onPick: (p) => {
      titleInput.value = p.name;
      if (!locationInput.value.trim() || locationInput.value === autoLocation) {
        locationInput.value = autoLocation = [p.area, !country && p.country].filter(Boolean).join(", ");
      }
      const g = groupForPlace(p);
      if (g && !groupTouched) groupSelect.value = g;
      picked = { link: mapsLink(p), place: p.osm ? { osm: p.osm, lat: p.lat, lon: p.lon, kind: p.kind, area: p.area, ...(p.countryCode ? { cc: p.countryCode } : {}) } : undefined };
      if (activeInfo?.isConnected) fillInfo(activeInfo, { ...ideaAsItem(idea), title: p.name, group: groupSelect.value, place: picked.place }, trip, days);
    },
  });

  // Pasting a link straight into the Place box works too.
  titleInput.addEventListener("input", () => {
    if (!parseBookingLink(titleInput.value)) return;
    if (!withLinks) return;
    linkInput.value = titleInput.value.trim();
    titleInput.value = "";
    setMode("link");
    placeBox.close();
    readLink();
    if (!titleInput.value) titleInput.focus();
  });
  // New places: two clear ways in. Paste a booking link (details get filled in), or type it yourself.
  const toggle = isNew && kind.links;
  const linkField = withLinks && h("label", { class: "field span-all link-field" },
    h("span", null, toggle ? "Booking link" : "Booking link (optional)"), linkInput, linkHint,
    toggle && h("span", { class: "small muted" }, "Booking.com, Agoda, Klook, Airbnb, Trip.com and more. We fill in what we can, and you can edit it below."));
  const modeBtn = (m, icon, label) => h("button", { type: "button", role: "tab", class: `mode-btn mode-${m}`, onclick: () => setMode(m, true) }, h("span", { "aria-hidden": "true" }, icon), label);
  const modes = toggle && h("div", { class: "idea-modes span-all", role: "tablist", "aria-label": "How to add it" },
    modeBtn("link", "🔗", "Paste a booking link"), modeBtn("manual", "✏️", "Fill in manually"));
  const form = h("form", { class: `form-grid six${isNew ? "" : " card pad editing"}` },
    modes,
    linkField,
    toggle && h("p", { class: "span-all small muted details-label" }, "Details"),
    field(kind.key === "Stays" ? "Hotel" : "Name", placeBox.el, "span-3"),
    field(kind.key === "Stays" ? "Address" : "Where", locationInput, "span-3"),
    ...extra.els,
    foldable([{ label: "Note", open: Boolean(idea.notes?.trim()),
      el: field("Note", h("input", { name: "notes", placeholder: kind.key === "Food" ? "Optional, e.g. try the tonkotsu" : "Optional", value: idea.notes }), "span-all") }]),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, isNew ? "Save place" : "Save"),
      onCancel && h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"),
      onDelete && h("button", { class: "btn danger push", type: "button", onclick: onDelete }, "Delete")));
  function setMode(m, user) {
    if (!toggle) return;
    ui.ideaMode = m;
    form.dataset.mode = m;
    for (const b of modes.querySelectorAll(".mode-btn")) b.setAttribute("aria-selected", String(b.classList.contains(`mode-${m}`)));
    if (user) (m === "link" ? linkInput : titleInput).focus();
  }
  if (toggle) {
    setMode(ui.ideaMode || "link");
    if (form.dataset.mode === "link" && focus) { titleInput.removeAttribute("autofocus"); linkInput.setAttribute("autofocus", ""); }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const title = String(f.get("title")).trim();
    if (!title) return;
    const same = title === idea.title;
    onSave({
      ...idea,
      title,
      group: idea.group,
      info: extra.read(f),
      location: String(f.get("location")).trim(),
      notes: String(f.get("notes")).trim(),
      bookingLink: withLinks ? parseBookingLink(String(f.get("bookingLink") ?? ""))?.url ?? "" : idea.bookingLink ?? "",
      details: parseBookingLink(String(f.get("bookingLink") ?? "")) ? details ?? undefined : undefined,
      // A renamed place without a new pick loses the old map link and place match.
      link: picked?.link ?? (same ? idea.link : ""),
      place: picked ? picked.place : same ? idea.place : undefined,
    });
  });
  return form;
}

/* ----- discover: find places near an area, from OpenStreetMap ----- */

const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const PAGE = 20;
let discoverController = null;

function discoverState(trip, days = daysBetween(trip.startDate, trip.endDate)) {
  if (ui.discover?.tripId !== trip.id) {
    ui.discover = {
      tripId: trip.id, type: "food", diet: "", radius: 1000, sort: "near", keyword: "", areaText: "", area: null, near: null,
      status: "idle", results: null, resultType: null, error: null, cached: false, shown: PAGE, selected: null, scheduling: null,
      country: tripCountries(trip)[0] ?? "", // the country being searched: the day's, or the picked area's
    };
    // Start from where you are today (during the trip), or the first day that has a place.
    const today = new Date().toISOString().slice(0, 10);
    const stops = dayStops(trip, days);
    const stop = stops.find((s) => s.dates.includes(today)) ?? stops.find((s) => s.dates.length) ?? stops[0];
    if (stop) useStop(ui.discover, stop);
  }
  return ui.discover;
}

/**
 * The places your days are based in, merged when days in a row share one:
 * [{ label: "Day 1–3", text: "Shinjuku", full: "Tokyo › Shinjuku", point, city, dates }]. Cities with no days yet come last.
 */
function dayStops(trip, days) {
  const stops = [];
  days.forEach((date, i) => {
    const b = dayBase(trip, date, days);
    if (!b) return;
    const full = baseLabel(b);
    const last = stops[stops.length - 1];
    if (last && last.full === full && last.end === i - 1) { last.end = i; last.dates.push(date); return; }
    stops.push({ full, text: b.area || b.city, city: b.city, country: cityCountry(trip, b.city), point: basePoint(trip, b), exact: !b.area || Number.isFinite(b.lat), start: i, end: i, dates: [date] });
  });
  for (const s of stops) s.label = s.start === s.end ? `Day ${s.start + 1}` : `Day ${s.start + 1}–${s.end + 1}`;
  for (const c of tripCities(trip)) {
    if (!stops.some((s) => sameName(s.city, c.name) && sameName(s.text, c.name))) {
      stops.push({ label: "", full: c.name, text: c.name, city: c.name, country: cityCountry(trip, c.name), point: basePoint(trip, { city: c.name }), exact: true, dates: [] });
    }
  }
  return stops;
}

/**
 * "Your days" shortcuts: one row per country (in the order you get there), days first in
 * day order, then the trip's other cities in that country. One-country trips get one row.
 */
function stopRows(stops, ccs, d, onPick) {
  if (!stops.length) return null;
  const firstDay = (code) => Math.min(...stops.filter((s) => s.country === code && s.dates.length).map((s) => s.start));
  const order = [...new Set([...ccs, ...stops.map((s) => s.country)])].filter(Boolean)
    .sort((a, b) => (firstDay(a) - firstDay(b)) || ccs.indexOf(a) - ccs.indexOf(b));
  const groups = ccs.length > 1 ? order.map((code) => ({ code, stops: stops.filter((s) => s.country === code) })).filter((g) => g.stops.length) : [{ code: "", stops }];
  const chip = (st) => h("button", { class: `chip small${d.stop === st.full && d.areaText === st.text ? " active" : ""}${st.dates.length ? "" : " plain"}`, type: "button",
    title: st.dates.length ? `Search around ${st.full}, and add finds to ${st.label} by default` : `Search around ${st.full}`,
    onclick: () => onPick(st) },
    st.label && h("span", { class: "muted" }, `${st.label} · `), st.full);
  return h("div", { class: "disc-days" },
    h("span", { class: "small muted disc-days-title" }, "Your days"),
    groups.map((g) => {
      const c = getCountry(g.code);
      return h("div", { class: "disc-days-row" },
        c && h("span", { class: "disc-days-country small" }, FLAGS_OK ? `${flag(c.code)} ` : "", c.name),
        h("div", { class: "disc-days-chips" },
          g.stops.filter((s) => s.dates.length).map(chip),
          g.stops.filter((s) => !s.dates.length).map(chip)));
    }));
}

function useStop(d, stop) {
  d.areaText = stop.text;
  d.near = stop.point; // if the area still needs looking up, look around its city
  d.area = stop.point && stop.exact ? { text: stop.text, name: stop.text, label: stop.text === stop.city ? stop.city : `${stop.text}, ${stop.city}`, lat: stop.point.lat, lon: stop.point.lon } : null;
  d.stop = stop.full;
  d.city = stop.city ? { name: stop.city, point: basePoint(trip, { city: stop.city }) ?? stop.point } : null;
  if (stop.country) d.country = stop.country;
  if (stop.dates.length) ui.lastScheduleDate = stop.dates[0];
}

const areaFrom = (p, text) => ({ text, name: p.name, label: [p.name, p.area].filter(Boolean).join(", "), lat: p.lat, lon: p.lon, cc: p.countryCode });

function selectedResult(trip) {
  const d = discoverState(trip);
  return d.results?.find((r) => r.osm === d.selected) ?? null;
}

const resultLink = (r, d, trip) => mapsLink({ name: r.name, area: d.area?.name, country: getCountry(d.country || tripCountries(trip)[0])?.name });
const resultPlace = (r, d) => ({ name: r.name, osm: r.osm, lat: r.lat, lon: r.lon, kind: r.kind.toLowerCase(), area: d.area?.label ?? "", ...(d.country ? { cc: d.country } : {}) });

// The info panel works on plans, so give it a search result in that shape.
function discoverAsItem(r, trip) {
  if (!r) return null;
  const d = discoverState(trip);
  const t = discoverType(d.resultType);
  return {
    id: `disc:${r.osm}`, title: r.name, location: d.area?.label ?? "", link: resultLink(r, d, trip), place: resultPlace(r, d),
    category: t.category, date: "", time: "", cc: d.country,
    nearby: `${formatDistance(r.distance)} from ${d.area?.name ?? "the search spot"}`,
  };
}

async function runDiscover(trip) {
  const d = discoverState(trip);
  discoverController?.abort();
  const controller = (discoverController = new AbortController());
  Object.assign(d, { status: "loading", error: null, results: null, shown: PAGE, selected: null, scheduling: null });
  render();
  try {
    if (!d.area || d.area.text !== d.areaText) {
      // The day's country first; on a multi-country trip, then the others.
      const ccs = tripCountries(trip);
      let found = (await searchPlaces(d.areaText, d.country || ccs[0], controller.signal, { near: d.near }))[0];
      if (!found && ccs.length > 1) found = (await searchPlaces(d.areaText, ccs, controller.signal))[0];
      if (!found) {
        const where = destinationText(ccs.map((c) => getCountry(c)?.name).filter(Boolean));
        throw Object.assign(new Error("no area"), {
          userText: `Couldn't find "${d.areaText}"${where ? ` in ${where}` : ""}. Try a neighbourhood, station or landmark.`,
        });
      }
      d.area = areaFrom(found, d.areaText);
      if (found.countryCode) d.country = found.countryCode;
    }
    const diet = hasDiets(d.type) ? d.diet : "";
    const params = { type: d.type, lat: d.area.lat, lon: d.area.lon, radius: d.radius, keyword: d.keyword, diet };
    const meta = { resultType: d.type, resultDiet: diet };
    const saved = cachedPlaces(params);
    if (saved) {
      Object.assign(d, { status: "done", results: saved, basic: false, upgrading: false }, meta);
    } else {
      // Ask for both at once: the quick list shows as soon as it's back, and the detailed one replaces it.
      const detailed = detailedPlaces(params, controller.signal);
      detailed.catch(() => {}); // handled below
      const quick = quickPlaces(params, controller.signal).then((results) => {
        if (controller !== discoverController || d.status === "done") return;
        Object.assign(d, { status: "done", results, basic: true, upgrading: true }, meta);
        if (ui.tab === "discover" && currentTripId() === trip.id) render();
      }, () => {});
      try {
        const results = await detailed;
        if (controller !== discoverController) return;
        Object.assign(d, { status: "done", results, basic: false, upgrading: false }, meta);
        if (d.selected && !results.some((r) => r.osm === d.selected)) d.selected = null;
        if (d.scheduling && !results.some((r) => r.osm === d.scheduling)) d.scheduling = null;
      } catch (e) {
        if (controller.signal.aborted) return;
        await quick;
        if (controller !== discoverController) return;
        if (d.status !== "done") throw e;
        d.upgrading = false; // keep the quick list
      }
    }
  } catch (e) {
    if (controller.signal.aborted) return;
    Object.assign(d, { status: "error", error: e.userText ?? "Couldn't reach the free OpenStreetMap search just now. It may be busy, so try again in a minute." });
  }
  if (ui.tab === "discover" && currentTripId() === trip.id) render();
}

function discoverView(trip, days) {
  const d = discoverState(trip);
  const ccs = tripCountries(trip);
  const where = destinationText(ccs.map((c) => getCountry(c)?.name).filter(Boolean));
  const type = discoverType(d.type);

  const areaInput = h("input", {
    name: "area", required: true, value: d.areaText, autofocus: !d.areaText || null,
    placeholder: where ? `A neighbourhood, station or landmark in ${where}` : "A neighbourhood, station or landmark",
  });
  const areaBox = autocomplete(areaInput, {
    delay: 350,
    search: (q, signal) => searchPlaces(q, ccs, signal, { near: d.near }),
    renderItem: ccs.length > 1 ? (p) => [...settlementRow(p), FLAGS_OK && p.countryCode && h("span", { class: "ac-tag" }, flag(p.countryCode))].filter(Boolean) : settlementRow,
    footer: osmFooter,
    onPick: (p) => { areaInput.value = p.name; d.areaText = p.name; d.area = areaFrom(p, p.name); d.stop = null; d.city = null; if (p.countryCode) d.country = p.countryCode; },
  });
  const keywordInput = h("input", { name: "keyword", value: d.keyword, placeholder: type.placeholder, maxlength: 40 });
  const radiusSelect = h("select", { name: "radius" }, RADII.map((r) => h("option", { value: r, selected: r === d.radius }, formatDistance(r))));

  // Read the boxes into the state before anything re-renders them.
  const sync = () => {
    d.areaText = areaInput.value.trim();
    d.keyword = keywordInput.value.trim();
    d.radius = Number(radiusSelect.value) || 1000;
  };
  const search = () => { sync(); if (d.areaText) runDiscover(trip); else areaInput.focus(); };

  const typeChips = h("div", { class: "disc-types", role: "group", "aria-label": "What to look for" }, DISCOVER_TYPES.map((t) =>
    h("button", { type: "button", class: `chip${t.key === d.type ? " active" : ""}`, "aria-pressed": String(t.key === d.type),
      onclick: () => {
        sync();
        if (t.key !== d.type) d.keyword = "";
        d.type = t.key;
        if (d.areaText && d.status !== "idle") runDiscover(trip); else render();
      } },
    h("span", { "aria-hidden": "true" }, t.icon), " ", t.label)));

  // Food and cafés: halal, vegetarian and so on.
  const dietChips = hasDiets(d.type) && h("div", { class: "disc-diets", role: "group", "aria-label": "Dietary needs" },
    h("span", { class: "small muted" }, "Dietary:"),
    [{ key: "", label: "Any" }, ...DIETS].map((dt) =>
      h("button", { type: "button", class: `chip small${d.diet === dt.key ? " active" : ""}`, "aria-pressed": String(d.diet === dt.key),
        onclick: () => {
          sync();
          d.diet = dt.key;
          if (d.areaText && d.status !== "idle") runDiscover(trip); else render();
        } }, dt.label)));

  const stops = dayStops(trip, days);
  // Already know where you'll be? Show what's around there straight away.
  if (d.status === "idle" && d.areaText && !d.autoRan) { d.autoRan = true; queueMicrotask(() => runDiscover(trip)); }
  const form = h("form", { class: "card pad stack disc-form" },
    h("div", null,
      h("h2", null, "Discover"),
      h("p", { class: "small muted" }, "Find places to eat, see and shop near anywhere on your trip. Save the ones you like, or add them straight to a day.")),
    typeChips,
    dietChips,
    h("div", { class: "form-grid six" },
      field("Near", areaBox.el, "span-3"),
      field("Looking for (optional)", keywordInput, "span-2"),
      field("Within", radiusSelect, "span-1")),
    h("div", { class: "actions" },
      h("button", { class: "btn primary", type: "submit", disabled: d.status === "loading" }, d.status === "loading" ? "Searching…" : "Search")),
    stopRows(stops, ccs, d, (st) => { useStop(d, st); areaInput.value = st.text; search(); }),
    stops.every((st) => !st.dates.length) && days.length > 0 && h("p", { class: "small muted" },
      "Tip: pick where you'll be each day on the Itinerary (the 📍 next to each day) and Discover will start there."));
  form.addEventListener("submit", (e) => { e.preventDefault(); search(); });

  return h("div", { class: "stack disc" }, form, discoverResults(trip, days, d));
}

function discoverResults(trip, days, d) {
  if (d.status === "idle") {
    return emptyState("🧭", "Let's go exploring", "Pick what you're after, type an area like a neighbourhood or station, and press Search.");
  }
  if (d.status === "loading") {
    return h("div", { class: "stack", "aria-busy": "true" },
      h("p", { class: "small muted info-loading" }, `Looking for ${discoverType(d.type).label.toLowerCase()} near ${d.area?.text === d.areaText ? d.area.name : d.areaText}…`),
      h("ul", { class: "items", "aria-hidden": "true" }, [0, 1, 2, 3].map(() => h("li", { class: "disc-skel" },
        h("span", { class: "skel w60" }), h("span", { class: "skel w40" })))));
  }
  if (d.status === "error") {
    return h("div", { class: "card pad center" }, h("p", { class: "muted" }, d.error),
      h("button", { class: "btn", type: "button", onclick: () => runDiscover(trip) }, "Try again"));
  }
  const type = discoverType(d.resultType);
  const diet = getDiet(d.resultDiet);
  const list = sortResults(d.results, d.sort);
  const credit = h("p", { class: "small muted disc-credit" },
    "Places © ", h("a", { href: OSM_COPYRIGHT, target: "_blank", rel: "noopener" }, "OpenStreetMap contributors"),
    ". OpenStreetMap has no ratings or reviews, so we don't show any. Use the Reviews link to read them on Google Maps.");
  if (!list.length) {
    return h("div", { class: "stack" },
      h("p", { class: "card pad center muted" }, `No ${diet ? `${diet.label.toLowerCase()} ` : ""}${type.label.toLowerCase()} ${d.keyword ? `matching "${d.keyword}" ` : ""}found within ${formatDistance(d.radius)} of ${d.area.label}.`,
        d.radius < 2000 ? " Try a bigger distance" : " Try another area", d.keyword ? " or clear the keyword." : ".",
        diet ? ` Many places don't say in OpenStreetMap whether they're ${diet.label.toLowerCase()}, so try searching "${diet.label.toLowerCase()}" on Google Maps too.` : ""),
      credit);
  }
  const selected = selectedResult(trip);
  const sortSelect = h("select", { "aria-label": "Sort by", onchange: (e) => { d.sort = e.target.value; d.shown = PAGE; render(); } },
    h("option", { value: "near", selected: d.sort === "near" }, "Nearest first"),
    h("option", { value: "info", selected: d.sort === "info" }, "Most details first"));
  return h("div", { class: "stack" },
    h("div", { class: "disc-head" },
      h("p", { class: "small muted" }, `${plural(list.length, "place")} within ${formatDistance(d.radius)} of `, h("strong", null, d.area.label)),
      sortSelect),
    d.basic && d.upgrading && h("p", { class: "hint small info-loading" }, "Quick list first. Loading cuisines, opening hours and more…"),
    d.basic && !d.upgrading && h("p", { class: "hint small" }, "The detailed OpenStreetMap search is busy right now, so this is a simpler list without cuisines or opening hours",
      diet ? `, with only places that have "${diet.label.toLowerCase()}" in their name, so it's likely missing some` : d.keyword ? `, matching "${d.keyword}" by name only` : "", ". Pick a place to see its details, or ",
      h("button", { class: "linkish", type: "button", onclick: () => runDiscover(trip) }, "search again"), " in a minute."),
    diet && !d.basic && h("p", { class: "hint small" },
      `These are places OpenStreetMap lists as ${diet.label.toLowerCase()} or with ${diet.label.toLowerCase()} options, or with it in their name. Many places don't say, so the list is likely incomplete${list.length < 5 && d.radius < 2000 ? ". Try a bigger distance for more" : ""}. Always check with the place before you go.`),
    h("ul", { class: "items" }, list.slice(0, d.shown).map((r) => h("li", null,
      discoverRow(r, trip, days, d, type, selected?.osm === r.osm),
      d.scheduling === r.osm && schedulePanel(r.name, days, (date, time) => {
        const current = loadTrips().find((t) => t.id === trip.id);
        if (!current) return;
        const item = { ...emptyItem(date), time, title: r.name, location: d.area.label, category: type.category, link: resultLink(r, d, trip), place: resultPlace(r, d), notes: dietNote(r) };
        saveTrip({ ...current, items: [...current.items, withCurrency(item, planCurrency(current, d.country), current)] });
        d.scheduling = null;
      }, () => { d.scheduling = null; }),
      !WIDE.matches && selected?.osm === r.osm && h("div", { class: "info-inline" }, infoPanel(discoverAsItem(r, trip), trip, days))))),
    list.length > d.shown && h("button", { class: "btn", type: "button", onclick: () => { d.shown += PAGE; render(); } },
      `Show ${Math.min(PAGE, list.length - d.shown)} more`),
    credit);
}

const dietNote = (r) => (r.diets ?? []).map((x) => x.label).join(", ");

function discoverRow(r, trip, days, d, type, selected) {
  const saved = (trip.ideas ?? []).find((i) => i.place?.osm === r.osm);
  const plans = trip.items.filter((i) => i.place?.osm === r.osm);
  const scheduling = d.scheduling === r.osm;
  const hours = prettyHours(r.hours);
  const save = () => {
    if (saved) return;
    updateIdeas(trip.id, (list) => [...list, {
      ...emptyIdea(type.group), title: r.name, location: d.area.label, link: resultLink(r, d, trip), place: resultPlace(r, d), notes: dietNote(r),
    }]);
    render();
  };
  return h("div", { class: `item-wrap idea disc-row${selected ? " selected" : ""}` },
    h("div", { class: "item idea-card", role: "button", tabindex: "0", "aria-pressed": String(Boolean(selected)), title: "Show info about this place",
      onclick: (e) => {
        if (e.target.closest("a, button")) return;
        d.selected = selected ? null : r.osm;
        d.popSel = null;
        render();
      },
      onkeydown: (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); e.currentTarget.click(); } } },
      h("span", { class: "item-main" },
        h("span", { class: "item-title" }, r.name),
        h("span", { class: "item-meta" },
          h("span", null, [r.cuisine || r.kind, r.cuisine && r.kind !== "Restaurant" ? r.kind : ""].filter(Boolean).join(" · ")),
          r.localName && h("span", null, r.localName),
          (r.diets ?? []).map((x) => h("span", { class: "diet-badge" }, x.label)),
          hours.length > 0 && h("span", { title: hours.join("\n") }, `🕒 ${hours[0]}${hours.length > 1 ? " …" : ""}`)),
        h("span", { class: "item-meta disc-links" },
          h("a", { href: resultLink(r, d, trip), target: "_blank", rel: "noopener noreferrer" }, "Reviews and map ↗"),
          r.website && h("a", { href: r.website, target: "_blank", rel: "noopener noreferrer" }, "Website ↗")),
        plans.length > 0 && h("span", { class: "idea-plans" }, plans.map((p) =>
          h("button", { class: "idea-plan", type: "button", title: "Show it in the itinerary", onclick: () => goToPlan(p.id) },
            "✓ ", dayLabel(p.date, days), p.time && ` · ${p.time}`)))),
      h("span", { class: "item-cost num muted" }, formatDistance(r.distance))),
    h("button", { class: `btn disc-save${saved ? " done" : ""}`, type: "button", disabled: Boolean(saved),
      title: saved ? "It's in Saved places" : "Keep it in Saved places for later", onclick: save }, saved ? "✓ Saved" : "Save"),
    h("button", { class: `btn idea-add${scheduling ? " active" : ""}`, type: "button", "aria-expanded": String(scheduling),
      onclick: () => { d.scheduling = scheduling ? null : r.osm; d.selected = r.osm; render(); } },
      plans.length ? "Add again" : "Add to itinerary"));
}

/* ----- "Popular" column on Discover: famous sights and things to do around the city (Wikidata) ----- */

const popularCache = new Map(); // "35.68,139.77" -> promise of { todo, see }

/** Where the Popular column looks: the day's city, else the searched area. */
function popularCenter(d) {
  if (d.city?.point) return { name: d.city.name, lat: d.city.point.lat, lon: d.city.point.lon };
  if (d.area && Number.isFinite(d.area.lat)) return { name: d.area.name, lat: d.area.lat, lon: d.area.lon };
  return null;
}

function getPopular(c) {
  const key = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
  if (!popularCache.has(key)) {
    const p = fetch(`/api/popular?lat=${c.lat.toFixed(2)}&lon=${c.lon.toFixed(2)}&v=2`, { signal: AbortSignal.timeout(25000) })
      .then((r) => r.json())
      .then((data) => { if (!data?.ok) throw new Error(data?.error ?? "failed"); return data; });
    p.catch(() => popularCache.delete(key)); // try again next time
    popularCache.set(key, track(p));
  }
  return popularCache.get(key);
}

const popularGroup = (kind) => (kind === "do" ? "Activities" : "Sights");

function popularAsItem(p, kind, trip, d) {
  const c = popularCenter(d);
  return {
    id: `pop:${p.id}`, title: p.name, location: c?.name ?? "", group: popularGroup(kind), category: "Activities", date: "", time: "",
    link: mapsLink({ name: p.name, area: c?.name, country: getCountry(d.country || tripCountries(trip)[0])?.name }),
    place: { lat: p.lat, lon: p.lon, kind: p.desc, area: c?.name ?? "", ...(d.country ? { cc: d.country } : {}) },
    cc: d.country, nearby: `Popular ${d.city?.point ? "in" : "around"} ${c?.name ?? "this area"}`,
  };
}

/** The popular place picked for the info panel, as a plan-shaped item, or null. */
function selectedPopularItem(trip) {
  const d = discoverState(trip);
  if (!d.popSel) return null;
  const c = popularCenter(d);
  const data = c && settled.get(getPopular(c))?.value;
  for (const kind of ["do", "see"]) {
    const p = data?.[kind === "do" ? "todo" : "see"]?.find((x) => x.id === d.popSel);
    if (p) return popularAsItem(p, kind, trip, d);
  }
  return null;
}

function popularPanel(trip, days) {
  const d = discoverState(trip);
  const c = popularCenter(d);
  const box = h("div", { class: "card summary popular" });
  if (!c) {
    box.append(h("div", { class: "summary-body" }, h("h2", null, "Popular"),
      h("p", { class: "small muted" }, "Search an area, or pick one of your days, to see the best-known sights and things to do there.")));
    return box;
  }
  const p = getPopular(c);
  const draw = () => {
    if (!box.isConnected && box.dataset.drawn) return;
    box.dataset.drawn = "1";
    const st = settled.get(p);
    box.replaceChildren(h("div", { class: "summary-body" },
      h("h2", null, d.city?.point ? `Popular in ${c.name}` : `Popular around ${c.name}`),
      !st && h("ul", { class: "pop-list", "aria-busy": "true" }, [0, 1, 2, 3, 4].map(() => h("li", { class: "pop-skel" }, h("span", { class: "skel pop-thumb" }), h("span", { class: "skel w60" })))),
      st?.error && h("p", { class: "small muted" }, "Couldn't load popular places right now. ",
        h("button", { class: "linkish", type: "button", onclick: () => render() }, "Try again")),
      st?.value && [
        popularSection("Top things to do", "do", st.value.todo, trip, days, d),
        popularSection("Must-see places", "see", st.value.see, trip, days, d),
        !st.value.todo.length && !st.value.see.length && h("p", { class: "small muted" }, `We couldn't find well-known places around ${c.name}.`),
        h("p", { class: "small muted" }, "Ranked by how many Wikipedia languages write about each place, from ",
          h("a", { href: "https://www.wikidata.org/", target: "_blank", rel: "noopener" }, "Wikidata"), "."),
      ]));
  };
  draw();
  if (!settled.has(p)) p.then(draw, draw);
  return box;
}

function popularSection(title, kind, list, trip, days, d) {
  if (!list?.length) return null;
  return h("section", { class: "summary-sec" },
    h("h3", null, title),
    h("ul", { class: "pop-list" }, list.map((p) => {
      const item = popularAsItem(p, kind, trip, d);
      const saved = (trip.ideas ?? []).some((i) => sameName(i.title, p.name));
      const plans = trip.items.filter((i) => sameName(i.title, p.name));
      const selected = d.popSel === p.id;
      const scheduling = d.popSched === p.id;
      return h("li", { class: selected ? "selected" : "" },
        h("button", { class: "pop-main", type: "button", "aria-pressed": String(selected), title: "Show info about this place",
          onclick: () => { d.popSel = selected ? null : p.id; d.selected = null; render(); } },
          p.image ? h("img", { class: "pop-thumb", src: p.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : h("span", { class: "pop-thumb", "aria-hidden": "true" }, kind === "do" ? "🎢" : "📍"),
          h("span", { class: "pop-text" }, h("strong", null, p.name), h("span", { class: "small muted" }, p.desc))),
        h("span", { class: "pop-actions" },
          h("button", { class: `btn small disc-save${saved ? " done" : ""}`, type: "button", disabled: saved, onclick: () => {
            updateIdeas(trip.id, (l) => [...l, { ...emptyIdea(item.group), title: p.name, location: item.location, link: item.link, place: item.place }]);
            render();
          } }, saved ? "✓ Saved" : "Save"),
          h("button", { class: `btn small${scheduling ? " active" : ""}`, type: "button", "aria-expanded": String(scheduling),
            onclick: () => { d.popSched = scheduling ? null : p.id; render(); } }, plans.length ? "Add again" : "Add to a day"),
          plans.length > 0 && h("button", { class: "idea-plan", type: "button", title: "Show it in the itinerary", onclick: () => goToPlan(plans[0].id) }, "✓ ", dayLabel(plans[0].date, days))),
        scheduling && schedulePanel(p.name, days, (date, time) => {
          const current = loadTrips().find((t) => t.id === trip.id);
          if (!current) return;
          const plan = { ...emptyItem(date), time, title: p.name, location: item.location, category: "Activities", link: item.link, place: item.place };
          saveTrip({ ...current, items: [...current.items, withCurrency(plan, planCurrency(current, d.country), current)] });
          d.popSched = null;
        }, () => { d.popSched = null; }),
        !WIDE.matches && selected && h("div", { class: "info-inline" }, infoPanel(item, trip, days)));
    })));
}

/* ----- attachments ----- */

let fileUrls = [];
function revokeFileUrls() {
  for (const u of fileUrls) URL.revokeObjectURL(u);
  fileUrls = [];
}

// Re-reads the trip before writing so a slow upload never overwrites newer edits.
function updateAttachments(tripId, itemId, fn) {
  const trip = loadTrips().find((t) => t.id === tripId);
  if (!trip) return;
  const upd = (i) => (i.id === itemId ? { ...i, attachments: fn(i.attachments ?? []) } : i);
  saveTrip({ ...trip, items: trip.items.map(upd), ...(trip.bookings ? { bookings: trip.bookings.map(upd) } : {}) });
}

async function addAttachments(trip, item, fileList) {
  const files = [...fileList];
  const rejected = files.filter((f) => !isAllowedType(f));
  const tooBig = files.filter((f) => isAllowedType(f) && f.size > MAX_FILE_BYTES);
  const ok = files.filter((f) => isAllowedType(f) && f.size <= MAX_FILE_BYTES);
  const problems = [];
  if (rejected.length) problems.push(`Only images and PDFs can be attached (skipped ${rejected.map((f) => f.name).join(", ")}).`);
  if (tooBig.length) problems.push(`Files must be under ${formatSize(MAX_FILE_BYTES)} (skipped ${tooBig.map((f) => f.name).join(", ")}).`);
  ui.attachBusy = ok.length > 0;
  ui.attachError = problems.join(" ") || null;
  render();
  if (!ok.length) return;
  requestPersistence();
  const saved = [];
  try {
    for (const file of ok) saved.push(await putFile({ id: newId(), tripId: trip.id, itemId: item.id, file }));
  } catch (err) {
    const name = err?.name || err?.message;
    problems.push(name === "QuotaExceededError"
      ? "This browser is out of storage space for files. Remove some attachments and try again."
      : "Couldn't save the file in this browser. Private browsing can block file storage.");
  }
  if (saved.length) updateAttachments(trip.id, item.id, (list) => [...list, ...saved]);
  ui.attachBusy = false;
  ui.attachError = problems.join(" ") || null;
  render();
}

async function removeAttachment(trip, item, fileId) {
  try { await deleteFile(fileId); } catch { /* metadata goes anyway */ }
  updateAttachments(trip.id, item.id, (list) => list.filter((f) => f.id !== fileId));
  ui.confirmRemoveFile = null;
  render();
}

function attachPanel(item, trip) {
  const files = item.attachments ?? [];
  const input = h("input", { type: "file", accept: ACCEPT, multiple: true, hidden: true, "aria-label": "Files to attach" });
  input.addEventListener("change", () => {
    const list = input.files;
    if (list?.length) addAttachments(trip, item, list);
    input.value = "";
  });

  const rowFor = (f, own) => {
    const isImage = f.type.startsWith("image/");
    const thumb = h("span", { class: "file-thumb" }, isImage ? "" : "PDF");
    const name = h("a", { class: "file-name", target: "_blank", rel: "noopener" }, f.name);
    const thumbLink = h("a", { class: "file-thumb-link", target: "_blank", rel: "noopener", tabindex: "-1", "aria-hidden": "true" }, thumb);
    const status = h("span", { class: "small muted" }, formatSize(f.size));
    // Load the stored file and point the link (and thumbnail) at it.
    getFile(f.id).then((rec) => {
      if (!rec?.blob) {
        status.textContent = "Missing on this device";
        status.className = "small bad";
        return;
      }
      const url = URL.createObjectURL(rec.blob);
      if (!name.isConnected) { URL.revokeObjectURL(url); return; }
      fileUrls.push(url);
      name.href = url;
      if (isImage) thumb.replaceChildren(h("img", { src: url, alt: "" }));
      thumbLink.href = url;
    }).catch(() => {
      status.textContent = "Couldn't open file storage";
      status.className = "small bad";
    });
    const confirming = ui.confirmRemoveFile === f.id;
    return h("li", { class: "file" },
      thumbLink,
      h("span", { class: "file-main" }, name, status),
      !own ? null : confirming
        ? h("span", { class: "actions" },
            h("button", { class: "btn danger", type: "button", onclick: () => removeAttachment(trip, item, f.id) }, "Remove"),
            h("button", { class: "btn", type: "button", onclick: () => { ui.confirmRemoveFile = null; render(); } }, "Keep"))
        : h("button", { class: "btn ghost", type: "button", "aria-label": `Remove ${f.name}`, onclick: () => { ui.confirmRemoveFile = f.id; render(); } }, "Remove"));
  };
  const rows = files.map((f) => rowFor(f, true));
  // A plan that uses a booking shows the booking's documents too (they're edited in Bookings).
  const booking = bookingOf(trip, item);
  const bookingFiles = (booking?.attachments ?? []).map((f) => rowFor(f, false));

  const panel = h("div", { class: "attach-panel card", role: "region", "aria-label": `Attachments for ${item.title}` },
    bookingFiles.length > 0 && h("p", { class: "small muted booking-files" }, "🎟️ From the booking ", h("strong", null, booking.title)),
    bookingFiles.length > 0 && h("ul", { class: "files" }, bookingFiles),
    files.length
      ? h("ul", { class: "files" }, rows)
      : !bookingFiles.length && h("p", { class: "small muted" }, "Nothing tucked in here yet. Add tickets, booking confirmations or screenshots (images or PDFs)."),
    ui.attachError && h("p", { class: "error" }, ui.attachError),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "button", disabled: ui.attachBusy, onclick: () => input.click() },
        clipIcon(), ui.attachBusy ? "Saving…" : "Attach file"),
      h("span", { class: "small muted" }, "Saved in this browser only, not included in CSV exports."),
      input));
  // Dropping files onto the panel attaches them too.
  panel.addEventListener("dragover", (e) => { e.preventDefault(); panel.classList.add("drop"); });
  panel.addEventListener("dragleave", () => panel.classList.remove("drop"));
  panel.addEventListener("drop", (e) => {
    e.preventDefault();
    panel.classList.remove("drop");
    if (e.dataTransfer?.files?.length && !ui.attachBusy) addAttachments(trip, item, e.dataTransfer.files);
  });
  return panel;
}

// The Attachments section of a form (plans and bookings). New files wait in memory and removals
// wait until `commit` on Save; Cancel drops both.
function formFiles(item) {
  let foldX = null; // the ✕ Remove button, when the section can be folded away
  const pending = [...(item.pendingFiles ?? [])];
  const removing = new Set(item.removingFiles ?? []);
  const filesBox = h("div", { class: "field span-all form-files" });
  const fileInput = h("input", { type: "file", accept: ACCEPT, multiple: true, hidden: true, "aria-label": "Files to attach" });
  let fileError = "";
  const addFiles = (list) => {
    const all = [...list];
    const bad = all.filter((f) => !isAllowedType(f) || f.size > MAX_FILE_BYTES);
    pending.push(...all.filter((f) => !bad.includes(f)));
    fileError = bad.length ? `Only images and PDFs under ${formatSize(MAX_FILE_BYTES)} can be attached (skipped ${bad.map((f) => f.name).join(", ")}).` : "";
    drawFiles();
  };
  fileInput.addEventListener("change", () => { if (fileInput.files?.length) addFiles(fileInput.files); fileInput.value = ""; });
  function drawFiles() {
    const saved = item.attachments ?? [];
    const row = (name, size, note, button) => h("li", { class: "file" }, h("span", { class: "file-main" }, h("span", { class: "file-name" }, name), h("span", { class: "small muted" }, [formatSize(size), note].filter(Boolean).join(" · "))), button);
    filesBox.replaceChildren(...[
      h("span", null, "Attachments"),
      (saved.length || pending.length) ? h("ul", { class: "files" },
        saved.map((f) => removing.has(f.id)
          ? row(h("s", null, f.name), f.size, "removed when you save", h("button", { class: "btn ghost", type: "button", onclick: () => { removing.delete(f.id); drawFiles(); } }, "Undo"))
          : row(f.name, f.size, "", h("button", { class: "btn ghost", type: "button", "aria-label": `Remove ${f.name}`, onclick: () => { removing.add(f.id); drawFiles(); } }, "Remove"))),
        pending.map((f) => row(f.name, f.size, "added when you save", h("button", { class: "btn ghost", type: "button", "aria-label": `Remove ${f.name}`, onclick: () => { pending.splice(pending.indexOf(f), 1); drawFiles(); } }, "Remove")))) : null,
      fileError && h("p", { class: "error" }, fileError),
      h("div", { class: "actions" },
        h("button", { class: "btn", type: "button", onclick: () => fileInput.click() }, clipIcon(), "Attach file"),
        h("span", { class: "small muted" }, "Tickets, bookings or screenshots (images or PDFs). Saved in this browser only."),
        fileInput),
      foldX].filter(Boolean)); // replaceChildren would print a null as "null"
  }
  filesBox.setFoldX = (x) => { foldX = x; drawFiles(); };
  filesBox.clearFiles = () => { pending.length = 0; for (const f of item.attachments ?? []) removing.add(f.id); fileError = ""; drawFiles(); };
  drawFiles();
  filesBox.addEventListener("dragover", (e) => { e.preventDefault(); filesBox.classList.add("drop"); });
  filesBox.addEventListener("dragleave", () => filesBox.classList.remove("drop"));
  filesBox.addEventListener("drop", (e) => { e.preventDefault(); filesBox.classList.remove("drop"); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  // Stores new files and deletes removed ones. Returns the attachment list, or null if storing failed.
  async function commit(tripId, itemId) {
    const attachments = (item.attachments ?? []).filter((a) => !removing.has(a.id));
    if (pending.length) requestPersistence();
    try {
      for (const file of pending) attachments.push(await putFile({ id: newId(), tripId, itemId, file }));
    } catch {
      fileError = "Couldn't save the files in this browser (private browsing or full storage can block it). Remove them to save.";
      drawFiles();
      return null;
    }
    for (const id of removing) await deleteFile(id).catch(() => {});
    return attachments;
  }
  return { el: filesBox, pending, removing, commit, changed: () => pending.length > 0 || removing.size > 0 };
}

// A cost input with a live "≈ S$12.30" under it while typing. `currency()` is read each time, as it can change.
function costField(label, input, currency) {
  const hint = h("span", { class: "alt num cost-hint", "aria-live": "polite" });
  const labelEl = h("span", null);
  const update = () => {
    const n = Number(input.value);
    labelEl.textContent = `${label} (${currency()})`;
    hint.textContent = input.value.trim() !== "" && n > 0 ? homeText(n, currency()) : "";
  };
  input.addEventListener("input", update);
  update();
  const el = h("label", { class: "field span-2" }, labelEl, input, hint);
  return { el, update };
}

// Flights and Transport plans use the travel layout (from → to, number, times).
const TRAVEL_CATEGORIES = ["Flights", "Transport"];

function itemForm(item, trip, days, onSave, onCancel, onDelete) {
  // A travel plan saved under another category reads as its mode's category.
  if (item.travel && !TRAVEL_CATEGORIES.includes(item.category)) item = { ...item, category: travelMode(item.travel.mode).category };
  const ccs = tripCountries(trip);
  const multi = ccs.length > 1;
  let country = getCountry(itemCountry(item, trip, days));
  const isTravel = TRAVEL_CATEGORIES.includes(item.category);
  const isFlight = item.category === "Flights";
  // Title is whatever you call the plan ("Lunch at Ichiran"); Place is where, with suggestions from the map.
  const titleInput = h("input", { name: "title", autofocus: true, value: item.title,
    placeholder: isTravel ? "Optional, e.g. SQ 12 to Tokyo" : "e.g. Lunch at Ichiran, or Go to Disneyland" });
  const startPlace = item.place?.name ?? (item.place ? item.title : "");
  const placeInput = h("input", { name: "placeName", value: startPlace });

  // The cost's currency: the plan's own, or for a new plan on a multi-country trip, the day's country's.
  const isNew = !trip.items.some((i) => i.id === item.id);

  // Attachments: new files wait in memory and removals wait until Save; Cancel drops both.
  const files = formFiles(item);
  const { pending, removing } = files;
  const filesBox = files.el;
  // Travel is usually booked (and paid) from home, so it starts in the home currency.
  const startCur = isNew && !item.currency ? (isTravel ? home.currency : planCurrency(trip, country?.code)) : itemCurrency(item, trip);
  const curOptions = [...new Set([startCur, trip.currency, ...ccs.map(currencyForCountry), home.currency, ...ALL_CURRENCIES].filter(Boolean))];
  const currencySelect = h("select", { name: "currency", "aria-label": "Currency" }, curOptions.map((c) => h("option", { selected: c === startCur }, c)));
  let currencyTouched = !isNew || Boolean(item.currency) || isTravel;
  const setCur = (code) => {
    if (currencyTouched || !code || code === currencySelect.value) return;
    currencySelect.value = code;
    costInput.update();
  };

  // Suggestions favour places around where you are that day, in that day's country.
  let near = null;
  const setDay = (date) => {
    const b = days.includes(date) ? dayBase(trip, date, days) : null;
    near = basePoint(trip, b);
    if (multi) {
      country = getCountry(dayCountry(trip, date, days));
      setCur(planCurrency(trip, country?.code));
    }
    placeInput.placeholder = b ? `Search for a place near ${b.area || b.city}` : country ? `Search, e.g. "Disney" or a place in ${country.name}` : "Search for a place";
  };
  const categorySelect = h("select", { name: "category" }, CATEGORIES.map((c) => h("option", { selected: c === item.category }, c)));
  const locationInput = h("input", { name: "location", placeholder: "Address or area", value: item.location });
  const linkInput = h("input", { name: "link", type: "url", placeholder: "https://", value: item.link });
  let categoryTouched = Boolean(item.title || startPlace); // don't second-guess a category on an existing plan
  categorySelect.addEventListener("change", () => {
    categoryTouched = true;
    // Flights and Transport switch to the travel layout (and back).
    if (TRAVEL_CATEGORIES.includes(categorySelect.value) || isTravel) switchKind(categorySelect.value);
    else if (categorySelect.value === "Lodging") [...form.querySelectorAll(".add-chips button")].find((b) => b.textContent === "+ Cost")?.click();
  });
  let autoLocation = null; // what we filled in, so a later pick can replace it
  let autoLink = null;
  let picked = null; // the place picked from suggestions, saved with the plan for the info panel

  // Typing a place suggests real ones in the trip's country, and fills in the rest of the form.
  const placeBox = isTravel ? null : autocomplete(placeInput, {
    delay: 350,
    // A multi-country trip searches the day's country first, then the others.
    search: (q, signal) => searchPlaces(q, multi ? [country?.code, ...ccs] : country?.code, signal, { near }),
    renderItem: (p) => [
      h("span", { class: "ac-icon", "aria-hidden": "true" }, "📍"),
      h("span", { class: "ac-main" },
        h("span", { class: "ac-title" }, p.name),
        h("span", { class: "ac-sub small muted" }, [p.area, (!country || multi) && p.country].filter(Boolean).join(", "))),
      p.kind && h("span", { class: "ac-tag" }, p.kind),
    ].filter(Boolean),
    footer: () => h("span", { class: "small muted" }, "Places from © OpenStreetMap contributors"),
    onPick: (p) => {
      placeInput.value = p.name;
      titleInput.placeholder = p.name;
      if (!locationInput.value.trim() || locationInput.value === autoLocation) {
        locationInput.value = autoLocation = [p.area, (!country || multi) && p.country].filter(Boolean).join(", ");
      }
      if (!linkInput.value.trim() || linkInput.value === autoLink) linkInput.value = autoLink = mapsLink(p);
      if (p.category && !categoryTouched) categorySelect.value = p.category;
      picked = { name: p.name, ...(p.osm ? { osm: p.osm, lat: p.lat, lon: p.lon, kind: p.kind, area: p.area } : {}), ...(p.countryCode ? { cc: p.countryCode } : {}) };
      if (multi && p.countryCode) setCur(planCurrency(trip, p.countryCode));
      if (activeInfo?.isConnected) fillInfo(activeInfo, { ...item, title: titleInput.value.trim() || p.name, category: categorySelect.value, place: picked }, trip, days);
    },
  });

  const useSelect = days.length > 0 && (item.date === "" || days.includes(item.date));
  // One cost: what it costs (older plans show what was paid if that was entered, else the estimate). Paid is the tick.
  const paidBox = h("input", { type: "checkbox", name: "paid", checked: isPaid(item) });
  const curNow = () => currencySelect.value;
  const costInput = costField("Cost", h("input", { name: "cost", type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "0", value: expectedCost(item) || "" }), curNow);
  currencySelect.addEventListener("change", () => { currencyTouched = true; costInput.update(); });
  const readCost = (f) => Number(f.get("cost")) || 0;
  setDay(item.date);
  // Travel plans: from → to (any place, home included), number and times instead of one place.
  const t = item.travel ?? {};
  const placesList = `travel-places-${item.id}`;
  const homeName = getCountry(home.country)?.name;
  // Flights are flights; Transport picks train, bus, ferry or car.
  const groundModes = TRAVEL_MODES.filter((m) => m.key !== "flight");
  const groundMode = groundModes.some((m) => m.key === t.mode) ? t.mode : "train";
  const modeSelect = isFlight ? h("input", { type: "hidden", name: "mode", value: "flight" })
    : h("select", { name: "mode" }, groundModes.map((m) => h("option", { value: m.key, selected: m.key === groundMode }, `${m.icon} ${m.label}`)));
  // Airports (flights only): type a code, city or name; home and the trip's countries come first.
  const airportCountries = [home.country, ...ccs].filter(Boolean);
  function airportField(name, label, code, nameKey, fullName, placeField) {
    const input = h("input", { name, value: code ? `${fullName || ""} (${code})`.trim() : "", placeholder: name === "fromAirport" ? "e.g. Changi or SIN" : "e.g. Haneda or HND" });
    const box = autocomplete(input, {
      delay: 150,
      search: async (q) => searchAirports(await loadAirports(), q, { countries: airportCountries }),
      renderItem: (a) => [
        h("span", { class: "ac-icon", "aria-hidden": "true" }, "✈"),
        h("span", { class: "ac-main" }, h("span", { class: "ac-title" }, a.name), h("span", { class: "ac-sub small muted" }, [a.serves || a.city, getCountry(a.cc)?.name].filter(Boolean).join(", "))),
        h("span", { class: "ac-tag num" }, a.code)],
      onPick: (a) => {
        input.value = airportLabel(a);
        // Fill an empty From / To: a trip city if the airport serves one, else the country.
        const place = form.querySelector(`input[name=${placeField}]`);
        if (place && !place.value.trim()) {
          const city = tripCities(trip).find((c) => sameName(c.name, a.serves || a.city));
          place.value = city?.name ?? (a.cc === home.country ? getCountry(a.cc)?.name : null) ?? a.serves ?? a.city;
        }
      },
      emptyText: () => "No airport matches that. Try the city or the 3-letter code.",
    });
    return field(label, box.el);
  }
  const readAirports = (f) => {
    const out = {};
    for (const k of ["fromAirport", "toAirport"]) {
      const text = String(f.get(k) ?? "").trim();
      const code = airportCode(text);
      if (code) { out[k] = code; out[`${k}Name`] = text.replace(/\s*\([A-Za-z]{3}\)\s*$/, "").trim(); }
    }
    return out;
  };
  const dayField = (cls) => field("Day", useSelect
    ? h("select", { name: "date" },
        h("option", { value: "", selected: item.date === "" }, "Unscheduled"),
        days.map((d, i) => h("option", { value: d, selected: d === item.date }, `Day ${i + 1} · ${formatDay(d)}`)))
    : h("input", { name: "date", type: "date", value: item.date }), cls);
  const routeRow = (a, b) => h("div", { class: "route-row span-all" }, a, h("span", { class: "route-arrow", "aria-hidden": "true" }, "→"), b);
  const travelFields = isTravel ? [
    // Home is always offered (it's usually where the first flight leaves from), then the trip's countries and cities.
    h("datalist", { id: placesList }, [...new Set([homeName, ...ccs.map((c) => getCountry(c)?.name), ...tripCities(trip).map((c) => c.name)].filter(Boolean))].map((n) => h("option", { value: n }))),
    // Day | By | number, then From → To side by side (airports the same way), then the times.
    dayField(isFlight ? "span-3 pair" : "span-2"),
    isFlight ? modeSelect : field("By", modeSelect, "span-2"),
    field(isFlight ? "Flight no." : "Train or bus no.", h("input", { name: "number", value: t.number ?? "", placeholder: "Optional" }), isFlight ? "span-3 pair" : "span-2"),
    routeRow(
      field("From", h("input", { name: "from", list: placesList, value: t.from ?? "", placeholder: homeName ? `e.g. ${homeName}` : "e.g. Singapore" })),
      field("To", h("input", { name: "to", list: placesList, value: t.to ?? "", placeholder: "A country or city, e.g. Japan" }))),
    isFlight && routeRow(
      airportField("fromAirport", "From airport", t.fromAirport, "fromAirportName", t.fromAirportName, "from"),
      airportField("toAirport", "To airport", t.toAirport, "toAirportName", t.toAirportName, "to")),
    field("Departs", h("input", { name: "time", type: "time", value: item.time }), "span-2"),
    field("Arrives", h("input", { name: "arrive", type: "time", value: t.arrive ?? "" }), "span-2"),
    h("label", { class: "check span-2 next-day wide" }, h("input", { type: "checkbox", name: "nextDay", checked: Boolean(t.nextDay) }), h("span", null, "Arrives the next day")),
  ] : [];

  // "Choose booking": the plan then takes its cost, paid status and tickets from that booking.
  const linked = bookingOf(trip, item);
  const bookings = bookingsOf(trip);
  const readBookingId = (f) => String(f.get("bookingId") ?? "") || undefined;
  const bookingSelect = h("select", { name: "bookingId", disabled: !bookings.length },
    h("option", { value: "" }, bookings.length ? "None" : "No bookings yet. Add them in the Bookings tab"),
    bookings.map((b) => h("option", { value: b.id, selected: b.id === linked?.id },
      [b.title, b.amount > 0 && formatMoney(Number(b.amount), b.currency || trip.currency)].filter(Boolean).join(" · "))));
  const bookingField = field("Booking", bookingSelect, "span-all booking-pick");
  bookingField.append(h("span", { class: "small muted" }, "Its cost, paid status and tickets are used for this plan, and the budget counts it once."));

  // Changing to or from Flights / Transport redraws the form in the other layout, keeping what's been typed.
  const switchKind = (category) => {
    const f = new FormData(form);
    const { travel: _t, currency: _c, ...rest } = item;
    const travel = TRAVEL_CATEGORIES.includes(category);
    const placeText = String(f.get("placeName") ?? "").trim();
    const draft = {
      ...rest,
      title: String(f.get("title") ?? "").trim(),
      date: String(f.get("date") ?? ""),
      time: String(f.get("time") ?? ""),
      category,
      ...(picked ? { place: picked } : placeText && placeText !== startPlace ? { place: { name: placeText } } : {}),
      estimatedCost: readCost(f),
      actualCost: null,
      paid: paidBox.checked,
      link: String(f.get("link") ?? "").trim(),
      notes: String(f.get("notes") ?? ""),
      ...(currencyTouched && !isTravel ? { currency: currencySelect.value } : {}),
      pendingFiles: pending, removingFiles: [...removing], bookingId: readBookingId(f),
      ...(travel ? { travel: {
        mode: category === "Flights" ? "flight" : groundMode,
        from: String(f.get("from") ?? "").trim(), to: String(f.get("to") ?? "").trim(), number: String(f.get("number") ?? "").trim(),
        arrive: String(f.get("arrive") ?? ""), nextDay: f.get("nextDay") === "on", ...readAirports(f),
      } } : {}),
    };
    const next = itemForm(draft, trip, days, onSave, onCancel, onDelete);
    form.replaceWith(next);
    next.querySelector(travel ? "input[name=from]" : "input[name=title]")?.focus();
  };

  const form = h("form", { class: `card pad form-grid six editing${isTravel ? " travel" : ""}` },
    field(isTravel ? "Name" : "Title", titleInput, "span-4"),
    field("Category", categorySelect, "span-2"),
    !isTravel && field("Place", placeBox.el, "span-3"),
    !isTravel && field("Where", locationInput, "span-3"),
    isTravel ? travelFields : [dayField("span-2"), field("Time", h("input", { name: "time", type: "time", value: item.time }), "span-1")],
    foldable([
      { label: "Booking", open: Boolean(linked), el: bookingField },
      // Flights and stays nearly always cost something; other plans often don't.
      { label: "Cost", open: expectedCost(item) > 0 || ["Flights", "Lodging"].includes(item.category),
        els: [costInput.el, field("Currency", currencySelect, "span-1 cost-part"),
          h("label", { class: "check span-all cost-part" }, paidBox, h("span", null, "Paid"), h("span", { class: "small muted" }, " · ticks it off the to-pay list on the right"))] },
      { label: "Link", el: field("Link", linkInput, "span-all"), open: Boolean(item.link) },
      { label: "Notes", el: field("Notes", h("textarea", { name: "notes", rows: 2 }, item.notes), "span-all"), open: Boolean(item.notes?.trim()) },
      { label: "Attachment", el: filesBox, open: Boolean(item.attachments?.length || pending.length) }]),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, "Save"),
      h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"),
      onDelete && h("button", { class: "btn danger push", type: "button", onclick: onDelete }, "Delete")));
  form.addEventListener("change", (e) => { if (e.target.name === "date") setDay(e.target.value); });
  costInput.el.classList.add("cost-part");
  // With a booking picked, the plan's own cost is hidden: the booking's is used.
  const syncBooking = () => form.classList.toggle("has-booking", Boolean(bookingSelect.value));
  bookingSelect.addEventListener("change", syncBooking);
  syncBooking();
  // Typing a cost or changing the day updates the budget summary right away, before saving.
  form.addEventListener("input", () => {
    if (!activeSummary?.box.isConnected) return;
    const f = new FormData(form);
    const draft = {
      ...withCurrency(item, String(f.get("currency")), trip),
      category: String(f.get("category")),
      date: String(f.get("date") ?? ""),
      bookingId: readBookingId(f),
      estimatedCost: readCost(f),
      actualCost: null,
      paid: paidBox.checked,
    };
    const current = loadTrips().find((t) => t.id === trip.id) ?? trip;
    const exists = current.items.some((i) => i.id === item.id);
    activeSummary.update({ ...current, items: exists ? current.items.map((i) => (i.id === item.id ? draft : i)) : [...current.items, draft] }, true);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.saving) return;
    const f = new FormData(form);
    // A Flights or Transport plan is a journey once it has a route or a number; a taxi fare needn't be.
    const filled = isTravel ? {
      mode: String(f.get("mode")), from: String(f.get("from")).trim(), to: String(f.get("to")).trim(),
      number: String(f.get("number")).trim(), arrive: String(f.get("arrive") ?? ""), nextDay: f.get("nextDay") === "on",
      ...(isFlight ? readAirports(f) : {}),
    } : null;
    const travel = filled && (filled.from || filled.to || filled.number || filled.arrive || filled.fromAirport || filled.toAirport) ? filled : undefined;
    // The place: the one picked from suggestions, the old one if unchanged, or just what's typed (looked up by name).
    const placeText = isTravel ? "" : String(f.get("placeName") ?? "").trim();
    const place = isTravel ? undefined : picked && placeText === picked.name ? picked
      : placeText && placeText === startPlace ? item.place : placeText ? { name: placeText } : undefined;
    const title = String(f.get("title")).trim() || placeText || (travel ? travelTitle(travel) : "");
    if (!title) { titleInput.focus(); return; }
    // Store new files and drop removed ones before saving the plan.
    let attachments = (item.attachments ?? []).filter((a) => !removing.has(a.id));
    if (files.changed()) {
      form.dataset.saving = "1";
      const saveBtn = form.querySelector("button[type=submit]");
      if (saveBtn) saveBtn.textContent = "Saving…";
      attachments = await files.commit(trip.id, item.id);
      if (!attachments) { delete form.dataset.saving; if (saveBtn) saveBtn.textContent = "Save"; return; }
    }
    const { travel: _old, place: _p, pendingFiles: _pf, removingFiles: _rf, attachments: _a, ...base } = withCurrency(item, String(f.get("currency")), trip);
    onSave({
      ...base,
      ...(attachments.length ? { attachments } : {}),
      title,
      ...(place ? { place } : {}),
      category: String(f.get("category")),
      date: String(f.get("date") ?? ""),
      time: String(f.get("time") ?? ""),
      location: travel ? routeText(travel) : isTravel ? "" : String(f.get("location")).trim(),
      ...(travel ? { travel } : {}),
      bookingId: readBookingId(f),
      estimatedCost: readCost(f),
      actualCost: null,
      paid: paidBox.checked,
      link: String(f.get("link")).trim(),
      notes: String(f.get("notes")),
    });
  });
  return form;
}

/* ----- place info panel ----- */

const settled = new WeakMap(); // promise -> { value } once done, so re-renders don't flash "Loading"
const track = (p) => { p.then((value) => settled.set(p, { value }), () => settled.set(p, { error: true })); return p; };
let activeInfo = null; // the panel on screen, so picking a suggestion can preview it

const KIND_LABELS = { "tourism=attraction": "Attraction", "amenity=place_of_worship": "Place of worship", "aeroway=aerodrome": "Airport" };
const kindLabel = (kind) => {
  if (!kind) return "";
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  const v = kind.includes("=") ? kind.split("=")[1] : kind;
  return v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
};

function infoPanel(item, trip, days) {
  const box = h("div", { class: "info card", "aria-live": "polite" });
  activeInfo = box;
  fillInfo(box, item, trip, days);
  return box;
}

function fillInfo(box, item, trip, days) {
  box.dataset.item = item?.id ?? "";
  if (!item) {
    box.replaceChildren(h("div", { class: "info-body" },
      h("h2", null, "Place info"),
      h("p", { class: "small muted" }, ui.tab === "ideas"
        ? "Save a place, then pick it to see opening hours, a short guide and crowd tips here."
        : ui.tab === "discover"
          ? "Search for places, then pick one to see opening hours, a short guide and crowd tips here."
          : "Add a plan, then pick it in the itinerary to see opening hours, a short guide and crowd tips here.")));
    return;
  }
  if (item.travel) {
    // No single place to look up for a journey: show the route and times instead.
    const m = travelMode(item.travel.mode);
    box.replaceChildren(h("div", { class: "info-body" },
      h("p", { class: "small muted" }, item.date ? dayLabel(item.date, days) : "Unscheduled"),
      h("h2", null, `${m.icon} ${routeText(item.travel) || item.title}`),
      h("p", { class: "small muted" }, [m.label, item.travel.number, airportRoute(item.travel), travelTimes(item)].filter(Boolean).join(" · ")),
      item.link && h("p", { class: "small" }, h("a", { href: item.link, target: "_blank", rel: "noopener noreferrer" }, "Booking ↗")),
      item.travel.to && h("p", { class: "small muted" }, tripCities(trip).some((c) => sameName(c.name, item.travel.to))
        ? `Arriving makes ${item.travel.to} where you're based from ${item.travel.nextDay ? "the next day" : "this day"} on, until you pick another city with 📍.`
        : `${item.travel.to} isn't one of this trip's cities, so it doesn't change where you're based.`)));
    return;
  }
  const country = getCountry(itemCountry(item, trip, days));
  const infoP = track(getPlaceInfo({ title: item.place?.name || item.title, place: item.place, countryCode: country?.code }));
  const year = /^\d{4}/.test(item.date) ? item.date.slice(0, 4) : null;
  const holP = track(getHolidays(country?.code, year));
  const draw = () => {
    if (box.dataset.item !== (item.id ?? "")) return; // a newer plan was selected meanwhile
    const info = settled.get(infoP);
    const hol = settled.get(holP);
    box.replaceChildren(infoContent(item, trip, days, info, hol));
  };
  draw();
  if (!settled.has(infoP) || !settled.has(holP)) Promise.allSettled([infoP, holP]).then(() => queueMicrotask(draw));
}

function infoContent(item, trip, days, info, hol) {
  const data = info?.value ?? null;
  const loading = !info;
  const dayIdx = days.indexOf(item.date);
  const when = item.saved ? `Saved place · ${groupOf(item.group).label}` : item.nearby ? item.nearby : [item.date ? (dayIdx >= 0 ? `Day ${dayIdx + 1} · ${formatDay(item.date)}` : formatDay(item.date)) : "Unscheduled", item.time].filter(Boolean).join(" · ");
  const kind = data?.kind || item.place?.kind || "";
  const section = (title, ...body) => h("section", { class: "info-sec" }, h("h3", null, title), ...body);
  const extLink = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
  const maps = item.link?.startsWith("https://www.google.com/maps") ? item.link
    : mapsLink({ name: data?.name || item.place?.name || item.title, area: data?.area || item.location, country: getCountry(itemCountry(item, trip, days))?.name });

  const note = hol ? dayNote(item.date, hol.value ?? null) : null;
  const tip = crowdTip(kind, item.category);
  const crowds = section("Busy times",
    note && h("p", { class: `info-day ${note.busy ? "busy" : "quiet"}` }, note.text),
    !item.date && h("p", { class: "small muted" }, item.saved || item.nearby ? "Add it to a day to see if that day is a weekend or public holiday." : "Give this plan a day to see if it falls on a weekend or public holiday."),
    tip && h("p", { class: "small" }, h("span", { class: "muted" }, "General tip: "), tip),
    h("p", { class: "small muted" }, "There's no free source of real peak hours for a place, so we don't guess. Google Maps shows ",
      extLink(maps, "Popular times"), " for most places."));

  return h("div", null,
    data?.wiki?.image && h("img", { class: "info-img", src: data.wiki.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }),
    h("div", { class: "info-body" },
      h("p", { class: "small muted" }, when),
      h("h2", null, data?.name || item.title),
      h("p", { class: "small muted" }, [data?.localName, kindLabel(kind), data?.area || item.location].filter(Boolean).join(" · ")),
      loading && h("p", { class: "small muted info-loading" }, "Looking up this place…"),
      info?.error && h("div", { class: "small" }, h("p", { class: "muted" }, "Couldn't load place info right now."),
        h("button", { class: "btn", type: "button", onclick: () => render() }, "Try again")),
      !loading && !info.error && !data && h("p", { class: "small muted" },
        `We couldn't find "${item.place?.name || item.title}" on the map. Edit it and pick the place from the suggestions to get its info.`),
      data?.wiki && h("div", { class: "info-wiki" },
        h("p", { class: "info-extract" }, data.wiki.extract),
        h("p", { class: "small" }, extLink(data.wiki.url, "Read more on Wikipedia"))),
      data && section("Opening hours",
        data.hours.length
          ? h("ul", { class: "info-hours" }, data.hours.map((l) => h("li", null, l)))
          : h("p", { class: "small muted" }, "Not listed in OpenStreetMap.", data.website ? " Check the official website below." : " Check the place's own website before you go."),
        data.hours.length > 0 && h("p", { class: "small muted" }, "From OpenStreetMap, so it can be out of date.")),
      data && (data.website || data.phone || data.fee) && section("Details",
        h("ul", { class: "info-links" },
          data.website && h("li", null, extLink(data.website, data.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))),
          data.phone && h("li", null, h("a", { href: `tel:${data.phone.split(/[;,]/)[0].replace(/[^\d+]/g, "")}` }, data.phone.split(";")[0])),
          data.fee && h("li", null, data.fee === "yes" ? "Entry fee charged" : data.fee === "no" ? "Free entry" : `Fee: ${data.fee}`))),
      crowds,
      data?.guessed && h("p", { class: "small muted" }, "Matched by name. Wrong place? Edit it and pick the right one from the suggestions."),
      h("p", { class: "small muted info-credit" }, "Info from ",
        data?.osmUrl ? extLink(data.osmUrl, "OpenStreetMap") : "OpenStreetMap",
        data?.wiki ? [" and ", extLink(data.wiki.url, "Wikipedia")] : "",
        hol?.value ? ", holidays from Nager.Date" : "", ".")));
}

/* ----- budget ----- */

// The budget tab is built once and then updated in place as limits are typed,
// so typing in one limit box never loses focus or wipes the next one.
function budgetView(trip, days) {
  const money = (n) => formatMoney(n, trip.currency);
  let current = trip;
  const refs = { cats: {} };

  const stat = (key, hint) => {
    refs[key] = { label: h("span", { class: "small muted" }), value: h("strong", { class: "num" }), alt: h("span", { class: "alt num" }) };
    return h("div", { class: "card stat", title: hint }, refs[key].label, refs[key].value, refs[key].alt);
  };
  const setAlt = (el, n) => { el.textContent = n > 0 ? homeText(n, current.currency) : ""; };

  const rows = CATEGORIES.map((category) => {
    const input = h("input", { type: "number", min: 0, step: "1", inputmode: "decimal", placeholder: "No limit",
      "aria-label": `${category} budget`, value: current.budget?.[category] ?? "" });
    input.addEventListener("input", () => {
      const budget = { ...current.budget };
      const n = Number(input.value);
      if (input.value === "" || Number.isNaN(n)) delete budget[category];
      else budget[category] = n;
      current = { ...current, budget };
      saveTrip(current);
      update();
      if (activeSummary?.box.isConnected) activeSummary.update(current);
    });
    const limitAlt = h("span", { class: "alt num" });
    const r = {
      limitAlt,
      planned: h("td", { class: "r num" }),
      spent: h("td", { class: "r num" }),
      projected: h("td", { class: "r num" }),
      bar: h("td", { class: "bar-cell" }),
    };
    refs.cats[category] = r;
    return h("tr", null,
      h("td", null, h("i", { class: `dot cat-${category}` }), category),
      h("td", { class: "limit" }, input, limitAlt),
      r.spent, r.projected, r.bar);
  });

  refs.perPerson = h("p", { class: "muted" });
  refs.foot = { budget: h("td", { class: "num" }), planned: h("td", { class: "r num" }), spent: h("td", { class: "r num" }), projected: h("td", { class: "r num" }) };

  const view = h("div", { class: "stack" },
    h("div", { class: "stats" },
      stat("budget"), stat("expected", "Every plan's cost"), stat("paid"), stat("left")),
    refs.perPerson,
    h("div", { class: "card table-wrap" },
      h("table", { class: "budget" },
        h("thead", null, h("tr", null,
          h("th", null, "Category"), h("th", null, `Budget limit (${trip.currency})`),
          h("th", { class: "r" }, "Paid"), h("th", { class: "r" }, "Total"), h("th", null, h("span", { class: "sr-only" }, "Progress")))),
        h("tbody", null, rows),
        h("tfoot", null, h("tr", null,
          h("td", null, "Total"), refs.foot.budget, refs.foot.spent, refs.foot.projected, h("td", null))))),
    tripCurrencyList(trip).length > 1 && h("p", { class: "small muted" }, `Plans in other currencies are converted to ${trip.currency} at today's rate.`),
    refs.madeOf = h("div"),
    rateNote(trip),
    days.length > 0 && h("section", null,
      h("h3", null, "By day"),
      (() => {
        const s = summarize(current, days.length);
        const maxDay = Math.max(1, ...days.map((d) => s.byDay[d] ?? 0));
        return h("div", { class: "card pad day-bars" }, days.map((d, i) => {
          const v = s.byDay[d] ?? 0;
          return h("div", { class: "day-bar" },
            h("span", { class: "muted" }, `Day ${i + 1} · ${formatDay(d).split(", ")[1] ?? d}`),
            h("div", { class: "bar" }, h("div", { style: `width:${(v / maxDay) * 100}%` })),
            h("span", { class: "num r", title: homeText(v, current.currency) || null }, money(v)));
        }));
      })()));

  function setStat(key, label, value, tone, amount = 0) {
    setAlt(refs[key].alt, amount);
    refs[key].label.textContent = label;
    refs[key].value.textContent = value;
    refs[key].value.className = `num ${tone || ""}`;
  }

  function update() {
    const s = summarize(current, days.length);
    const hasBudget = s.totalBudget > 0;
    const over = hasBudget && s.remaining < 0;
    setStat("budget", "Budget", hasBudget ? money(s.totalBudget) : "Not set", "", s.totalBudget);
    setStat("expected", "Total cost", money(s.totalProjected), "", s.totalProjected);
    setStat("paid", "Paid so far", money(s.totalSpent), "", s.totalSpent);
    setStat("left", over ? "Over budget" : "Left to spend", hasBudget ? money(Math.abs(s.remaining)) : "Not set", over ? "bad" : hasBudget ? "good" : "", hasBudget ? Math.abs(s.remaining) : 0);
    const both = (n) => money(n) + (homeText(n, current.currency) ? ` (${homeText(n, current.currency)})` : "");
    refs.perPerson.textContent = `${both(s.projectedPerPerson)} per person (${plural(current.travelers, "traveler")})` +
      (s.projectedPerDay !== null ? ` · ${both(s.projectedPerDay)} per day` : "");
    for (const c of s.categories) {
      const r = refs.cats[c.category];
      const isOver = c.budget !== null && c.projected > c.budget;
      setAlt(r.limitAlt, c.budget ?? 0);
      r.spent.textContent = money(c.spent);
      r.projected.replaceChildren(money(c.projected), alt(c.projected, current.currency) ?? "");
      r.projected.className = `r num ${isOver ? "bad strong" : ""}`;
      r.bar.replaceChildren(c.budget
        ? h("div", { class: "bar", title: `${Math.round((c.projected / c.budget) * 100)}% of budget` },
            h("div", { class: isOver ? "over" : "", style: `width:${Math.min(100, (c.projected / c.budget) * 100)}%` }))
        : "");
    }
    refs.foot.budget.textContent = hasBudget ? money(s.totalBudget) : "";
    refs.foot.spent.textContent = money(s.totalSpent);
    refs.foot.projected.replaceChildren(money(s.totalProjected), alt(s.totalProjected, current.currency) ?? "");
    refs.madeOf.replaceChildren(...[madeUpOf(s, current), unconvertedNote(s, current)].filter(Boolean));
  }

  update();
  return view;
}

updateHomeButton();
render();
loadRates();
