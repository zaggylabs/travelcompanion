# TravelCompanion

A trip itinerary and budget planner for people who've been planning trips in Excel.
Free, no sign-up, and trips are saved in the browser, so nothing leaves the user's device.

Live: https://travelcompanion.pages.dev

## What it does

- **Trips** have a destination, dates, a currency and a number of travelers.
- **Itinerary:** a day-by-day plan. Each plan has a time, a place, a category, notes, a link, an estimated cost, and the actual cost once it's paid. Anything without a day goes under *Unscheduled*.
- **Budget:** set a limit per category (flights, lodging, transport, food, activities, shopping, other) and compare it with what's estimated, what's been paid and the expected total. You also get totals per person and per day.
- **CSV import and export:** bring in an existing spreadsheet (in Excel, use File › Save As › CSV) or download a trip to open in Excel or Google Sheets. The importer understands common column names like *Day, Activity, Place, Cost, Paid, Notes*. It reads dates as day/month/year and handles `$1,200.00` / `1.234,50` style amounts and 12-hour times.

## How the site works

It's a plain static site: HTML, CSS and JavaScript modules with **no build step**. Cloudflare Pages serves the repo root, and every push to `main` goes live in about a minute.

```
index.html               The page shell (header, footer, #app)
assets/css/style.css     All styles (light/dark tokens at the top)
assets/js/app.js         The UI: trip list, trip view, itinerary, budget, forms
assets/js/theme.js       Light/dark toggle (follows the system until you pick one)
assets/js/lib/           Plain logic with no DOM, unit tested
  constants.js           Categories, currencies, ids
  budget.js              Totals by category, day and person
  csv.js                 CSV parsing, column matching, export
  dates.js money.js      Parsing and formatting helpers
  store.js               Saving trips in localStorage
tests/                   Unit tests for assets/js/lib
_headers                 Cloudflare security headers
```

## Working on it

- Preview locally with any static server, e.g. `python3 -m http.server`, then open http://localhost:8000.
- Run the tests with `npm test` (Node 22+; it uses Node's built-in test runner, so there's nothing to install).
- Push to `main` to deploy.

## Ideas for later

- Accounts and sync, so trips work across devices
- Sharing a trip with fellow travelers and splitting costs
- Direct .xlsx import and export
- Currency conversion
- A map view of the itinerary
