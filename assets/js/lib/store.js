// Trips live in this browser's localStorage. No accounts yet.
const KEY = "travelcompanion:trips:v1";
let memory = null; // used if storage is blocked (private mode etc.)

export function loadTrips() {
  try {
    const raw = localStorage.getItem(KEY);
    const trips = raw ? JSON.parse(raw) : [];
    return Array.isArray(trips) ? trips : [];
  } catch {
    return memory ?? [];
  }
}

function writeTrips(trips) {
  memory = trips;
  try {
    localStorage.setItem(KEY, JSON.stringify(trips));
  } catch {
    // keep in memory for this visit
  }
}

export function saveTrip(trip) {
  const trips = loadTrips();
  const updated = { ...trip, updatedAt: new Date().toISOString() };
  const idx = trips.findIndex((t) => t.id === trip.id);
  writeTrips(idx === -1 ? [...trips, updated] : trips.map((t) => (t.id === trip.id ? updated : t)));
}

export function deleteTrip(id) {
  writeTrips(loadTrips().filter((t) => t.id !== id));
}

export const STORAGE_KEY = KEY;
