# TravelCompanion

A trip itinerary and budget planner for people who've been planning trips in Excel.
Free, no sign-up, and trips are saved in the browser, so nothing leaves the user's device.

Live: https://travelcompanion.pages.dev

## What it does

- **Home page:** a "Plan your holiday" welcome, a *Plan a new trip* card in the middle (it opens the guided setup), then your saved trips: upcoming first, then past trips (most recent first).
- **Guided trip setup:** four short steps. *Where are you going?* (pick the country, which sets the currency: Japan → JPY), *Which cities?* (tap popular ones like *+ Tokyo* or search any city or town in that country), *When?* (dates), then the trip name (it defaults to "Japan trip"), currency and travelers.
- **Trips across several countries:** add more than one country in setup (Spain, then France) and pick cities for each. Each day's city sets that day's country, so Discover, place suggestions and holidays follow the day you're on, and *Good to know* gets a tab per country. Each plan's cost has its own currency (a new plan starts in its day's country's currency, and you can change it, say to SGD for a flight paid at home). Totals and budget limits add everything up in the trip's *Totals in* currency (your home currency by default), and the summary shows what it's made up of (*€300 + CHF 120*). Plans in a currency with no exchange rate are left out of totals and called out. Trips made before this keep working as one-country trips, and editing a trip's currency keeps already-priced plans in the currency they were entered in and converts budget limits.
- **Flights and transport:** in *+ Add plan*, switch the form from *📍 Plan* to *✈ Travel* for a flight, train, bus, ferry or transfer: from and to (your home country is always offered, plus the trip's countries and cities, so *Singapore → Japan* or *Tokyo → Kyoto*), the flight or train number, departure and arrival times (with *arrives the next day*), the cost (in your home currency by default) and the booking link. The day shows *✈ Travel day: Singapore → Tokyo*, the plan is on the to-pay list like any other, and arriving in one of the trip's cities (or countries, which means its first city) makes it where you're based from then on, until a later 📍 says otherwise. The flight home doesn't move you.
- **Where you are each day:** every day on the itinerary has a 📍 button. Pick the day's city from the trip's cities, then an area (popular ones like *Shibuya* or *Gion* are one tap, or search any neighbourhood, station or landmark near the city). Days you don't set stay in the last city you picked, and one-city trips are in that city every day. Discover opens on the day's area with *Your days* shortcuts (*Day 2–3 · Tokyo*), and place suggestions in a day's plans favour spots near where you are that day. Older trips keep working: their cities are read from the old destination text.
- **Place suggestions:** when you add a plan, typing a name (say *Disney*) suggests real places in the trip's country (*Tokyo Disneyland, Urayasu*). Picking one fills in where it is, a Google Maps link and a likely category. Suggestions come from [Photon](https://photon.komoot.io), a free search over OpenStreetMap data, asked at most once per pause in typing.
- **Place info (left column):** click a plan to see what's known about its place: a photo and summary from Wikipedia, opening hours, website and phone from OpenStreetMap, and whether the day is a weekend or public holiday (from [Nager.Date](https://date.nager.at)). Click it again, or the pencil, to edit. There's no free source of real peak hours, so the panel gives a general tip for that kind of place and links to Google Maps' Popular times instead of guessing. On narrow screens the info opens under the selected plan. The right column is reserved for the budget.
- **Home currency:** on the first visit you say where you're from (guessed from the browser's time zone or language), and every cost entered in the trip's currency also shows what it comes to in your home currency (*¥10,900 ≈ S$94.45*): plans, day totals, the budget summary and the Budget tab. Change it any time with the *Home* button in the header. Rates come from [ExchangeRate-API's open endpoint](https://www.exchangerate-api.com/docs/free) (Frankfurter as a fallback), are cached in the browser for 12 hours, and the last saved rates keep working offline.
- **To-pay checklist (right column):** every plan with a cost, in itinerary order ("Hotel X · Day 1 · ¥12,000"). Tick one when it's paid and it greys out; the totals at the top (expected, paid so far, still to pay) update right away. Ticking a plan with no actual cost uses its estimate. Plans saved before the checkbox existed count as paid if they have an actual cost.
- **Itinerary:** a day-by-day plan. Each plan has a time, a place, a category, notes, a link, an estimated cost, the actual cost if it differs, and a Paid tick. Anything without a day goes under *Unscheduled*.
- **Saved places:** a scratchpad tab for places you might go, grouped into food and drinks, places to see, things to do, shopping, places to stay and other. Typing a name uses the same place suggestions (and picks a likely group). Paste a Booking.com, Agoda, Klook, Airbnb (or any) link to keep the booking page with it: the site shows as a pill, and the page is read (by a small Cloudflare Pages Function, since browsers can't read booking sites directly) for the name, address, rating and photo, and the place is matched on the map. When a site blocks that, the name is guessed from the link. Click one to see its place info. **Add to itinerary** asks for a day and an optional time and adds it as a plan; the saved place stays, with a ✓ *Day 2 · 21:30* chip that jumps to the plan. Saved places are stored with the trip in localStorage and aren't part of CSV exports.
- **Discover:** find places near anywhere on the trip. Pick a type (food, cafés and desserts, bars, sights, parks and nature, shopping), type an area like *Shibuya* (suggested from Photon, or one tap on a city from the trip's destination), optionally a keyword like *ramen*, and a distance up to 2 km. Results come from OpenStreetMap through the free [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API): name, cuisine or type, opening hours where listed, website, distance, and a *Reviews and map* link to Google Maps. Sort by nearest or by most details listed. OpenStreetMap has no ratings or reviews, so none are shown. Each result can be saved to Saved places or added to a day, and clicking one shows its place info. One request per search, results cached in the browser for a week. If both Overpass servers are busy, it falls back to a simpler list from Photon (no cuisine or hours) and says so.
- **Attachments:** the paperclip button next to each plan lets you attach tickets, booking confirmations or screenshots (images and PDFs, up to 25 MB each), then open or remove them. Files are stored in the browser's IndexedDB, so they stay on the device and aren't part of CSV exports.
- **Budget:** set a limit per category (flights, lodging, transport, food, activities, shopping, other) and compare it with what's estimated, what's been paid and the expected total. You also get totals per person and per day.
- **CSV import and export:** exports include a Currency column, and imports read one if it's there. Bring in an existing spreadsheet (in Excel, use File › Save As › CSV) or download a trip to open in Excel or Google Sheets. The importer understands common column names like *Day, Activity, Place, Cost, Paid, Notes*. It reads dates as day/month/year and handles `$1,200.00` / `1.234,50` style amounts and 12-hour times.

## How the site works

See [CODEMAP.md](CODEMAP.md) for a quick map of the code, data model and storage keys.

It's a plain static site: HTML, CSS and JavaScript modules with **no build step**. Cloudflare Pages serves the repo root, and every push to `main` goes live in about a minute.

```
index.html               The page shell (header, footer, #app)
assets/css/style.css     All styles (light/dark tokens at the top)
assets/js/app.js         The UI: trip list, trip view, itinerary, budget, forms
assets/js/autocomplete.js  The suggestion dropdown used for countries and places
assets/js/theme.js       Light/dark toggle (follows the system until you pick one)
assets/js/lib/           Plain logic with no DOM, unit tested
  constants.js           Categories, ids
  countries.js           Countries, their currencies and flags
  places.js              Place search (Photon) and ranking
  regions.js             Trip countries and cities, popular cities and areas, where (and in which country) each day is based
  ideas.js               Saved places: groups, and turning one into a plan
  discover.js            Discover tab: Overpass queries, results, distance, cache
  placeinfo.js           Place info panel data (OSM, Wikipedia, public holidays)
  budget.js              Totals by category, day and person
  rates.js               Home currency, exchange rates and their cache
  csv.js                 CSV parsing, column matching, export
  dates.js money.js      Parsing and formatting helpers
  store.js               Saving trips in localStorage
  files.js               Saving attachments in IndexedDB
tests/                   Unit tests for assets/js/lib
_headers                 Cloudflare security headers
```

## Data sources and credits

Place data is © OpenStreetMap contributors under the ODbL, which allows commercial use (ads included) as long as the credit stays visible; the site footer and the Discover results link to openstreetmap.org/copyright. Wikipedia summaries are CC BY-SA and credited with a link in the place info panel. Photon, Overpass and the OSM API are free community servers with fair-use limits, so if traffic grows a lot, move to a paid or self-hosted provider.

## Working on it

- Preview locally with any static server, e.g. `python3 -m http.server`, then open http://localhost:8000.
- Run the tests with `npm test` (Node 22+; it uses Node's built-in test runner, so there's nothing to install).
- Push to `main` to deploy.

## Ideas for later

- Accounts and sync, so trips work across devices
- Sharing a trip with fellow travelers and splitting costs
- Direct .xlsx import and export
- A map view of the itinerary
