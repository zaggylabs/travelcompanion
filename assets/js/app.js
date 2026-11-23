import { CATEGORIES, CURRENCIES, newId } from "./lib/constants.js";
import { daysBetween, formatDay } from "./lib/dates.js";
import { formatMoney } from "./lib/money.js";
import { expectedCost, summarizeBudget } from "./lib/budget.js";
import { csvToItems, itemsToCsv } from "./lib/csv.js";
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
};

function currentTripId() {
  const m = location.hash.match(/^#trip\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function openTrip(id) {
  Object.assign(ui, { tab: "itinerary", editingTrip: false, confirmDelete: false, editingItem: null, notice: null, attachOpen: null, attachError: null, confirmRemoveFile: null });
  location.hash = id ? `trip/${encodeURIComponent(id)}` : "";
  if (!id) history.replaceState(null, "", location.pathname + location.search);
  render();
}

function emptyTrip() {
  const now = new Date().toISOString();
  return {
    id: newId(), name: "", destination: "", startDate: "", endDate: "",
    currency: "SGD", travelers: 1, budget: {}, items: [], createdAt: now, updatedAt: now,
  };
}

function emptyItem(date) {
  return {
    id: newId(), date: date || "", time: "", title: "", location: "", category: "Activities",
    estimatedCost: 0, actualCost: null, notes: "", link: "",
  };
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (!a.time && b.time) return 1;
    if (a.time && !b.time) return -1;
    return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
  });
}

/* ---------- rendering ---------- */

const root = document.getElementById("app");

function render() {
  revokeFileUrls();
  const trips = loadTrips();
  const id = currentTripId();
  const trip = trips.find((t) => t.id === id);
  root.replaceChildren(trip ? tripView(trip) : tripList(trips));
  root.querySelector("[autofocus]")?.focus();
}

window.addEventListener("hashchange", render);
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) render();
});

/* ----- trip list ----- */

function tripList(trips) {
  const creating = ui.creatingTrip ?? trips.length === 0;
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
            h("span", { class: "muted" }, t.destination || "No destination yet"),
            h("span", { class: "small muted" }, t.startDate && t.endDate
              ? `${formatDay(t.startDate)} to ${formatDay(t.endDate)} · ${plural(days, "day")}`
              : "Dates not set"),
            h("span", { class: "small muted" },
              `${plural(t.items.length, "plan")} · ${formatMoney(s.totalProjected, t.currency)}`,
              s.totalBudget > 0 ? ` of ${formatMoney(s.totalBudget, t.currency)}` : "")));
        }))
      : !creating && h("p", { class: "card pad center muted" }, "No trips yet. Create one to get started."));
}

function field(label, control, cls) {
  return h("label", { class: `field ${cls || ""}` }, h("span", null, label), control);
}

