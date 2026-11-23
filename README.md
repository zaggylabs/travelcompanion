# TravelCompanion

A trip itinerary and budget planner for people who've been planning trips in Excel.

- **Trips** have a destination, dates, a currency and a number of travelers.
- **Itinerary:** a day-by-day plan. Each plan has a time, a place, a category, notes, a link, an estimated cost, and the actual cost once it's paid. Anything without a day goes under *Unscheduled*.
- **Budget:** set a limit per category (flights, lodging, transport, food, activities, shopping, other) and compare it with what's estimated, what's been paid and the expected total. You also get totals per person and per day.
- **CSV import and export:** bring in an existing spreadsheet (in Excel, use File › Save As › CSV) or download your trip to open in Excel or Google Sheets. The importer understands common column names like *Day, Activity, Place, Cost, Paid, Notes*, and handles US and European number and date formats.

There are no accounts yet. Trips are saved in the browser's local storage, so use Export CSV to back them up.

## Development

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build
```

### Deploying (Cloudflare Pages)

The app is a static export (`output: "export"` in `next.config.ts`), so `npm run build` writes a plain static site to `out/`. In Cloudflare Pages use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `out` |
| Node version | 22 (from `.nvmrc`) |

Any other static host (GitHub Pages, Netlify, S3) works the same way.

### Project layout

```
src/app/            Next.js App Router entry (layout, page, global styles)
src/components/     UI: trip list, trip view, itinerary, budget, forms
src/lib/            Plain TypeScript logic, unit tested
  types.ts          Trip / ItineraryItem data model
  budget.ts         Budget totals by category, day and person
  csv.ts            CSV parsing, header mapping and export
  dates.ts money.ts Parsing and formatting helpers
  store.ts          localStorage-backed store (useSyncExternalStore)
```

Built with Next.js 16, React 19, TypeScript and Tailwind CSS 4.

## Roadmap ideas

- Accounts and cloud sync (e.g. Supabase) so trips work across devices
- Share a trip with fellow travelers and split costs
- Direct .xlsx import and export
- Currency conversion for costs in a different currency
- Map view of the itinerary
