"use client";

import { openTrip, useSelectedTripId } from "@/lib/hash";
import { useTrips } from "@/lib/store";
import { TripList } from "./TripList";
import { TripView } from "./TripView";

export function App() {
  const trips = useTrips();
  const selectedId = useSelectedTripId();
  const selected = trips?.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => openTrip(null)}
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-teal-600 text-sm text-white">
              ✈
            </span>
            TravelCompanion
          </button>
          <span className="ml-auto hidden text-xs text-subtle sm:block">Saved in this browser</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {trips === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" aria-label="Loading" />
        ) : selected ? (
          <TripView key={selected.id} trip={selected} />
        ) : (
          <TripList trips={trips} />
        )}
      </main>
    </div>
  );
}
