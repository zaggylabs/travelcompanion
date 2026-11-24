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
