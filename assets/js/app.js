import { CATEGORIES, newId } from "./lib/constants.js";
import { prettyHours } from "./lib/placeinfo.js";
import { ALL_CURRENCIES, findCountry, flag, getCountry, searchCountries } from "./lib/countries.js";
import { mapsLink, searchPlaces } from "./lib/places.js";
import { crowdTip, dayNote, getHolidays, getPlaceInfo } from "./lib/placeinfo.js";
import { GUIDES_CHECKED, SCHENGEN_NOTE, getGuide, homeAdviceLink, isSchengen, visaFor, visaOverviewLink, wikivoyageUrl } from "./lib/guides.js";
import { getWikivoyage } from "./lib/wikivoyage.js";
import { DISCOVER_TYPES, RADII, discoverPlaces, discoverType, formatDistance, sortResults } from "./lib/discover.js";
import { autocomplete } from "./autocomplete.js";
import { daysBetween, formatDay } from "./lib/dates.js";
import { formatMoney } from "./lib/money.js";
import { browserGuess, convert, getRates, savedHome, saveHome } from "./lib/rates.js";
import { expectedCost, summarizeBudget } from "./lib/budget.js";
import { csvToItems, itemsToCsv } from "./lib/csv.js";
import { IDEA_GROUPS, emptyIdea, groupForPlace, groupIdeas, groupOf, ideaToItem } from "./lib/ideas.js";
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
  homeOpen: false, // home currency settings card
  selectedIdea: null, // saved place whose info shows in the info panel
  editingIdea: null, // saved place id being edited
  schedulingIdea: null, // saved place id whose "Add to itinerary" picker is open
  discover: null, // the Discover tab's search and results (see discoverState)
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

