// Friendlier date and time pickers. Every <input type="date"> and <input type="time"> on the page
// is turned into a button that opens a small calendar or time panel (a sheet on phones). The input
// itself stays in the form as a hidden field, so FormData, .value and "input"/"change" listeners
// keep working as before. Setting .value from code updates the button too.

const RANGE_PAIRS = { endDate: ["startDate", "date"], checkOut: ["checkIn"] };
const ENDS_OF = { startDate: "endDate", date: "endDate", checkIn: "checkOut" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const QUICK_TIMES = [["Morning", "09:00"], ["Noon", "12:00"], ["Afternoon", "15:00"], ["Evening", "19:00"]];

const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? new Date(`${s}T00:00:00`) : null);
const nice = (s) => parse(s)?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) ?? "";

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

/* ---------- the floating panel (one at a time) ---------- */

let open = null; // { panel, backdrop, anchor, onClose }

function closePanel() {
  if (!open) return;
  const { panel, backdrop, anchor, onClose } = open;
  open = null;
  panel.remove();
  backdrop.remove();
  anchor.setAttribute("aria-expanded", "false");
  onClose?.();
}

function showPanel(anchor, panel, onClose) {
  closePanel();
  const sheet = window.matchMedia("(max-width: 640px)").matches;
  const backdrop = el("div", { class: `pk-backdrop${sheet ? " dim" : ""}`, onclick: () => closePanel() });
  panel.classList.toggle("sheet", sheet);
  document.body.append(backdrop, panel);
  if (!sheet) {
    const r = anchor.getBoundingClientRect();
    const w = panel.offsetWidth, hgt = panel.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const below = r.bottom + 6 + hgt < window.innerHeight || r.top < hgt + 12;
    panel.style.left = `${left}px`;
    panel.style.top = `${below ? r.bottom + 6 : r.top - hgt - 6}px`;
  }
  anchor.setAttribute("aria-expanded", "true");
  open = { panel, backdrop, anchor, onClose };
  panel.querySelector(".pk-focus, button")?.focus();
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { const a = open.anchor; closePanel(); a.focus(); } });
window.addEventListener("resize", () => { if (open && !open.panel.classList.contains("sheet")) closePanel(); });
window.addEventListener("hashchange", closePanel);

/* ---------- shared: hide the real input, show a button, keep both in sync ---------- */

