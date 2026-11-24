// Saved places: a per-trip scratchpad of places you might go, grouped by type,
// that can each be turned into an itinerary plan on a chosen day and time.
import { newId } from "./constants.js";

/** The groups shown in the Saved places tab, and the budget category a plan made from each gets. */
export const IDEA_GROUPS = [
  { key: "Food", label: "Food and drinks", category: "Food" },
  { key: "Sights", label: "Places to see", category: "Activities" },
  { key: "Activities", label: "Things to do", category: "Activities" },
  { key: "Shopping", label: "Shopping", category: "Shopping" },
  { key: "Stays", label: "Places to stay", category: "Lodging" },
  { key: "Other", label: "Other", category: "Other" },
];
const BY_KEY = Object.fromEntries(IDEA_GROUPS.map((g) => [g.key, g]));
export const groupOf = (key) => BY_KEY[key] ?? BY_KEY.Other;

// OSM kinds (Photon's osm_value, spaces for underscores) that are things to do rather than things to look at.
const DOING = new Set(["theme park", "zoo", "aquarium", "water park", "stadium", "theatre", "cinema", "sports centre", "golf course", "escape game", "spa", "ski", "swimming pool", "bowling alley", "karaoke box"]);

/** The best group for a place picked from the suggestions, or null to leave the user's choice alone. */
export function groupForPlace(p) {
  if (!p) return null;
  if (p.category === "Food") return "Food";
  if (p.category === "Shopping") return "Shopping";
  if (p.category === "Lodging") return "Stays";
  if (DOING.has(p.kind)) return "Activities";
  if (p.category === "Activities") return "Sights";
  if (["city", "town", "village", "suburb", "quarter", "neighbourhood", "island", "tower", "bridge", "place of worship"].includes(p.kind)) return "Sights";
  return null;
}

export function emptyIdea(group = "Food") {
  return { id: newId(), title: "", group, location: "", link: "", bookingLink: "", notes: "", place: undefined, createdAt: new Date().toISOString() };
}

/** A new itinerary plan made from a saved place. */
export function ideaToItem(idea, date, time) {
  return {
    id: newId(),
    date: date || "",
    time: time || "",
    title: idea.title,
    location: idea.location || "",
    category: groupOf(idea.group).category,
    estimatedCost: 0,
    actualCost: null,
    notes: idea.notes || "",
    link: idea.bookingLink || idea.link || "", // the booking page is more useful on a plan than a map search
    ...(idea.place ? { place: { name: idea.title, ...idea.place } } : {}),
    fromIdea: idea.id,
  };
}

/**
 * Saved places in display order: groups in IDEA_GROUPS order (empty ones left out),
 * and inside each group the ones not yet on the itinerary first, then by when they were saved.
 * `isAdded(idea)` says whether it's on the itinerary now (plans made from it carry `fromIdea`).
 */
export function groupIdeas(ideas, isAdded = () => false) {
  return IDEA_GROUPS.map((g) => ({
    ...g,
    ideas: (ideas ?? [])
      .filter((i) => groupOf(i.group).key === g.key)
      .map((i, n) => ({ i, n, added: isAdded(i) }))
      .sort((a, b) => Number(a.added) - Number(b.added) || a.n - b.n)
      .map((x) => x.i),
  })).filter((g) => g.ideas.length);
}

/* ----- sub-tabs, each kind's own details, and what they cost ----- */

/** The Saved places sub-tabs. Each holds one or more groups; new places in a tab get its first group. */
export const IDEA_TABS = [
  { key: "Stays", label: "Hotels", icon: "🏨", add: "Add hotel", groups: ["Stays"], links: true },
  { key: "Activities", label: "Activities", icon: "🎟️", add: "Add activity", groups: ["Activities"], links: true },
  { key: "Food", label: "Food", icon: "🍜", add: "Add food spot", groups: ["Food"], links: false },
  { key: "Sights", label: "Places", icon: "📍", add: "Add place", groups: ["Sights"], links: false },
  { key: "Other", label: "Other", icon: "🛍️", add: "Add other", groups: ["Other", "Shopping"], links: true },
];
export const tabOf = (group) => IDEA_TABS.find((t) => t.groups.includes(groupOf(group).key)) ?? IDEA_TABS[IDEA_TABS.length - 1];

export const PRICE_RANGES = [["$", "$ · cheap eats"], ["$$", "$$ · mid-range"], ["$$$", "$$$ · pricey"], ["$$$$", "$$$$ · splurge"]];

/** Nights between two YYYY-MM-DD dates (0 when either is missing or out of order). */
export function nightsBetween(checkIn, checkOut) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut ?? "")) return 0;
  const n = Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
  return n > 0 ? n : 0;
}

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * What a saved place costs in total, from its kind's details (`idea.info`):
 * hotels: total, else price per night × nights; activities: total, else price per person × people;
 * places: entry fee × people; other: cost. Food has a price range, not an amount, so 0.
 */
export function ideaCost(idea) {
  const i = idea?.info ?? {};
  switch (tabOf(idea?.group).key) {
    case "Stays": return pos(i.total) || r2(pos(i.pricePerNight) * nightsBetween(i.checkIn, i.checkOut));
    case "Activities": return pos(i.total) || r2(pos(i.pricePerPerson) * (pos(i.people) || 1));
    case "Sights": return r2(pos(i.entryFee) * (pos(i.people) || 1));
    case "Other": return pos(i.cost);
    default: return 0;
  }
}

/** A short note for the plan: confirmation number, cuisine, dietary tags, hours, the place's own note. */
function planNotes(idea) {
  const i = idea.info ?? {};
  return [
    i.confirmation && `Confirmation: ${i.confirmation}`,
    i.cuisine, i.priceRange, ...(i.diets ?? []),
    i.duration && `Takes ${i.duration}`,
    i.hours && `Hours: ${i.hours}`,
    idea.notes,
  ].filter(Boolean).join(" · ");
}

/**
 * The plans a saved place becomes on the itinerary.
 * Hotels: a check-in plan carrying the whole stay's cost, and a check-out plan.
 * Everything else: one plan on `date` at `time`, carrying its cost.
 * `when` = { date, time } or, for hotels, { checkIn, checkInTime, checkOut, checkOutTime }.
 */
export function ideaToItems(idea, when = {}) {
  const i = idea.info ?? {};
  const cost = ideaCost(idea);
  const money = { estimatedCost: cost, actualCost: null, ...(cost > 0 && i.paid ? { paid: true } : {}), ...(i.currency ? { currency: i.currency } : {}) };
  const notes = planNotes(idea);
  if (tabOf(idea.group).key === "Stays") {
    const nights = nightsBetween(when.checkIn, when.checkOut);
    const stay = { ...ideaToItem(idea, when.checkIn, when.checkInTime), ...money, title: `Check in: ${idea.title}`, notes: [nights && `${nights} night${nights === 1 ? "" : "s"}`, notes].filter(Boolean).join(" · ") };
    if (!when.checkOut) return [stay];
    const out = { ...ideaToItem(idea, when.checkOut, when.checkOutTime), title: `Check out: ${idea.title}`, notes: "" };
    return [stay, out];
  }
  return [{ ...ideaToItem(idea, when.date, when.time), ...money, notes }];
}
