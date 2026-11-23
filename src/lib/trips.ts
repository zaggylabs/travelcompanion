import { newId } from "./ids";
import type { ItineraryItem, Trip } from "./types";

export function emptyTrip(): Trip {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "",
    destination: "",
    startDate: "",
    endDate: "",
    currency: "USD",
    travelers: 1,
    budget: {},
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyItem(date = ""): ItineraryItem {
  return {
    id: newId(),
    date,
    time: "",
    title: "",
    location: "",
    category: "Activities",
    estimatedCost: 0,
    actualCost: null,
    notes: "",
    link: "",
  };
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    if (!a.time && b.time) return 1;
    if (a.time && !b.time) return -1;
    return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
  });
}