function wrap(input, kind, label) {
  input.type = "hidden"; // set before anything else so the browser forgets the native picker
  const text = el("span", { class: "pk-text" });
  const btn = el("button", { type: "button", class: `pk-btn pk-${kind}`, "aria-haspopup": "dialog", "aria-expanded": "false" },
    el("span", { class: "pk-icon", "aria-hidden": "true" }, kind === "date" ? "📅" : "🕒"), text);
  const show = () => {
    const v = valueDesc.get.call(input);
    text.textContent = v ? label(v) : (input.dataset.placeholder || (kind === "date" ? "Pick a date" : "Add a time"));
    btn.classList.toggle("empty", !v);
  };
  Object.defineProperty(input, "value", {
    configurable: true,
    get() { return valueDesc.get.call(this); },
    set(v) { valueDesc.set.call(this, v); show(); },
  });
  input.after(btn);
  input.pkButton = btn;
  show();
  const set = (v) => {
    if (valueDesc.get.call(input) === v) return;
    input.value = v;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  // A <label> around the field would otherwise send its click to the hidden input.
  btn.addEventListener("click", (e) => e.preventDefault(), true);
  return { btn, set };
}

/* ---------- dates ---------- */

const partner = (input, names) => {
  const scope = input.form ?? input.closest("form, .schedule-row, .card") ?? document;
  for (const n of names ?? []) { const p = scope.querySelector(`input[name="${n}"]`); if (p && p !== input) return p; }
  return null;
};

function enhanceDate(input) {
  const required = input.required;
  const { btn, set } = wrap(input, "date", nice);
  const startOf = () => partner(input, RANGE_PAIRS[input.name]);      // when this is an end date
  const endOf = () => partner(input, [ENDS_OF[input.name]]);           // when this is a start date
  btn.addEventListener("click", () => {
    const start = startOf(), end = endOf();
    const range = start ? { from: start.value, to: input.value } : end ? { from: input.value, to: end.value } : null;
    const min = start?.value || input.getAttribute("min") || "";
    const max = input.getAttribute("max") || "";
    let shown = parse(input.value) ?? parse(start?.value) ?? parse(end?.value) ?? parse(min) ?? new Date();
    shown = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const panel = el("div", { class: "pk-panel pk-cal", role: "dialog", "aria-label": "Pick a date" });
    const draw = () => {
      const y = shown.getFullYear(), m = shown.getMonth();
      const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
      const count = new Date(y, m + 1, 0).getDate();
      const today = iso(new Date());
      const cells = [];
      for (let i = 0; i < first; i++) cells.push(el("span"));
      for (let d = 1; d <= count; d++) {
        const v = iso(new Date(y, m, d));
        const inRange = range && range.from && range.to && v > range.from && v < range.to;
        const edge = range && (v === range.from || v === range.to);
        cells.push(el("button", {
          type: "button",
          class: ["pk-day", v === input.value && "picked", edge && "edge", inRange && "between", v === today && "today"].filter(Boolean).join(" "),
          disabled: Boolean((min && v < min) || (max && v > max)),
          "aria-label": nice(v), "aria-pressed": String(v === input.value),
          onclick: () => {
            set(v);
            closePanel();
            // Start then end: after a start date, go straight to its end date.
            const e = endOf();
            if (e?.pkButton && (!e.value || e.value < v)) { if (e.value && e.value < v) e.pkButton.pk.set(""); setTimeout(() => e.pkButton.click(), 0); }
            else btn.focus();
          },
        }, String(d)));
      }
      panel.replaceChildren(...[
        el("div", { class: "pk-head" },
          el("button", { type: "button", class: "pk-nav", "aria-label": "Previous month", onclick: () => { shown = new Date(y, m - 1, 1); draw(); } }, "‹"),
          el("strong", null, `${MONTHS[m]} ${y}`),
          el("button", { type: "button", class: "pk-nav", "aria-label": "Next month", onclick: () => { shown = new Date(y, m + 1, 1); draw(); } }, "›")),
        start && el("p", { class: "pk-hint" }, `Pick the end date${start.value ? ` (from ${nice(start.value)})` : ""}`),
        end && el("p", { class: "pk-hint" }, "Pick the start date, then the end date"),
        el("div", { class: "pk-grid pk-week" }, WEEKDAYS.map((w) => el("span", null, w))),
        el("div", { class: "pk-grid" }, cells),
        el("div", { class: "pk-foot" },
          !required && input.value && el("button", { type: "button", class: "pk-link", onclick: () => { set(""); closePanel(); btn.focus(); } }, "Clear"),
          el("button", { type: "button", class: "pk-link push", onclick: () => { closePanel(); btn.focus(); } }, "Close"))].filter(Boolean)); // replaceChildren would print null
    };
    draw();
    showPanel(btn, panel);
    panel.querySelector(".pk-day.picked, .pk-day.today:not([disabled]), .pk-day:not([disabled])")?.classList.add("pk-focus");
    panel.querySelector(".pk-focus")?.focus();
  });
  btn.pk = { set };
}

/* ---------- times (24-hour, as the app shows them) ---------- */

function enhanceTime(input) {
  const { btn, set } = wrap(input, "time", (v) => v);
  btn.addEventListener("click", () => {
    const panel = el("div", { class: "pk-panel pk-time", role: "dialog", "aria-label": "Pick a time" });
    const draw = () => {
      const [hh, mm] = (input.value || "").split(":");
      const pick = (h, m) => { set(`${h}:${m}`); draw(); };
      panel.replaceChildren(
        el("div", { class: "pk-head" }, el("strong", { class: "pk-now num" }, input.value || "--:--")),
        el("div", { class: "pk-quick" }, QUICK_TIMES.map(([name, t]) =>
          el("button", { type: "button", class: `chip small${input.value === t ? " active" : ""}`, onclick: () => { set(t); closePanel(); btn.focus(); } }, `${name} `, el("span", { class: "muted num" }, t)))),
        el("p", { class: "pk-label" }, "Hour"),
        el("div", { class: "pk-hours" }, Array.from({ length: 24 }, (_, h) => pad(h)).map((h) =>
          el("button", { type: "button", class: `pk-cell num${h === hh ? " picked" : ""}`, onclick: () => pick(h, mm || "00") }, h))),
        el("p", { class: "pk-label" }, "Minute"),
        el("div", { class: "pk-mins" }, Array.from({ length: 12 }, (_, i) => pad(i * 5)).map((m) =>
          el("button", { type: "button", class: `pk-cell num${m === mm ? " picked" : ""}`, onclick: () => { pick(hh || "09", m); } }, `:${m}`))),
        el("div", { class: "pk-foot" },
          input.value && !input.required && el("button", { type: "button", class: "pk-link", onclick: () => { set(""); closePanel(); btn.focus(); } }, "Clear"),
          el("button", { type: "button", class: "btn primary small push", onclick: () => { closePanel(); btn.focus(); } }, "Done")));
      panel.querySelector(".pk-hours .picked, .pk-hours button")?.classList.add("pk-focus");
    };
    draw();
    showPanel(btn, panel);
  });
}

/* ---------- apply to everything, now and as the page redraws ---------- */

export function enhancePickers(root = document) {
  for (const input of root.querySelectorAll('input[type="date"]')) enhanceDate(input);
  for (const input of root.querySelectorAll('input[type="time"]')) enhanceTime(input);
}

export function watchPickers(root) {
  enhancePickers(root);
  new MutationObserver((records) => {
    if (records.some((r) => r.addedNodes.length)) enhancePickers(root);
  }).observe(root, { childList: true, subtree: true });
}
