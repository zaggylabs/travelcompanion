"use client";

import { useState } from "react";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { emptyItem, sortItems } from "@/lib/trips";
import type { ItineraryItem, Trip } from "@/lib/types";
import { ItemForm } from "./ItemForm";
import { Button } from "./ui";

const CATEGORY_DOT: Record<string, string> = {
  Flights: "bg-sky-500",
  Lodging: "bg-violet-500",
  Transport: "bg-amber-500",
  Food: "bg-rose-500",
  Activities: "bg-teal-500",
  Shopping: "bg-pink-500",
  Other: "bg-slate-400",
};

type Editing = { mode: "new"; date: string } | { mode: "edit"; id: string } | null;

export function ItineraryView({
  trip,
  days,
  onChange,
}: {
  trip: Trip;
  days: string[];
  onChange: (items: ItineraryItem[]) => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const daySet = new Set(days);
  const groups: { key: string; label: string; sub?: string; items: ItineraryItem[] }[] = days.map((d, i) => ({
    key: d,
    label: `Day ${i + 1}`,
    sub: formatDay(d),
    items: sortItems(trip.items.filter((it) => it.date === d)),
  }));
  const outside = trip.items.filter((it) => !daySet.has(it.date));
  const otherDates = [...new Set(outside.map((i) => i.date).filter(Boolean))].sort();
  for (const d of otherDates) {
    groups.push({ key: d, label: formatDay(d), sub: "Outside trip dates", items: sortItems(outside.filter((i) => i.date === d)) });
  }
  groups.push({ key: "", label: "Unscheduled", sub: "Ideas and things without a day yet", items: sortItems(outside.filter((i) => !i.date)) });

  const save = (item: ItineraryItem) => {
    const exists = trip.items.some((i) => i.id === item.id);
    onChange(exists ? trip.items.map((i) => (i.id === item.id ? item : i)) : [...trip.items, item]);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      {days.length === 0 && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-subtle">
          Set start and end dates in Edit trip to get a day-by-day plan.
        </p>
      )}
      {groups.map((g) => {
        const total = g.items.reduce((a, i) => a + (i.actualCost ?? i.estimatedCost), 0);
        return (
          <section key={g.key || "unscheduled"} aria-label={g.label}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="font-semibold">{g.label}</h3>
              {g.sub && <span className="text-sm text-subtle">{g.sub}</span>}
              {total > 0 && <span className="ml-auto text-sm tabular-nums text-subtle">{formatMoney(total, trip.currency)}</span>}
            </div>
            <ul className="space-y-2">
              {g.items.map((item) =>
                editing?.mode === "edit" && editing.id === item.id ? (
                  <li key={item.id}>
                    <ItemForm
                      initial={item}
                      currency={trip.currency}
                      days={days}
                      onSave={save}
                      onCancel={() => setEditing(null)}
                      onDelete={() => {
                        onChange(trip.items.filter((i) => i.id !== item.id));
                        setEditing(null);
                      }}
                    />
                  </li>
                ) : (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ mode: "edit", id: item.id })}
                      className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition hover:border-teal-600/60"
                    >
                      <span className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-subtle">{item.time || "--:--"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                          <span className="inline-flex items-center gap-1">
                            <span className={`size-2 rounded-full ${CATEGORY_DOT[item.category]}`} />
                            {item.category}
                          </span>
                          {item.location && <span className="truncate">{item.location}</span>}
                          {item.notes && <span className="truncate italic">{item.notes}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums">
                        {item.actualCost !== null ? (
                          <>
                            {formatMoney(item.actualCost, trip.currency)}
                            <span className="block text-xs text-teal-700 dark:text-teal-400">Paid</span>
                          </>
                        ) : item.estimatedCost > 0 ? (
                          <>
                            {formatMoney(item.estimatedCost, trip.currency)}
                            <span className="block text-xs text-subtle">Estimate</span>
                          </>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ),
              )}
              <li>
                {editing?.mode === "new" && editing.date === g.key ? (
                  <ItemForm
                    initial={emptyItem(g.key)}
                    currency={trip.currency}
                    days={days}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <Button variant="ghost" onClick={() => setEditing({ mode: "new", date: g.key })}>
                    + Add plan
                  </Button>
                )}
              </li>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
