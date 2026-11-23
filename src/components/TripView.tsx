"use client";

import { useRef, useState } from "react";
import { csvToItems, itemsToCsv } from "@/lib/csv";
import { daysBetween, formatDay } from "@/lib/dates";
import { openTrip } from "@/lib/hash";
import { deleteTrip, saveTrip } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { BudgetView } from "./BudgetView";
import { ItineraryView } from "./ItineraryView";
import { TripForm } from "./TripForm";
import { Button, Card } from "./ui";

type Tab = "itinerary" | "budget";

export function TripView({ trip }: { trip: Trip }) {
  const [tab, setTab] = useState<Tab>("itinerary");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const days = daysBetween(trip.startDate, trip.endDate);

  function exportCsv() {
    const blob = new Blob([itemsToCsv(trip.items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "trip"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const { items, skipped, matchedColumns } = csvToItems(await file.text());
    if (items.length === 0) {
      setNotice(
        matchedColumns.length === 0
          ? "Couldn't find any columns we recognize. The first row should have headers like Date, Activity, Cost."
          : "No rows with a title or activity were found in that file.",
      );
      return;
    }
    // If the trip has no dates yet, take them from the imported rows.
    const dated = items.map((i) => i.date).filter(Boolean).sort();
    const patch =
      !trip.startDate && !trip.endDate && dated.length ? { startDate: dated[0], endDate: dated[dated.length - 1] } : {};
    saveTrip({ ...trip, ...patch, items: [...trip.items, ...items] });
    setNotice(`Imported ${items.length} plan${items.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} empty row${skipped === 1 ? "" : "s"}` : ""}.`);
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => openTrip(null)} className="text-sm text-subtle hover:text-foreground">
        ← All trips
      </button>

      {editing ? (
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Edit trip</h2>
          <TripForm
            initial={trip}
            submitLabel="Save"
            onCancel={() => setEditing(false)}
            onSubmit={(t) => {
              saveTrip(t);
              setEditing(false);
            }}
          />
          <div className="mt-4 border-t border-line pt-3">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                Delete this trip and all its plans? This can&apos;t be undone.
                <Button
                  variant="danger"
                  onClick={() => {
                    deleteTrip(trip.id);
                    openTrip(null);
                  }}
                >
                  Yes, delete
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete trip
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
            <p className="text-sm text-subtle">
              {[
                trip.destination,
                days.length ? `${formatDay(days[0])} to ${formatDay(days[days.length - 1])} · ${days.length} days` : "Dates not set",
                `${trip.travelers} traveler${trip.travelers === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>Edit trip</Button>
            <Button onClick={() => fileRef.current?.click()} title="Import rows from a CSV file (in Excel: File > Save As > CSV)">
              Import CSV
            </Button>
            <Button onClick={exportCsv} disabled={trip.items.length === 0} title="Download as CSV, opens in Excel or Google Sheets">
              Export CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="CSV file to import"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div role="tablist" className="flex gap-1 border-b border-line">
        {(["itinerary", "budget"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-teal-600 text-foreground" : "border-transparent text-subtle hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "itinerary" ? (
        <ItineraryView trip={trip} days={days} onChange={(items) => saveTrip({ ...trip, items })} />
      ) : (
        <BudgetView trip={trip} days={days} onBudgetChange={(budget) => saveTrip({ ...trip, budget })} />
      )}
    </div>
  );
}