// Don't rebuild the page under someone who's typing; the summary can still update in place.
function refreshAfterRates() {
  const typing = root.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  const draftIdea = Boolean(root.querySelector(".ideas-add input[name=title]")?.value);
  if (!typing && !ui.editingItem && !ui.editingTrip && !ui.editingIdea && !ui.schedulingIdea && !draftIdea) return render();
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
const WIDE = window.matchMedia("(min-width: 960px)");
WIDE.addEventListener("change", () => render());

function currentTripId() {
  const m = location.hash.match(/^#trip\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function openTrip(id) {
  Object.assign(ui, { tab: "itinerary", selectedItem: null, editingTrip: false, confirmDelete: false, editingItem: null, notice: null, attachOpen: null, attachError: null, confirmRemoveFile: null, selectedIdea: null, editingIdea: null, schedulingIdea: null, discover: null });
  location.hash = id ? `trip/${encodeURIComponent(id)}` : "";
  if (!id) history.replaceState(null, "", location.pathname + location.search);
  render();
}

function emptyTrip() {
  const now = new Date().toISOString();
  return {
    id: newId(), name: "", country: "", destination: "", startDate: "", endDate: "",
    currency: "SGD", travelers: 1, budget: {}, items: [], createdAt: now, updatedAt: now,
  };
}

function emptyItem(date) {
  return {
    id: newId(), date: date || "", time: "", title: "", location: "", category: "Activities",
    estimatedCost: 0, actualCost: null, notes: "", link: "",
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

function tripList(trips, homeShowing) {
  const creating = !homeShowing && (ui.creatingTrip ?? trips.length === 0);
  const sorted = [...trips].sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
  return h("div", { class: "stack" },
    h("div", { class: "page-head" },
      h("div", null,
        h("h1", null, "Your trips"),
        h("p", { class: "muted" }, "Plan each day, track what it costs, and ditch the spreadsheet.")),
      !creating && h("button", { class: "btn primary", type: "button", onclick: () => { ui.creatingTrip = true; render(); } }, "+ New trip")),
    creating && h("section", { class: "card pad" },
      h("h2", null, "New trip"),
      tripForm(emptyTrip(), "Create trip", (t) => {
        saveTrip(t);
        ui.creatingTrip = false;
        openTrip(t.id);
      }, trips.length ? () => { ui.creatingTrip = false; render(); } : null)),
    sorted.length
      ? h("ul", { class: "trip-grid" }, sorted.map((t) => {
          const days = daysBetween(t.startDate, t.endDate).length;
          const s = summarizeBudget(t, days);
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
        }))
      : !creating && h("p", { class: "card pad center muted" }, "No trips yet. Create one to get started."));
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

// "🇯🇵 Japan · Tokyo & Osaka"
function placeLine(trip) {
  const c = getCountry(trip.country);
  return [c && (FLAGS_OK ? `${flag(c.code)} ${c.name}` : c.name), trip.destination].filter(Boolean).join(" · ");
}

function field(label, control, cls) {
  return h("label", { class: `field ${cls || ""}` }, h("span", null, label), control);
}

function tripForm(initial, submitLabel, onSubmit, onCancel) {
  const currencies = ALL_CURRENCIES.includes(initial.currency) ? ALL_CURRENCIES : [initial.currency, ...ALL_CURRENCIES];
  const error = h("p", { class: "error", hidden: true }, "The end date is before the start date.");

  // Country: pick one and the currency follows. Older trips without one get a guess from the destination.
  let country = getCountry(initial.country) ?? (initial.country === undefined ? findCountry(initial.destination) : null);
  const currencySelect = h("select", { name: "currency" }, currencies.map((c) => h("option", { selected: c === initial.currency }, c)));
  const currencyHint = h("span", { class: "hint-inline" });
  const countryInput = h("input", {
    name: "countryName", placeholder: "Start typing, e.g. Japan", value: country?.name ?? "",
  });
  const countryFlag = h("span", { class: "country-flag", "aria-hidden": "true" }, countryIcon(country?.code));
  const setCountry = (c, picked) => {
    country = c;
    countryFlag.textContent = countryIcon(c?.code);
    if (c) {
      if (picked) countryInput.value = c.name;
      if (![...currencySelect.options].some((o) => o.value === c.currency)) currencySelect.prepend(h("option", null, c.currency));
      const changed = currencySelect.value !== c.currency;
      currencySelect.value = c.currency;
      currencyHint.textContent = changed ? `Set to ${c.currency} for ${c.name}` : "";
    }
  };
  const countryBox = autocomplete(countryInput, {
    search: (q) => searchCountries(q),
    renderItem: (c) => [FLAGS_OK && h("span", { class: "ac-icon", "aria-hidden": "true" }, flag(c.code)), h("span", { class: "ac-main" }, h("span", { class: "ac-title" }, c.name)), h("span", { class: "ac-tag num" }, c.currency)].filter(Boolean),
    onPick: (c) => setCountry(c, true),
    emptyText: () => "No country matches that.",
  });
  countryInput.addEventListener("input", () => setCountry(findCountry(countryInput.value), false));
  currencySelect.addEventListener("change", () => { currencyHint.textContent = ""; });

  const form = h("form", { class: "form-grid two" },
    field("Trip name", h("input", { name: "name", required: true, autofocus: true, placeholder: "Japan with the family", value: initial.name }), "span-all"),
    field("Country", h("div", { class: "with-flag" }, countryFlag, countryBox.el)),
    field("Cities or areas", h("input", { name: "destination", placeholder: "Tokyo & Osaka", value: initial.destination })),
    field("Start date", h("input", { name: "startDate", type: "date", value: initial.startDate })),
    field("End date", h("input", { name: "endDate", type: "date", value: initial.endDate })),
    h("div", { class: "form-grid two tight" },
      field("Currency", currencySelect),
      field("Travelers", h("input", { name: "travelers", type: "number", min: 1, value: initial.travelers }))),
    h("p", { class: "small muted form-note" }, currencyHint),
    error,
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, submitLabel),
      onCancel && h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel")));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const startDate = String(f.get("startDate"));
    const endDate = String(f.get("endDate"));
    const name = String(f.get("name")).trim();
    if (!name) return;
    if (startDate && endDate && endDate < startDate) { error.hidden = false; return; }
    onSubmit({
      ...initial,
      name,
      country: (country ?? findCountry(countryInput.value))?.code ?? "",
      destination: String(f.get("destination")).trim(),
      currency: String(f.get("currency")),
      travelers: Math.max(1, Number(f.get("travelers")) || 1),
      startDate,
      endDate,
    });
  });
  return form;
}

/* ----- trip view ----- */

function tripView(trip) {
  const days = daysBetween(trip.startDate, trip.endDate);
  const fileInput = h("input", { type: "file", accept: ".csv,text/csv", hidden: true, "aria-label": "CSV file to import" });
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    fileInput.value = "";
    if (f) importCsv(trip, await f.text());
  });

  const header = ui.editingTrip
    ? h("section", { class: "card pad" },
        h("h2", null, "Edit trip"),
        tripForm(trip, "Save", (t) => { saveTrip(t); ui.editingTrip = false; render(); },
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
        infoPanel(ui.tab === "ideas" ? ideaAsItem(selectedIdea(trip)) : ui.tab === "discover" ? discoverAsItem(selectedResult(trip), trip) : selectedItem(trip, days), trip, days)),
      h("div", { class: "trip-main stack" },
        h("div", { class: "tabs", role: "tablist" }, Object.entries(TABS).map(([t, label]) =>
          h("button", { role: "tab", type: "button", "aria-selected": String(ui.tab === t), class: ui.tab === t ? "active" : "",
            onclick: () => { Object.assign(ui, { tab: t, editingItem: null, attachOpen: null, editingIdea: null, schedulingIdea: null }); render(); } },
            label, t === "ideas" && trip.ideas?.length ? h("span", { class: "tab-count num" }, trip.ideas.length) : null))),
        ui.tab === "guide" ? guideView(trip) : ui.tab === "budget" ? budgetView(trip, days) : ui.tab === "ideas" ? ideasView(trip, days)
          : ui.tab === "discover" ? discoverView(trip, days) : itineraryView(trip, days)),
      h("aside", { class: "trip-budget", "aria-label": "Budget" },
        budgetSummary(trip, days))));
}

const TABS = { itinerary: "Itinerary", discover: "Discover", ideas: "Saved places", budget: "Budget", guide: "Good to know" };

/* ----- "Good to know" tab: entry rules, etiquette, money, plugs, emergency numbers ----- */

const ext = (link, text) => h("a", { href: link.url, target: "_blank", rel: "noopener" }, text ?? link.label, " ↗");
const linkList = (links) => h("ul", { class: "guide-links" }, links.filter(Boolean).map((l) => h("li", null, ext(l))));
const guideSec = (title, ...body) => h("section", { class: "card guide-sec" }, h("h3", null, title), ...body);
const bullets = (items, cls) => h("ul", { class: `guide-list ${cls || ""}` }, items.map((t) => h("li", null, t)));

function guideView(trip) {
  const dest = getCountry(trip.country);
  if (!dest) {
    return h("div", { class: "card pad guide-empty" },
      h("h2", null, "Good to know"),
      h("p", { class: "muted" }, "Set this trip's country to see entry rules, do's and don'ts, money tips, plugs and emergency numbers for it."),
      h("button", { class: "btn primary", type: "button", onclick: () => { ui.editingTrip = true; render(); window.scrollTo({ top: 0 }); } }, "Set the country"));
  }
  const homeC = getCountry(home.country);
  const guide = getGuide(dest.code);
  const going = homeC && homeC.code === dest.code;

  const intro = h("div", { class: "guide-head" },
    h("h2", null, `Good to know: ${dest.name}`),
    h("p", { class: "small muted" },
      homeC ? `Tailored for a ${homeC.name} passport. ` : "",
      h("button", { class: "linkish", type: "button", onclick: () => { ui.homeOpen = true; render(); window.scrollTo({ top: 0 }); } }, homeC ? "Not your passport?" : "Set where you're from"),
      " Entry rules change, so always confirm on the official sites before you book or fly."));

  return h("div", { class: "guide stack" }, intro,
    going
      ? guideSec("Entry", h("p", null, `This is your home country, so you won't need a visa. Make sure your passport is valid.`))
      : visaSection(guide, dest, homeC),
    guide ? curatedSections(guide, dest) : liveSections(dest));
}

