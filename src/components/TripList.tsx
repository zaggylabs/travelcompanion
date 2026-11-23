"use client";

import { useState } from "react";
import { summarizeBudget } from "@/lib/budget";
import { daysBetween, formatDay } from "@/lib/dates";
import { openTrip } from "@/lib/hash";
import { formatMoney } from "@/lib/money";
import { saveTrip } from "@/lib/store";
import { emptyTrip } from "@/lib/trips";
import type { Trip } from "@/lib/types";
import { TripForm } from "./TripForm";
import { Button, Card } from "./ui";

export function TripList({ trips }: { trips: Trip[] }) {
  const [creating, setCreating] = useState(trips.length === 0);
  const sorted = [...trips].sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
          <p className="text-sm text-subtle">Plan each day, track what it costs, and ditch the spreadsheet.</p>
        </div>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            + New trip
          </Button>
        )}
      </div>

      {creating && (
        <Card className="p-4">
          <h2 className="mb-3 font-medium">New trip</h2>
          <TripForm
            initial={emptyTrip()}
            submitLabel="Create trip"
            onCancel={() => setCreating(false)}
            onSubmit={(trip) => {
              saveTrip(trip);
              setCreating(false);
              openTrip(trip.id);
            }}
          />
        </Card>
      )}

      {sorted.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((trip) => {
            const days = daysBetween(trip.startDate, trip.endDate).length;
            const s = summarizeBudget(trip, days);
            return (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => openTrip(trip.id)}
                  className="block h-full w-full rounded-xl border border-line bg-surface p-4 text-left transition hover:border-teal-600/60 hover:shadow-sm"
                >
                  <div className="font-medium">{trip.name}</div>
                  <div className="text-sm text-subtle">{trip.destination || "No destination yet"}</div>
                  <div className="mt-3 text-xs text-subtle">
                    {trip.startDate && trip.endDate
                      ? `${formatDay(trip.startDate)} to ${formatDay(trip.endDate)} · ${days} day${days === 1 ? "" : "s"}`
                      : "Dates not set"}
                  </div>
                  <div className="mt-1 text-xs text-subtle">
                    {trip.items.length} plan{trip.items.length === 1 ? "" : "s"} · {formatMoney(s.totalProjected, trip.currency)}
                    {s.totalBudget > 0 && ` of ${formatMoney(s.totalBudget, trip.currency)}`}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !creating && (
          <Card className="p-8 text-center text-sm text-subtle">No trips yet. Create one to get started.</Card>
        )
      )}
    </div>
  );
}
