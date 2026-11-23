"use client";

import { summarizeBudget } from "@/lib/budget";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Category, Trip } from "@/lib/types";
import { Card, Input } from "./ui";

export function BudgetView({
  trip,
  days,
  onBudgetChange,
}: {
  trip: Trip;
  days: string[];
  onBudgetChange: (budget: Trip["budget"]) => void;
}) {
  const s = summarizeBudget(trip, days.length);
  const money = (n: number) => formatMoney(n, trip.currency);
  const hasBudget = s.totalBudget > 0;
  const overBudget = hasBudget && s.remaining < 0;

  const setLimit = (category: Category, value: string) => {
    const next = { ...trip.budget };
    const n = Number(value);
    if (value === "" || Number.isNaN(n)) delete next[category];
    else next[category] = n;
    onBudgetChange(next);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Budget" value={hasBudget ? money(s.totalBudget) : "Not set"} />
        <Stat label="Expected total" value={money(s.totalProjected)} hint="Paid amounts, plus estimates for the rest" />
        <Stat label="Spent so far" value={money(s.totalSpent)} />
        <Stat
          label={overBudget ? "Over budget" : "Left to spend"}
          value={hasBudget ? money(Math.abs(s.remaining)) : "Not set"}
          tone={overBudget ? "bad" : hasBudget ? "good" : undefined}
        />
      </div>
      <p className="text-sm text-subtle">
        {money(s.projectedPerPerson)} per person ({trip.travelers} traveler{trip.travelers === 1 ? "" : "s"})
        {s.projectedPerDay !== null && <> · {money(s.projectedPerDay)} per day</>}
      </p>

      <Card className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-subtle">
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Budget limit</th>
              <th className="px-3 py-2 text-right font-medium">Estimated</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-3 py-2 text-right font-medium">Expected</th>
              <th className="w-32 px-3 py-2 font-medium">
                <span className="sr-only">Progress</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {s.categories.map((c) => {
              const pct = c.budget ? Math.min(100, (c.projected / c.budget) * 100) : 0;
              const over = c.budget !== null && c.projected > c.budget;
              return (
                <tr key={c.category} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 font-medium">{c.category}</td>
                  <td className="w-36 px-3 py-1.5">
                    <Input
                      aria-label={`${c.category} budget`}
                      type="number"
                      min={0}
                      step="1"
                      inputMode="decimal"
                      placeholder="No limit"
                      className="py-1"
                      value={c.budget ?? ""}
                      onChange={(e) => setLimit(c.category, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(c.planned)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(c.spent)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${over ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                    {money(c.projected)}
                  </td>
                  <td className="px-3 py-1.5">
                    {c.budget ? (
                      <div className="h-2 rounded-full bg-muted" title={`${Math.round((c.projected / c.budget) * 100)}% of budget`}>
                        <div className={`h-2 rounded-full ${over ? "bg-red-500" : "bg-teal-600"}`} style={{ width: `${pct}%` }} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 tabular-nums">{hasBudget ? money(s.totalBudget) : ""}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(s.totalPlanned)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(s.totalSpent)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(s.totalProjected)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>
      <p className="text-xs text-subtle">
        Expected uses what you actually paid where you have entered it, and the estimate for everything else.
      </p>

      {days.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">By day</h3>
          <DayBars trip={trip} days={days} byDay={s.byDay} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-subtle" title={hint}>
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "good" ? "text-teal-700 dark:text-teal-400" : ""
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

function DayBars({ trip, days, byDay }: { trip: Trip; days: string[]; byDay: Record<string, number> }) {
  const max = Math.max(1, ...days.map((d) => byDay[d] ?? 0));
  return (
    <Card className="space-y-1.5 p-3">
      {days.map((d, i) => {
        const v = byDay[d] ?? 0;
        return (
          <div key={d} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-subtle">
              Day {i + 1} · {formatDay(d).split(", ")[1] ?? d}
            </span>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right tabular-nums">{formatMoney(v, trip.currency)}</span>
          </div>
        );
      })}
    </Card>
  );
}