function visaSection(guide, dest, homeC) {
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
  if (schengen) rows.push(h("p", null, SCHENGEN_NOTE.text, " ", ext(SCHENGEN_NOTE.link)));
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
  rows.push(h("p", { class: "small muted guide-note" }, `Checked ${guide ? GUIDES_CHECKED : "against the links above"}. Visa rules depend on your passport and the purpose of your trip, and they change. The official sites have the final say.`));
  return guideSec("Visa and entry", ...rows);
}

function curatedSections(g, dest) {
  return [
    h("div", { class: "guide-grid" },
      guideSec("Do", bullets(g.dos, "do")),
      guideSec("Don't", bullets(g.donts, "dont"))),
    h("div", { class: "guide-grid" },
      guideSec("Money and tipping", bullets(g.money)),
      guideSec("Emergency numbers",
        h("ul", { class: "guide-sos" }, g.emergency.map(([label, n]) =>
          h("li", null, h("span", null, label), h("a", { class: "num", href: `tel:${n.split(" ")[0].replace(/[^\d+]/g, "")}` }, n)))),
        h("h4", null, "Plugs and power"), h("p", null, g.plugs))),
    guideSec("Getting around", bullets(g.transport)),
    guideSec("More reading", linkList([...g.links, { label: `${dest.name} on Wikivoyage (community travel guide)`, url: wikivoyageUrl(dest.name) }])),
  ];
}

function liveSections(dest) {
  const box = h("div", { class: "stack", "aria-live": "polite" },
    h("p", { class: "small muted info-loading" }, `Loading tips for ${dest.name} from Wikivoyage…`));
  getWikivoyage(dest.name).then((wv) => {
    if (!wv.sections.length) throw new Error("empty");
    box.replaceChildren(
      ...wv.sections.map((s) => guideSec(s.title, ...s.blocks.map((b) => b.type === "p" ? h("p", null, b.text) : bullets(b.items)))),
      h("p", { class: "small muted" }, "These tips come from ", ext({ url: wv.url }, `Wikivoyage's ${wv.title} guide`),
        ", written by travellers (CC BY-SA). For entry rules, trust the official sources above."));
  }).catch(() => {
    box.replaceChildren(guideSec("More reading",
      h("p", { class: "small muted" }, "Couldn't load tips right now."),
      linkList([{ label: `${dest.name} on Wikivoyage (community travel guide)`, url: wikivoyageUrl(dest.name) }])));
  });
  return box;
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

function summaryContent(trip, days, draft) {
  const money = (n) => formatMoney(n, trip.currency);
  const s = summarizeBudget(trip, days.length);
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

  if (s.totalProjected === 0 && s.totalSpent === 0) {
    return [h("div", { class: "summary-body" },
      h("h2", null, "Budget"),
      h("p", { class: "small muted" }, "Add a cost to any plan and your running total, spending by category and per-day costs show up here, updating as you go."))];
  }

  return [h("div", { class: "summary-body" },
    h("div", { class: "summary-head" }, h("h2", null, "Budget"), draft && h("span", { class: "summary-draft small" }, "Includes unsaved changes")),
    h("div", null,
      h("p", { class: "small muted" }, "Expected total"),
      h("p", { class: "summary-total num" }, money(s.totalProjected)),
      alt(s.totalProjected, trip.currency, "summary-alt"),
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
        h("span", { class: "num", title: r.v ? homeText(r.v, trip.currency) || null : null }, r.v ? money(r.v) : "–"))))),
    rateNote(trip),
    ui.tab !== "budget" && h("button", { class: "btn", type: "button", onclick: goBudget }, hasBudget ? "Budget limits" : "Set budget limits"))];
}

