# Code map

A short guide to where things are, so changes can start here instead of reading every file.
Plain static site: no build step, no API keys. The only server code is three Cloudflare Pages Functions (below). Cloudflare Pages serves the repo root and deploys every push to `main`.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell: header (Home currency button, theme toggle), `#app`, footer credits |
| `assets/css/style.css` | All styles. Light/dark tokens at the top (white base, coral accent, Nunito + Fraunces from Google Fonts in `index.html`); "Cozy layer" at the end overrides shapes, tabs (emoji + colour per `data-tab`), category edge on plans (`cat-line-*`), shadows; trip page is 3 columns at ≥960px |
| `assets/js/app.js` | All UI (`emptyState(icon, title, text)` for empty cards; `foldable()` hides optional fields behind "+ Link" chips) (≈2000 lines, plain DOM via `h()`). Sections, in order: home currency and rates, trip list, trip form (setup), trip view, Good to know (opened by `guideButton` in the trip header, not a tab), budget summary and to-pay list, itinerary, day 📍 picker, plan row, Bookings tab (`bookingsView`, `bookingForm`), Saved places, Discover, attachments (`formFiles` is the in-form Attachments section for plans and bookings), plan form, place info panel, Budget tab |
| `assets/js/pickers.js` | Turns every `input[type=date]` / `input[type=time]` into a button + calendar or time panel (bottom sheet on phones); the input stays as a hidden field, so `.value`, FormData and events work as before. Date pairs (startDate/endDate, date/endDate, checkIn/checkOut) pick start then end. Plan days use `dayPicker()` chips in app.js |
| `assets/js/autocomplete.js` | Suggestion dropdown used for countries and places |
| `assets/js/theme.js` | Light/dark toggle (loaded before CSS) |
| `assets/js/lib/*.js` | Logic with no DOM, unit tested in `tests/` |
| `functions/api/discover.js` | Pages Function: `GET /api/discover?type&lat&lon&radius&keyword&diet` builds the Overpass query itself (no open proxy), tries overpass-api.de, then maps.mail.ru after 2.5 s and overpass.private.coffee after 5 s (first good answer wins, 14 s cap), returns parsed results, cached at the edge a day. The browser shows Photon's quick list first and swaps in this one |
| `functions/api/popular.js` | Pages Function: `GET /api/popular?lat&lon` asks Wikidata (SPARQL) for places within 15 km ranked by sitelinks, sorts them into things to do / must-see with `popular.js`, cached at the edge a week. Feeds the Popular column that replaces the budget column on the Discover tab |
| `functions/api/link-preview.js` | Pages Function: `GET /api/link-preview?url=` fetches a booking page (allowlisted hosts only, follows share-link redirects, 8 s timeout, cached a day) and returns its name, address, rating, photo via `pagemeta.js`. Not served by `python3 -m http.server`. Tested 2026-11-24: Airbnb works; Booking.com (AWS WAF challenge), Agoda (no data in its HTML) and Klook (403) can't be read, so the app takes the name from the URL and matches it on the map with Photon |

### lib

