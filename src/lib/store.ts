"use client";

import { useSyncExternalStore } from "react";
import type { Trip } from "./types";

const KEY = "travelcompanion:trips:v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; trips: Trip[] } | null = null;

function read(): Trip[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // storage blocked (private mode etc.): fall back to in-memory only
    return cache?.trips ?? [];
  }
  if (cache && cache.raw === raw) return cache.trips;
  let trips: Trip[] = [];
  try {
    trips = raw ? (JSON.parse(raw) as Trip[]) : [];
  } catch {
    trips = [];
  }
  cache = { raw, trips };
  return trips;
}

function write(trips: Trip[]) {
  const raw = JSON.stringify(trips);
  cache = { raw, trips };
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // ignore; data stays in memory for this session
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** All saved trips, or null while rendering on the server (before localStorage is available). */
export function useTrips(): Trip[] | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function saveTrip(trip: Trip) {
  const trips = read();
  const updated = { ...trip, updatedAt: new Date().toISOString() };
  const idx = trips.findIndex((t) => t.id === trip.id);
  write(idx === -1 ? [...trips, updated] : trips.map((t) => (t.id === trip.id ? updated : t)));
}

export function deleteTrip(id: string) {
  write(read().filter((t) => t.id !== id));
}