const shortDate = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "¥1,000 = S$8.70 · rates from 23 Nov 2026", plus what to do when rates can't load. */
function rateNote(trip) {
  if (!trip.currency || trip.currency === home.currency) return null;
  const link = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
  if (ratesStatus === "loading" && !rates) return h("p", { class: "small muted rate-note" }, `Loading ${home.currency} exchange rate…`);
  if (!rates) {
    return h("p", { class: "small muted rate-note" }, `Couldn't load exchange rates, so ${home.currency} amounts are hidden. `,
      h("button", { class: "linkish", type: "button", onclick: () => { loadRates(); render(); } }, "Try again"));
  }
  let unit = 1;
  while (unit < 1e6 && (toHome(unit, trip.currency) ?? 1) < 1) unit *= 10;
  const v = toHome(unit, trip.currency);
  if (v === null) return h("p", { class: "small muted rate-note" }, `No exchange rate available for ${trip.currency} to ${home.currency}.`);
  return h("p", { class: "small muted rate-note" },
    `${formatMoney(unit, trip.currency)} = ${formatMoney(v, home.currency)} · `,
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
  const blob = new Blob([itemsToCsv(trip.items)], { type: "text/csv;charset=utf-8" });
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
  saveTrip({ ...trip, ...patch, items: [...trip.items, ...items] });
  ui.notice = `Imported ${plural(items.length, "plan")}${skipped ? `, skipped ${plural(skipped, "empty row")}` : ""}.`;
  render();
}

/* ----- itinerary ----- */

function itineraryView(trip, days) {
  const daySet = new Set(days);
  const groups = days.map((d, i) => ({ key: d, label: `Day ${i + 1}`, sub: formatDay(d), items: sortItems(trip.items.filter((it) => it.date === d)) }));
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

  return h("div", { class: "stack" },
    days.length === 0 && h("p", { class: "hint" }, "Set start and end dates in Edit trip to get a day-by-day plan."),
    groups.map((g) => {
      const total = g.items.reduce((a, i) => a + expectedCost(i), 0);
      const e = ui.editingItem;
      return h("section", { class: "day", "aria-label": g.label },
        h("div", { class: "day-head" },
          h("h3", null, g.label), g.sub && h("span", { class: "muted" }, g.sub),
          total > 0 && h("span", { class: "muted num push" }, formatMoney(total, trip.currency), homeText(total, trip.currency) && ` · ${homeText(total, trip.currency)}`)),
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
            : h("button", { class: "btn ghost", type: "button", onclick: () => { ui.editingItem = { mode: "new", date: g.key }; ui.attachOpen = null; render(); } }, "+ Add plan"))));
    }));
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
  const files = item.attachments ?? [];
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
  return h("button", {
    class: "item", type: "button", "aria-pressed": String(Boolean(selected)),
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
        h("span", null, h("i", { class: `dot cat-${item.category}` }), item.category),
        item.location && h("span", null, item.location),
        item.notes && h("em", null, item.notes),
        item.link && h("span", null, "🔗"))),
    h("span", { class: "item-cost num" },
      item.actualCost !== null && item.actualCost !== undefined
        ? [formatMoney(item.actualCost, trip.currency), alt(item.actualCost, trip.currency), h("small", { class: "paid" }, "Paid")]
        : item.estimatedCost > 0 ? [formatMoney(item.estimatedCost, trip.currency), alt(item.estimatedCost, trip.currency), h("small", { class: "muted" }, "Estimate")] : ""));
}

/* ----- saved places: a scratchpad of places, each one a click away from the itinerary ----- */

const plansFrom = (trip, idea) => trip.items.filter((i) => i.fromIdea === idea.id);

/** The saved place the info panel is about: the one being edited, picked or scheduled, or the first one. */
function selectedIdea(trip) {
  const ideas = trip.ideas ?? [];
  const id = ui.editingIdea ?? ui.selectedIdea ?? ui.schedulingIdea;
  return ideas.find((i) => i.id === id) ?? groupIdeas(ideas, (i) => plansFrom(trip, i).length > 0)[0]?.ideas[0] ?? null;
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

function ideasView(trip, days) {
  const ideas = trip.ideas ?? [];
  const groups = groupIdeas(ideas, (i) => plansFrom(trip, i).length > 0);
  const selected = selectedIdea(trip);

  const addNew = (idea) => {
    updateIdeas(trip.id, (list) => [...list, idea]);
    Object.assign(ui, { lastIdeaGroup: idea.group, selectedIdea: idea.id, focusIdeaForm: true });
    render();
  };
  const saveEdit = (idea) => {
    updateIdeas(trip.id, (list) => list.map((i) => (i.id === idea.id ? idea : i)));
    ui.editingIdea = null;
    render();
  };
  const remove = (idea) => {
    updateIdeas(trip.id, (list) => list.filter((i) => i.id !== idea.id));
    Object.assign(ui, { editingIdea: null, selectedIdea: null, schedulingIdea: null });
    render();
  };
  const cancel = () => { ui.editingIdea = null; render(); };

  const focus = Boolean(ui.focusIdeaForm);
  ui.focusIdeaForm = false;
  const adding = !ui.editingIdea;

  return h("div", { class: "stack ideas" },
    h("div", { class: "card pad stack ideas-add" },
      h("div", null,
        h("h2", null, "Saved places"),
        h("p", { class: "small muted" }, "Jot down places you might go: somewhere to eat, a sight, an activity. When you know when, press ",
          h("strong", null, "Add to itinerary"), " and pick the day and time.")),
      adding && ideaForm(emptyIdea(ui.lastIdeaGroup || "Food"), trip, days, addNew, null, null, focus)),
    groups.length === 0
      ? h("p", { class: "card pad center muted" }, "Nothing saved yet. Places you add above show up here, grouped by type.")
      : groups.map((g) => h("section", { class: "day", "aria-label": g.label },
          h("div", { class: "day-head" }, h("h3", null, g.label), h("span", { class: "muted" }, String(g.ideas.length))),
          h("ul", { class: "items" }, g.ideas.map((idea) => h("li", null,
            ui.editingIdea === idea.id
              ? ideaForm(idea, trip, days, saveEdit, cancel, () => remove(idea), true)
              : [ideaRow(idea, trip, days, selected?.id === idea.id),
                 ui.schedulingIdea === idea.id && schedulePanel(idea.title, days, (date, time) => {
                   const current = loadTrips().find((t) => t.id === trip.id);
                   if (current) saveTrip({ ...current, items: [...current.items, ideaToItem(idea, date, time)] });
                   ui.schedulingIdea = null;
                 }, () => { ui.schedulingIdea = null; }),
                 !WIDE.matches && selected?.id === idea.id && ui.selectedIdea === idea.id && h("div", { class: "info-inline" }, infoPanel(ideaAsItem(idea), trip, days))]))))),
    ideas.length > 0 && h("p", { class: "small muted" }, "Saved places stay in this browser and aren't part of CSV exports. Plans you add from them are."));
}

function ideaRow(idea, trip, days, selected) {
  const plans = plansFrom(trip, idea);
  const scheduling = ui.schedulingIdea === idea.id;
  const edit = () => { Object.assign(ui, { editingIdea: idea.id, selectedIdea: idea.id, schedulingIdea: null }); render(); };
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
      h("span", { class: "item-main" },
        h("span", { class: "item-title" }, idea.title),
        h("span", { class: "item-meta" },
          idea.location && h("span", null, idea.location),
          idea.notes && h("em", null, idea.notes)),
        plans.length > 0 && h("span", { class: "idea-plans" }, plans
          .sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || byTime(a, b))
          .map((p) => h("button", { class: "idea-plan", type: "button", title: "Show it in the itinerary", onclick: () => goToPlan(p.id) },
            "✓ ", dayLabel(p.date, days), p.time && ` · ${p.time}`))))),
    h("button", { class: `btn idea-add${scheduling ? " active" : ""}`, type: "button", "aria-expanded": String(scheduling),
      onclick: () => { Object.assign(ui, { schedulingIdea: scheduling ? null : idea.id, selectedIdea: idea.id, editingIdea: null }); render(); } },
      plans.length ? "Add again" : "Add to itinerary"),
    h("button", { class: "attach-btn", type: "button", "aria-label": `Edit ${idea.title}`, title: "Edit", onclick: edit }, pencilIcon()));
}

