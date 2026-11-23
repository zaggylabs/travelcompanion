// A small accessible autocomplete for a text input: a dropdown of suggestions
// you can click or pick with the arrow keys and Enter. Enter with nothing
// highlighted still submits the form as normal.
let uid = 0;

/**
 * @param {HTMLInputElement} input
 * @param {{
 *   search: (query: string, signal: AbortSignal) => Promise<any[]> | any[],
 *   renderItem: (item: any) => (Node | string)[],
 *   onPick: (item: any) => void,
 *   delay?: number,          // debounce in ms (0 for local lists)
 *   footer?: () => Node,     // e.g. data attribution
 *   emptyText?: (query: string) => string | null,
 * }} opts
 * @returns {{ el: HTMLElement, close: () => void }} put `el` in the page where the input should go
 */
export function autocomplete(input, opts) {
  const id = `ac-${++uid}`;
  const list = document.createElement("ul");
  list.className = "ac-list";
  list.id = id;
  list.setAttribute("role", "listbox");
  list.hidden = true;

  const wrap = document.createElement("div");
  wrap.className = "ac";
  wrap.append(input, list);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", id);
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("autocomplete", "off");

  let items = [];
  let active = -1;
  let timer = null;
  let controller = null;
  let lastQuery = null;

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function setActive(i) {
    active = i;
    [...list.querySelectorAll("[role=option]")].forEach((el, n) => el.setAttribute("aria-selected", String(n === i)));
    if (i >= 0) {
      input.setAttribute("aria-activedescendant", `${id}-${i}`);
      list.querySelector(`#${id}-${i}`)?.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }

  function show(rows, status) {
    list.replaceChildren();
    items = rows;
    active = -1;
    rows.forEach((item, i) => {
      const li = document.createElement("li");
      li.id = `${id}-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.className = "ac-item";
      li.append(...opts.renderItem(item));
      // mousedown, not click, so the input doesn't blur and close the list first.
      li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
      li.addEventListener("mousemove", () => { if (active !== i) setActive(i); });
      list.append(li);
    });
    if (status) {
      const li = document.createElement("li");
      li.className = "ac-status small muted";
      li.textContent = status;
      list.append(li);
    }
    if (rows.length && opts.footer) {
      const li = document.createElement("li");
      li.className = "ac-foot";
      li.append(opts.footer());
      list.append(li);
    }
    const open = rows.length > 0 || Boolean(status);
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  }

  function pick(i) {
    const item = items[i];
    if (!item) return;
    close();
    lastQuery = null;
    opts.onPick(item);
  }

  async function run(query) {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    try {
      const rows = await opts.search(query, signal);
      if (signal.aborted || input.value !== query || document.activeElement !== input) return;
      show(rows, rows.length ? null : opts.emptyText?.(query) ?? null);
    } catch (err) {
      if (signal.aborted || err?.name === "AbortError") return;
      show([], "Suggestions aren't available right now. You can still type it in.");
    }
  }

  input.addEventListener("input", () => {
    const query = input.value;
    clearTimeout(timer);
    if (query === lastQuery) return;
    lastQuery = query;
    if (!query.trim()) { controller?.abort(); close(); return; }
    if (opts.delay) timer = setTimeout(() => run(query), opts.delay);
    else run(query);
  });

  input.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active <= 0 ? items.length - 1 : active - 1); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab" && active >= 0) pick(active);
  });

  input.addEventListener("blur", () => { clearTimeout(timer); controller?.abort(); close(); });

  return { el: wrap, close };
}
