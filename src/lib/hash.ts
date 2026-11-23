"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** The id after "#trip/" in the URL, so the back button and bookmarks work. */
export function useSelectedTripId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const m = window.location.hash.match(/^#trip\/(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    },
    () => null,
  );
}

export function openTrip(id: string | null) {
  window.location.hash = id ? `trip/${encodeURIComponent(id)}` : "";
}