| Module | What it does |
|---|---|
| `constants.js` | Budget categories, `newId()` |
| `countries.js` | Countries, currency per country, flags, country search |
| `regions.js` | Popular cities and areas; trip countries and cities; each day's base city/area and country (`tripCountries`, `cityCountry`, `dayBase`, `dayCountry`) |
| `places.js` | Photon place search and ranking (`searchPlaces` takes one country or a list), Google Maps links |
| `placeinfo.js` | Place info panel data: OSM tags, Wikipedia summary, public holidays, crowd tips |
| `popular.js` | Discover's Popular column: Wikidata query, sorting descriptions into "do"/"see" (`classify`), thumbnails |
| `discover.js` | Discover tab: Overpass queries, dietary filters (`DIETS`, `dietsOf`; food and cafés only), `quickPlaces` (Photon) and `detailedPlaces` (/api/discover), distance, sort, browser cache |
| `airports.js` | Airport search for flight plans over `assets/data/airports.txt` (OurAirports, public domain; ~3,200 airports with scheduled flights, loaded on first use) |
| `travel.js` | Flight / transport plans: modes, titles, times, and `arrivals()` (where travel lands you, used by `dayBase`) |
| `ideas.js` | Saved places: groups, sub-tabs (`IDEA_TABS`: Hotels, Activities, Food, Places, Other), each kind's cost (`ideaCost`), and `ideaToItems` (a hotel becomes check-in + check-out plans with the stay's cost on check-in; others one plan with their cost) |
| `pagemeta.js` | Reads Open Graph tags and schema.org JSON-LD from raw HTML (used by the function) |
| `booking.js` | Pasted booking links (Booking.com, Agoda, Klook, Airbnb…): site name, colour, name and group guessed from the URL, `isPreviewHost` allowlist for the function |
| `guides.js` | Hand-written Good to know guides (visa, do's and don'ts, money, transport, links) |
| `countryfacts.js` | Plugs, emergency numbers and driving side for every country |
| `wikivoyage.js` | Wikivoyage sections for countries without a hand-written guide |
| `budget.js` | Totals by category, day and person; paid logic; per-plan currency conversion. Totals run over `budgetEntries(trip)` |
| `bookings.js` | Bookings: `budgetEntries` (plans without a booking + each booking once, on its first plan's day), `bookingOf`, `plansUsing`, paid-by options |
| `rates.js` | Home country/currency, exchange rates with cache |
| `csv.js` | CSV parse, column matching, import and export |
| `dates.js`, `money.js` | Date and money parsing and formatting |
| `store.js` | Trips in localStorage |
| `files.js` | Plan attachments in IndexedDB |

## Data model (a trip in localStorage)

```
{ id, name, startDate, endDate (YYYY-MM-DD), travelers,
  country,            // first country, kept for older code paths
  countries: ["ES","CH"],
  cities: [{ name, country, lat?, lon? }], destination: "Barcelona & Zurich",
  dayBases: { "2026-12-10": { city, area?, lat?, lon? } },  // a day's own 📍 wins; else a travel plan arriving in a trip city (or a trip country → its first city) that day; else carries on from the last of those
  currency,           // "Totals in": totals and budget limits are in this
  budget: { Food: 300, ... },
  items: [{ id, date, time, title,   // title is free text ("Lunch at Ichiran"); place.name is the map place
            location, category, estimatedCost, actualCost, paid,  // the form has one Cost: saves estimatedCost, actualCost null; older plans' cost = actualCost ?? estimatedCost (expectedCost)
            currency?,  // only when different from trip.currency
            travel?: { mode: "flight|train|bus|ferry|car", from, to, number, arrive, nextDay, fromAirport?, toAirport? (IATA), fromAirportName?, toAirportName? },  // Flights/Transport plans with a route; time = departure
            bookingId?,  // uses a booking: its cost, paid and tickets count instead of the plan's own
            notes, link, place?: { name, osm?, lat, lon, kind, area, cc? }, fromIdea?, attachments?: [...] }],
  bookings: [{ id, title, category, provider, confirmation, date, endDate, amount, currency?, paid, paidBy, link, notes, attachments? }],
  ideas: [{ id, title, group, location, link, bookingLink?, details?: { address, area, rating, ratingScale, reviews, stars, image, price }, notes, place?, createdAt,
             info?: { // by sub-tab (kindFields in app.js); empty fields left out
               // Hotels: checkIn, checkOut, pricePerNight, total, currency, confirmation, paid
               // Activities: date, duration, pricePerPerson, people, total, currency, hours, paid
               // Food: cuisine, priceRange ("$".."$$$$"), diets ["Halal", …]   Places: hours, entryFee, people, currency   Other: cost, currency, paid
             } }] }  // plans made from one get bookingLink || link, its cost, currency and paid
```

Older trips may lack `countries`, `cities`, a city's `country`, or `paid`. The helpers in `regions.js` and `budget.js` fill those in when reading, so don't assume the fields exist.

## Browser storage

| Key | What |
|---|---|
| `travelcompanion:trips:v1` | All trips (array) |
| `travelcompanion:home:v1` | Home country and currency |
| `travelcompanion:rates:v1:<BASE>` | Exchange rates, cached 12 hours |
| `travelcompanion:discover-cache` | Discover results, cached a week |
| `travelcompanion.theme` | Light/dark choice |
| IndexedDB `travelcompanion-files` | Attachments |

## External services (all free, keyless)

- Photon `photon.komoot.io`: place and city search
- Overpass `overpass-api.de`, `maps.mail.ru`, `overpass.private.coffee` (via /api/discover): Discover details
- Photon reverse/search: Discover's quick list
- Wikidata SPARQL `query.wikidata.org` (via /api/popular): Discover's Popular column
- OSM API `api.openstreetmap.org`: place tags for the info panel
- Wikipedia and Wikivoyage APIs: summaries and country tips
- Nager.Date `date.nager.at`: public holidays
- `open.er-api.com` (fallback Frankfurter): exchange rates

OSM data needs the visible credit in the footer and on Discover results.

## Working on it

- `python3 -m http.server`, then open http://localhost:8000
- `npm test` (Node 22+, no installs)
- Redrawing: `render()` rebuilds the page from state. Don't call it while a form is open (see `formBusy()`), or what's typed is lost.
