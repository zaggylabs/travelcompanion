"use client";

import { useState, type FormEvent } from "react";
import { CURRENCIES } from "@/lib/money";
import type { Trip } from "@/lib/types";
import { Button, Field, Input, Select } from "./ui";

export function TripForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Trip;
  submitLabel: string;
  onSubmit: (trip: Trip) => void;
  onCancel: () => void;
}) {
  const [trip, setTrip] = useState(initial);
  const set = <K extends keyof Trip>(key: K, value: Trip[K]) => setTrip((t) => ({ ...t, [key]: value }));
  const datesInvalid = Boolean(trip.startDate && trip.endDate && trip.endDate < trip.startDate);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trip.name.trim() || datesInvalid) return;
    onSubmit({ ...trip, name: trip.name.trim(), destination: trip.destination.trim() });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Trip name" className="sm:col-span-2">
        <Input
          autoFocus
          required
          placeholder="Summer in Portugal"
          value={trip.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Destination">
        <Input placeholder="Lisbon & Porto" value={trip.destination} onChange={(e) => set("destination", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <Select value={trip.currency} onChange={(e) => set("currency", e.target.value)}>
            {(CURRENCIES.includes(trip.currency) ? CURRENCIES : [trip.currency, ...CURRENCIES]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Travelers">
          <Input
            type="number"
            min={1}
            value={trip.travelers}
            onChange={(e) => set("travelers", Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
      </div>
      <Field label="Start date">
        <Input type="date" value={trip.startDate} onChange={(e) => set("startDate", e.target.value)} />
      </Field>
      <Field label="End date">
        <Input
          type="date"
          min={trip.startDate || undefined}
          value={trip.endDate}
          onChange={(e) => set("endDate", e.target.value)}
          aria-invalid={datesInvalid}
        />
      </Field>
      {datesInvalid && <p className="text-sm text-red-600 sm:col-span-2">The end date is before the start date.</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={!trip.name.trim() || datesInvalid}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