function tripForm(initial, submitLabel, onSubmit, onCancel) {
  const currencies = CURRENCIES.includes(initial.currency) ? CURRENCIES : [initial.currency, ...CURRENCIES];
  const error = h("p", { class: "error", hidden: true }, "The end date is before the start date.");
  const form = h("form", { class: "form-grid two" },
    field("Trip name", h("input", { name: "name", required: true, autofocus: true, placeholder: "Bali with the family", value: initial.name }), "span-all"),
    field("Destination", h("input", { name: "destination", placeholder: "Ubud & Seminyak", value: initial.destination })),
    h("div", { class: "form-grid two tight" },
      field("Currency", h("select", { name: "currency" }, currencies.map((c) => h("option", { selected: c === initial.currency }, c)))),
      field("Travelers", h("input", { name: "travelers", type: "number", min: 1, value: initial.travelers }))),
    field("Start date", h("input", { name: "startDate", type: "date", value: initial.startDate })),
    field("End date", h("input", { name: "endDate", type: "date", value: initial.endDate })),
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
            trip.destination,
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
    h("div", { class: "tabs", role: "tablist" }, ["itinerary", "budget"].map((t) =>
      h("button", { role: "tab", type: "button", "aria-selected": String(ui.tab === t), class: ui.tab === t ? "active" : "",
        onclick: () => { ui.tab = t; ui.editingItem = null; ui.attachOpen = null; render(); } }, t === "itinerary" ? "Itinerary" : "Budget"))),
    ui.tab === "itinerary" ? itineraryView(trip, days) : budgetView(trip, days));
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

  return h("div", { class: "stack" },
    days.length === 0 && h("p", { class: "hint" }, "Set start and end dates in Edit trip to get a day-by-day plan."),
    groups.map((g) => {
      const total = g.items.reduce((a, i) => a + expectedCost(i), 0);
      const e = ui.editingItem;
      return h("section", { class: "day", "aria-label": g.label },
        h("div", { class: "day-head" },
          h("h3", null, g.label), g.sub && h("span", { class: "muted" }, g.sub),
          total > 0 && h("span", { class: "muted num push" }, formatMoney(total, trip.currency))),
        h("ul", { class: "items" },
          g.items.map((item) => h("li", null, e?.mode === "edit" && e.id === item.id
            ? itemForm(item, trip, days, saveItem, cancel, () => {
                saveTrip({ ...trip, items: trip.items.filter((i) => i.id !== item.id) });
                deleteItemFiles(item.id);
                ui.editingItem = null;
                render();
              })
            : [itemRow(item, trip), ui.attachOpen === item.id && attachPanel(item, trip)])),
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

function itemRow(item, trip) {
  const files = item.attachments ?? [];
  const open = ui.attachOpen === item.id;
  return h("div", { class: `item-wrap${open ? " open" : ""}` },
    itemButton(item, trip),
    h("button", {
      class: `attach-btn${files.length ? " has" : ""}`, type: "button",
      "aria-expanded": String(open),
      "aria-label": `Attachments for ${item.title}${files.length ? ` (${files.length})` : ""}`,
      title: files.length ? `${plural(files.length, "attachment")}` : "Attach tickets or files",
      onclick: () => {
        Object.assign(ui, { attachOpen: open ? null : item.id, attachError: null, confirmRemoveFile: null, editingItem: null });
        render();
      },
    }, clipIcon(), files.length ? h("span", { class: "num" }, files.length) : null));
}

function itemButton(item, trip) {
  return h("button", { class: "item", type: "button", onclick: () => { ui.editingItem = { mode: "edit", id: item.id }; ui.attachOpen = null; render(); } },
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
        ? [formatMoney(item.actualCost, trip.currency), h("small", { class: "paid" }, "Paid")]
        : item.estimatedCost > 0 ? [formatMoney(item.estimatedCost, trip.currency), h("small", { class: "muted" }, "Estimate")] : ""));
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

function itemForm(item, trip, days, onSave, onCancel, onDelete) {
  const useSelect = days.length > 0 && (item.date === "" || days.includes(item.date));
  const form = h("form", { class: "card pad form-grid six editing" },
    field("What", h("input", { name: "title", required: true, autofocus: true, placeholder: "Sunset at Uluwatu", value: item.title }), "span-4"),
    field("Category", h("select", { name: "category" }, CATEGORIES.map((c) => h("option", { selected: c === item.category }, c))), "span-2"),
    field("Day", useSelect
      ? h("select", { name: "date" },
          h("option", { value: "", selected: item.date === "" }, "Unscheduled"),
          days.map((d, i) => h("option", { value: d, selected: d === item.date }, `Day ${i + 1} · ${formatDay(d)}`)))
      : h("input", { name: "date", type: "date", value: item.date }), "span-2"),
    field("Time", h("input", { name: "time", type: "time", value: item.time }), "span-1"),
    field("Where", h("input", { name: "location", placeholder: "Address or area", value: item.location }), "span-3"),
    field(`Estimated cost (${trip.currency})`, h("input", { name: "estimatedCost", type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "0", value: item.estimatedCost || "" }), "span-2"),
    field(`Actual cost (${trip.currency})`, h("input", { name: "actualCost", type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "Not paid yet", value: item.actualCost ?? "" }), "span-2"),
    field("Link", h("input", { name: "link", type: "url", placeholder: "https://", value: item.link }), "span-2"),
    field("Notes", h("textarea", { name: "notes", rows: 2 }, item.notes), "span-all"),
    h("div", { class: "actions span-all" },
      h("button", { class: "btn primary", type: "submit" }, "Save"),
      h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"),
      onDelete && h("button", { class: "btn danger push", type: "button", onclick: onDelete }, "Delete")));
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

/* ----- budget ----- */

// The budget tab is built once and then updated in place as limits are typed,
// so typing in one limit box never loses focus or wipes the next one.
function budgetView(trip, days) {
  const money = (n) => formatMoney(n, trip.currency);
  let current = trip;
  const refs = { cats: {} };

  const stat = (key, hint) => {
    refs[key] = { label: h("span", { class: "small muted" }), value: h("strong", { class: "num" }) };
    return h("div", { class: "card stat", title: hint }, refs[key].label, refs[key].value);
  };

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
    });
    const r = {
      planned: h("td", { class: "r num" }),
      spent: h("td", { class: "r num" }),
      projected: h("td", { class: "r num" }),
      bar: h("td", { class: "bar-cell" }),
    };
    refs.cats[category] = r;
    return h("tr", null,
      h("td", null, h("i", { class: `dot cat-${category}` }), category),
      h("td", { class: "limit" }, input),
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
            h("span", { class: "num r" }, money(v)));
        }));
      })()));

  function setStat(key, label, value, tone) {
    refs[key].label.textContent = label;
    refs[key].value.textContent = value;
    refs[key].value.className = `num ${tone || ""}`;
  }

  function update() {
    const s = summarizeBudget(current, days.length);
    const hasBudget = s.totalBudget > 0;
    const over = hasBudget && s.remaining < 0;
    setStat("budget", "Budget", hasBudget ? money(s.totalBudget) : "Not set");
    setStat("expected", "Expected total", money(s.totalProjected));
    setStat("paid", "Paid so far", money(s.totalSpent));
    setStat("left", over ? "Over budget" : "Left to spend", hasBudget ? money(Math.abs(s.remaining)) : "Not set", over ? "bad" : hasBudget ? "good" : "");
    refs.perPerson.textContent = `${money(s.projectedPerPerson)} per person (${plural(current.travelers, "traveler")})` +
      (s.projectedPerDay !== null ? ` · ${money(s.projectedPerDay)} per day` : "");
    for (const c of s.categories) {
      const r = refs.cats[c.category];
      const isOver = c.budget !== null && c.projected > c.budget;
      r.planned.textContent = money(c.planned);
      r.spent.textContent = money(c.spent);
      r.projected.textContent = money(c.projected);
      r.projected.className = `r num ${isOver ? "bad strong" : ""}`;
      r.bar.replaceChildren(c.budget
        ? h("div", { class: "bar", title: `${Math.round((c.projected / c.budget) * 100)}% of budget` },
            h("div", { class: isOver ? "over" : "", style: `width:${Math.min(100, (c.projected / c.budget) * 100)}%` }))
        : "");
    }
    refs.foot.budget.textContent = hasBudget ? money(s.totalBudget) : "";
    refs.foot.planned.textContent = money(s.totalPlanned);
    refs.foot.spent.textContent = money(s.totalSpent);
    refs.foot.projected.textContent = money(s.totalProjected);
  }

  update();
  return view;
}

render();