/** "Add <title> to your itinerary" with a day and an optional time. `onAdd(date, time)` saves it. */
function schedulePanel(title, days, onAdd, onCancel) {
  const fallback = days.includes(ui.lastScheduleDate) ? ui.lastScheduleDate : days[0] ?? "";
  const daySelect = days.length
    ? h("select", { name: "date", autofocus: true },
        days.map((d, i) => h("option", { value: d, selected: d === fallback }, `Day ${i + 1} · ${formatDay(d)}`)),
        h("option", { value: "" }, "Unscheduled"))
    : h("input", { name: "date", type: "date", autofocus: true, value: ui.lastScheduleDate || "" });
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

function ideaForm(idea, trip, days, onSave, onCancel, onDelete, focus) {
  const isNew = !onCancel;
  const country = getCountry(trip.country);
  const titleInput = h("input", {
    name: "title", required: true, autofocus: focus || null, value: idea.title,
    placeholder: country ? `A place in ${country.name}, e.g. a restaurant or sight` : "A restaurant, sight or activity",
  });
  const groupSelect = h("select", { name: "group" }, IDEA_GROUPS.map((g) => h("option", { value: g.key, selected: g.key === idea.group }, g.label)));
  const locationInput = h("input", { name: "location", placeholder: "Filled in when you pick a suggestion", value: idea.location });
  let groupTouched = !isNew;
  groupSelect.addEventListener("change", () => { groupTouched = true; });
  let autoLocation = null;
  let picked = null;

  const placeBox = autocomplete(titleInput, {
    delay: 350,
    search: (q, signal) => searchPlaces(q, country?.code, signal),
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
      picked = { link: mapsLink(p), place: p.osm ? { osm: p.osm, lat: p.lat, lon: p.lon, kind: p.kind, area: p.area } : undefined };
      if (activeInfo?.isConnected) fillInfo(activeInfo, { ...ideaAsItem(idea), title: p.name, group: groupSelect.value, place: picked.place }, trip, days);
    },
  });

  const form = h("form", { class: `form-grid six${isNew ? "" : " card pad editing"}` },
    field("Place", placeBox.el, "span-4"),
    field("Type", groupSelect, "span-2"),
    field("Where", locationInput, "span-3"),
    field("Note", h("input", { name: "notes", placeholder: "Optional, e.g. try the tonkotsu", value: idea.notes }), "span-3"),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, isNew ? "Save place" : "Save"),
      onCancel && h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"),
      onDelete && h("button", { class: "btn danger push", type: "button", onclick: onDelete }, "Delete")));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const title = String(f.get("title")).trim();
    if (!title) return;
    const same = title === idea.title;
    onSave({
      ...idea,
      title,
      group: String(f.get("group")),
      location: String(f.get("location")).trim(),
      notes: String(f.get("notes")).trim(),
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

function discoverState(trip) {
  if (ui.discover?.tripId !== trip.id) {
    ui.discover = {
      tripId: trip.id, type: "food", radius: 1000, sort: "near", keyword: "", areaText: "", area: null,
      status: "idle", results: null, resultType: null, error: null, cached: false, shown: PAGE, selected: null, scheduling: null,
    };
  }
  return ui.discover;
}

/** "Tokyo & Osaka" -> ["Tokyo", "Osaka"], offered as one-tap areas. */
const destinationAreas = (trip) => [...new Set(String(trip.destination ?? "")
  .split(/\s*(?:,|&|\/|\+|\band\b)\s*/i).map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, 4);

const areaFrom = (p, text) => ({ text, name: p.name, label: [p.name, p.area].filter(Boolean).join(", "), lat: p.lat, lon: p.lon });

function selectedResult(trip) {
  const d = discoverState(trip);
  return d.results?.find((r) => r.osm === d.selected) ?? null;
}

const resultLink = (r, d, trip) => mapsLink({ name: r.name, area: d.area?.name, country: getCountry(trip.country)?.name });
const resultPlace = (r, d) => ({ osm: r.osm, lat: r.lat, lon: r.lon, kind: r.kind.toLowerCase(), area: d.area?.label ?? "" });

// The info panel works on plans, so give it a search result in that shape.
function discoverAsItem(r, trip) {
  if (!r) return null;
  const d = discoverState(trip);
  const t = discoverType(d.resultType);
  return {
    id: `disc:${r.osm}`, title: r.name, location: d.area?.label ?? "", link: resultLink(r, d, trip), place: resultPlace(r, d),
    category: t.category, date: "", time: "",
    nearby: `${formatDistance(r.distance)} from ${d.area?.name ?? "the search spot"}`,
  };
}

async function runDiscover(trip) {
  const d = discoverState(trip);
  const country = getCountry(trip.country);
  discoverController?.abort();
  const controller = (discoverController = new AbortController());
  Object.assign(d, { status: "loading", error: null, results: null, shown: PAGE, selected: null, scheduling: null });
  render();
  try {
    if (!d.area || d.area.text !== d.areaText) {
      const found = (await searchPlaces(d.areaText, country?.code, controller.signal))[0];
      if (!found) {
        throw Object.assign(new Error("no area"), {
          userText: `Couldn't find "${d.areaText}"${country ? ` in ${country.name}` : ""}. Try a neighbourhood, station or landmark.`,
        });
      }
      d.area = areaFrom(found, d.areaText);
    }
    const { results, cached } = await discoverPlaces(
      { type: d.type, lat: d.area.lat, lon: d.area.lon, radius: d.radius, keyword: d.keyword }, controller.signal);
    if (controller !== discoverController) return;
    Object.assign(d, { status: "done", results, cached, resultType: d.type });
  } catch (e) {
    if (controller.signal.aborted) return;
    Object.assign(d, { status: "error", error: e.userText ?? "Couldn't reach the free OpenStreetMap search just now. It may be busy, so try again in a minute." });
  }
  if (ui.tab === "discover" && currentTripId() === trip.id) render();
}

function discoverView(trip, days) {
  const d = discoverState(trip);
  const country = getCountry(trip.country);
  const type = discoverType(d.type);

  const areaInput = h("input", {
    name: "area", required: true, value: d.areaText, autofocus: !d.areaText || null,
    placeholder: country ? `A neighbourhood, station or landmark in ${country.name}` : "A neighbourhood, station or landmark",
  });
  const areaBox = autocomplete(areaInput, {
    delay: 350,
    search: (q, signal) => searchPlaces(q, country?.code, signal),
    renderItem: (p) => [
      h("span", { class: "ac-icon", "aria-hidden": "true" }, "📍"),
      h("span", { class: "ac-main" }, h("span", { class: "ac-title" }, p.name), h("span", { class: "ac-sub small muted" }, p.area)),
      p.kind && h("span", { class: "ac-tag" }, p.kind),
    ].filter(Boolean),
    footer: () => h("span", { class: "small muted" }, "Places from © OpenStreetMap contributors"),
    onPick: (p) => { areaInput.value = p.name; d.areaText = p.name; d.area = areaFrom(p, p.name); },
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

  const areas = destinationAreas(trip);
  const form = h("form", { class: "card pad stack disc-form" },
    h("div", null,
      h("h2", null, "Discover"),
      h("p", { class: "small muted" }, "Find places to eat, see and shop near anywhere on your trip. Save the ones you like, or add them straight to a day.")),
    typeChips,
    h("div", { class: "form-grid six" },
      field("Near", areaBox.el, "span-3"),
      field("Looking for (optional)", keywordInput, "span-2"),
      field("Within", radiusSelect, "span-1")),
    h("div", { class: "actions" },
      h("button", { class: "btn primary", type: "submit", disabled: d.status === "loading" }, d.status === "loading" ? "Searching…" : "Search"),
      areas.length > 0 && h("span", { class: "small muted" }, "Try:"),
      areas.map((a) => h("button", { class: "chip small", type: "button", onclick: () => { areaInput.value = a; search(); } }, a))));
  form.addEventListener("submit", (e) => { e.preventDefault(); search(); });

  return h("div", { class: "stack disc" }, form, discoverResults(trip, days, d));
}

function discoverResults(trip, days, d) {
  if (d.status === "idle") {
    return h("p", { class: "card pad center muted" }, "Pick what you're after, type an area like a neighbourhood or station, and press Search.");
  }
  if (d.status === "loading") {
    return h("p", { class: "card pad center muted info-loading" }, `Looking for ${discoverType(d.type).label.toLowerCase()} near ${d.area?.text === d.areaText ? d.area.name : d.areaText}…`);
  }
  if (d.status === "error") {
    return h("div", { class: "card pad center" }, h("p", { class: "muted" }, d.error),
      h("button", { class: "btn", type: "button", onclick: () => runDiscover(trip) }, "Try again"));
  }
  const type = discoverType(d.resultType);
  const list = sortResults(d.results, d.sort);
  const credit = h("p", { class: "small muted disc-credit" },
    "Places © ", h("a", { href: OSM_COPYRIGHT, target: "_blank", rel: "noopener" }, "OpenStreetMap contributors"),
    ". OpenStreetMap has no ratings or reviews, so we don't show any. Use the Reviews link to read them on Google Maps.");
  if (!list.length) {
    return h("div", { class: "stack" },
      h("p", { class: "card pad center muted" }, `No ${type.label.toLowerCase()} ${d.keyword ? `matching "${d.keyword}" ` : ""}found within ${formatDistance(d.radius)} of ${d.area.label}.`,
        d.radius < 2000 ? " Try a bigger distance" : " Try another area", d.keyword ? " or clear the keyword." : "."),
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
    h("ul", { class: "items" }, list.slice(0, d.shown).map((r) => h("li", null,
      discoverRow(r, trip, days, d, type, selected?.osm === r.osm),
      d.scheduling === r.osm && schedulePanel(r.name, days, (date, time) => {
        const current = loadTrips().find((t) => t.id === trip.id);
        if (!current) return;
        const item = { ...emptyItem(date), time, title: r.name, location: d.area.label, category: type.category, link: resultLink(r, d, trip), place: resultPlace(r, d) };
        saveTrip({ ...current, items: [...current.items, item] });
        d.scheduling = null;
      }, () => { d.scheduling = null; }),
      !WIDE.matches && selected?.osm === r.osm && h("div", { class: "info-inline" }, infoPanel(discoverAsItem(r, trip), trip, days))))),
    list.length > d.shown && h("button", { class: "btn", type: "button", onclick: () => { d.shown += PAGE; render(); } },
      `Show ${Math.min(PAGE, list.length - d.shown)} more`),
    credit);
}

function discoverRow(r, trip, days, d, type, selected) {
  const saved = (trip.ideas ?? []).find((i) => i.place?.osm === r.osm);
  const plans = trip.items.filter((i) => i.place?.osm === r.osm);
  const scheduling = d.scheduling === r.osm;
  const hours = prettyHours(r.hours);
  const save = () => {
    if (saved) return;
    updateIdeas(trip.id, (list) => [...list, {
      ...emptyIdea(type.group), title: r.name, location: d.area.label, link: resultLink(r, d, trip), place: resultPlace(r, d),
    }]);
    render();
  };
  return h("div", { class: `item-wrap idea disc-row${selected ? " selected" : ""}` },
    h("div", { class: "item idea-card", role: "button", tabindex: "0", "aria-pressed": String(Boolean(selected)), title: "Show info about this place",
      onclick: (e) => {
        if (e.target.closest("a, button")) return;
        d.selected = selected ? null : r.osm;
        render();
      },
      onkeydown: (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); e.currentTarget.click(); } } },
      h("span", { class: "item-main" },
        h("span", { class: "item-title" }, r.name),
        h("span", { class: "item-meta" },
          h("span", null, [r.cuisine || r.kind, r.cuisine && r.kind !== "Restaurant" ? r.kind : ""].filter(Boolean).join(" · ")),
          r.localName && h("span", null, r.localName),
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
  saveTrip({ ...trip, items: trip.items.map((i) => (i.id === itemId ? { ...i, attachments: fn(i.attachments ?? []) } : i)) });
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

  const rows = files.map((f) => {
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
      confirming
        ? h("span", { class: "actions" },
            h("button", { class: "btn danger", type: "button", onclick: () => removeAttachment(trip, item, f.id) }, "Remove"),
            h("button", { class: "btn", type: "button", onclick: () => { ui.confirmRemoveFile = null; render(); } }, "Keep"))
        : h("button", { class: "btn ghost", type: "button", "aria-label": `Remove ${f.name}`, onclick: () => { ui.confirmRemoveFile = f.id; render(); } }, "Remove"));
  });

  const panel = h("div", { class: "attach-panel card", role: "region", "aria-label": `Attachments for ${item.title}` },
    files.length
      ? h("ul", { class: "files" }, rows)
      : h("p", { class: "small muted" }, "No attachments yet. Add tickets, booking confirmations or screenshots (images or PDFs)."),
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

// A cost input with a live "≈ S$12.30" under it while typing.
function costField(label, input, currency) {
  const hint = h("span", { class: "alt num cost-hint", "aria-live": "polite" });
  const update = () => {
    const n = Number(input.value);
    hint.textContent = input.value.trim() !== "" && n > 0 ? homeText(n, currency) : "";
  };
  input.addEventListener("input", update);
  update();
  return h("label", { class: "field span-2" }, h("span", null, label), input, hint);
}

function itemForm(item, trip, days, onSave, onCancel, onDelete) {
  const country = getCountry(trip.country);
  const titleInput = h("input", {
    name: "title", required: true, autofocus: true, value: item.title,
    placeholder: country ? `Try "Disney" or a place in ${country.name}` : "Sunset at Uluwatu",
  });
  const categorySelect = h("select", { name: "category" }, CATEGORIES.map((c) => h("option", { selected: c === item.category }, c)));
  const locationInput = h("input", { name: "location", placeholder: "Address or area", value: item.location });
  const linkInput = h("input", { name: "link", type: "url", placeholder: "https://", value: item.link });
  let categoryTouched = Boolean(item.title); // don't second-guess a category on an existing plan
  categorySelect.addEventListener("change", () => { categoryTouched = true; });
  let autoLocation = null; // what we filled in, so a later pick can replace it
  let autoLink = null;
  let picked = null; // the place picked from suggestions, saved with the plan for the info panel

  // Typing a place suggests real ones in the trip's country, and fills in the rest of the form.
  const placeBox = autocomplete(titleInput, {
    delay: 350,
    search: (q, signal) => searchPlaces(q, country?.code, signal),
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
      if (!linkInput.value.trim() || linkInput.value === autoLink) linkInput.value = autoLink = mapsLink(p);
      if (p.category && !categoryTouched) categorySelect.value = p.category;
      picked = p.osm ? { osm: p.osm, lat: p.lat, lon: p.lon, kind: p.kind, area: p.area } : null;
      if (activeInfo?.isConnected) fillInfo(activeInfo, { ...item, title: p.name, category: categorySelect.value, place: picked }, trip, days);
    },
  });

  const useSelect = days.length > 0 && (item.date === "" || days.includes(item.date));
  const form = h("form", { class: "card pad form-grid six editing" },
    field("What", placeBox.el, "span-4"),
    field("Category", categorySelect, "span-2"),
    field("Day", useSelect
      ? h("select", { name: "date" },
          h("option", { value: "", selected: item.date === "" }, "Unscheduled"),
          days.map((d, i) => h("option", { value: d, selected: d === item.date }, `Day ${i + 1} · ${formatDay(d)}`)))
      : h("input", { name: "date", type: "date", value: item.date }), "span-2"),
    field("Time", h("input", { name: "time", type: "time", value: item.time }), "span-1"),
    field("Where", locationInput, "span-3"),
    costField(`Estimated cost (${trip.currency})`, h("input", { name: "estimatedCost", type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "0", value: item.estimatedCost || "" }), trip.currency),
    costField(`Actual cost (${trip.currency})`, h("input", { name: "actualCost", type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "Not paid yet", value: item.actualCost ?? "" }), trip.currency),
    field("Link", linkInput, "span-2"),
    field("Notes", h("textarea", { name: "notes", rows: 2 }, item.notes), "span-all"),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, "Save"),
      h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"),
      onDelete && h("button", { class: "btn danger push", type: "button", onclick: onDelete }, "Delete")));
  // Typing a cost or changing the day updates the budget summary right away, before saving.
  form.addEventListener("input", () => {
    if (!activeSummary?.box.isConnected) return;
    const f = new FormData(form);
    const actualRaw = String(f.get("actualCost")).trim();
    const draft = {
      ...item,
      category: String(f.get("category")),
      date: String(f.get("date") ?? ""),
      estimatedCost: Number(f.get("estimatedCost")) || 0,
      actualCost: actualRaw === "" || Number.isNaN(Number(actualRaw)) ? null : Number(actualRaw),
    };
    const current = loadTrips().find((t) => t.id === trip.id) ?? trip;
    const exists = current.items.some((i) => i.id === item.id);
    activeSummary.update({ ...current, items: exists ? current.items.map((i) => (i.id === item.id ? draft : i)) : [...current.items, draft] }, true);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const title = String(f.get("title")).trim();
    if (!title) return;
    const actualRaw = String(f.get("actualCost")).trim();
    const actual = actualRaw === "" ? null : Number(actualRaw);
    onSave({
      ...item,
      title,
      place: picked ?? (title === item.title ? item.place : undefined),
      category: String(f.get("category")),
      date: String(f.get("date") ?? ""),
      time: String(f.get("time") ?? ""),
      location: String(f.get("location")).trim(),
      estimatedCost: Number(f.get("estimatedCost")) || 0,
      actualCost: actual === null || Number.isNaN(actual) ? null : actual,
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
  const country = getCountry(trip.country);
  const infoP = track(getPlaceInfo({ title: item.title, place: item.place, countryCode: country?.code }));
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
    : mapsLink({ name: data?.name || item.title, area: data?.area || item.location, country: getCountry(trip.country)?.name });

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
        `We couldn't find "${item.title}" on the map. Edit it and pick it from the suggestions to get its info.`),
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
      r.planned, r.spent, r.projected, r.bar);
  });

  refs.perPerson = h("p", { class: "muted" });
  refs.foot = { budget: h("td", { class: "num" }), planned: h("td", { class: "r num" }), spent: h("td", { class: "r num" }), projected: h("td", { class: "r num" }) };

  const view = h("div", { class: "stack" },
    h("div", { class: "stats" },
      stat("budget"), stat("expected", "Paid amounts, plus estimates for the rest"), stat("paid"), stat("left")),
    refs.perPerson,
    h("div", { class: "card table-wrap" },
      h("table", { class: "budget" },
        h("thead", null, h("tr", null,
          h("th", null, "Category"), h("th", null, "Budget limit"), h("th", { class: "r" }, "Estimated"),
          h("th", { class: "r" }, "Paid"), h("th", { class: "r" }, "Expected"), h("th", null, h("span", { class: "sr-only" }, "Progress")))),
        h("tbody", null, rows),
        h("tfoot", null, h("tr", null,
          h("td", null, "Total"), refs.foot.budget, refs.foot.planned, refs.foot.spent, refs.foot.projected, h("td", null))))),
    h("p", { class: "small muted" }, "Expected uses what you actually paid where you've entered it, and the estimate for everything else."),
    rateNote(trip),
    days.length > 0 && h("section", null,
      h("h3", null, "By day"),
      (() => {
        const s = summarizeBudget(current, days.length);
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
    const s = summarizeBudget(current, days.length);
    const hasBudget = s.totalBudget > 0;
    const over = hasBudget && s.remaining < 0;
    setStat("budget", "Budget", hasBudget ? money(s.totalBudget) : "Not set", "", s.totalBudget);
    setStat("expected", "Expected total", money(s.totalProjected), "", s.totalProjected);
    setStat("paid", "Paid so far", money(s.totalSpent), "", s.totalSpent);
    setStat("left", over ? "Over budget" : "Left to spend", hasBudget ? money(Math.abs(s.remaining)) : "Not set", over ? "bad" : hasBudget ? "good" : "", hasBudget ? Math.abs(s.remaining) : 0);
    const both = (n) => money(n) + (homeText(n, current.currency) ? ` (${homeText(n, current.currency)})` : "");
    refs.perPerson.textContent = `${both(s.projectedPerPerson)} per person (${plural(current.travelers, "traveler")})` +
      (s.projectedPerDay !== null ? ` · ${both(s.projectedPerDay)} per day` : "");
    for (const c of s.categories) {
      const r = refs.cats[c.category];
      const isOver = c.budget !== null && c.projected > c.budget;
      setAlt(r.limitAlt, c.budget ?? 0);
      r.planned.textContent = money(c.planned);
      r.spent.textContent = money(c.spent);
      r.projected.replaceChildren(money(c.projected), alt(c.projected, current.currency) ?? "");
      r.projected.className = `r num ${isOver ? "bad strong" : ""}`;
      r.bar.replaceChildren(c.budget
        ? h("div", { class: "bar", title: `${Math.round((c.projected / c.budget) * 100)}% of budget` },
            h("div", { class: isOver ? "over" : "", style: `width:${Math.min(100, (c.projected / c.budget) * 100)}%` }))
        : "");
    }
    refs.foot.budget.textContent = hasBudget ? money(s.totalBudget) : "";
    refs.foot.planned.textContent = money(s.totalPlanned);
    refs.foot.spent.textContent = money(s.totalSpent);
    refs.foot.projected.replaceChildren(money(s.totalProjected), alt(s.totalProjected, current.currency) ?? "");
  }

  update();
  return view;
}

updateHomeButton();
render();
loadRates();
