"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, type Category, type ItineraryItem } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "./ui";

export function ItemForm({
  initial,
  currency,
  days,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: ItineraryItem;
  currency: string;
  days: string[];
  onSave: (item: ItineraryItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [item, setItem] = useState(initial);
  const [actualText, setActualText] = useState(initial.actualCost === null ? "" : String(initial.actualCost));
  const set = <K extends keyof ItineraryItem>(key: K, value: ItineraryItem[K]) => setItem((i) => ({ ...i, [key]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!item.title.trim()) return;
    const actual = actualText.trim() === "" ? null : Number(actualText);
    onSave({
      ...item,
      title: item.title.trim(),
      location: item.location.trim(),
      link: item.link.trim(),
      actualCost: actual === null || Number.isNaN(actual) ? null : actual,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-teal-600/40 bg-surface p-3 sm:grid-cols-6">
      <Field label="What" className="sm:col-span-4">
        <Input
          autoFocus
          required
          placeholder="Sunset tram ride"
          value={item.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field label="Category" className="sm:col-span-2">
        <Select value={item.category} onChange={(e) => set("category", e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="Day" className="sm:col-span-2">
        {days.length > 0 && (item.date === "" || days.includes(item.date)) ? (
          <Select value={item.date} onChange={(e) => set("date", e.target.value)}>
            <option value="">Unscheduled</option>
            {days.map((d, i) => (
              <option key={d} value={d}>
                Day {i + 1} · {d}
              </option>
            ))}
          </Select>
        ) : (
          <Input type="date" value={item.date} onChange={(e) => set("date", e.target.value)} />
        )}
      </Field>
      <Field label="Time" className="sm:col-span-1">
        <Input type="time" value={item.time} onChange={(e) => set("time", e.target.value)} />
      </Field>
      <Field label="Where" className="sm:col-span-3">
        <Input placeholder="Tram 28, Martim Moniz" value={item.location} onChange={(e) => set("location", e.target.value)} />
      </Field>
      <Field label={`Estimated cost (${currency})`} className="sm:col-span-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={item.estimatedCost || ""}
          placeholder="0"
          onChange={(e) => set("estimatedCost", Number(e.target.value) || 0)}
        />
      </Field>
      <Field label={`Actual cost (${currency})`} className="sm:col-span-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={actualText}
          placeholder="Not paid yet"
          onChange={(e) => setActualText(e.target.value)}
        />
      </Field>
      <Field label="Link" className="sm:col-span-2">
        <Input type="url" placeholder="https://" value={item.link} onChange={(e) => set("link", e.target.value)} />
      </Field>
      <Field label="Notes" className="sm:col-span-6">
        <Textarea rows={2} value={item.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2 sm:col-span-6">
        <Button type="submit" variant="primary" disabled={!item.title.trim()}>
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
        {onDelete && (
          <Button variant="danger" className="ml-auto" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
