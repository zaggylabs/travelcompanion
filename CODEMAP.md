# Code map

A short guide to where things are, so changes can start here instead of reading every file.
Plain static site: no build step, no API keys. The only server code is one Cloudflare Pages Function (below). Cloudflare Pages serves the repo root and deploys every push to `main`.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell: header (Home currency button, theme toggle), `#app`, footer credits |
| `assets/css/style.css` | All styles. Light/dark tokens at the top; trip page is 3 columns at ≥960px |
| `assets/js/app.js` | All UI (≈2000 lines, plain DOM via `h()`). Sections, in order: home currency and rates, trip list, trip form (setup), trip view, Good to know, budget summary and to-pay list, itinerary, day 📍 picker, plan row, Saved places, Discover, attachments, plan form, place info panel, Budget tab |
| `assets/js/autocomplete.js` | Suggestion dropdown used for countries and places |
| `assets/js/theme.js` | Light/dark toggle (loaded before CSS) |
| `assets/js/lib/*.js` | Logic with no DOM, unit tested in `tests/` |
| `functions/api/link-preview.js` | Pages Function: `GET /api/link-preview?url=` fetches a booking page (allowlisted hosts only, follows share-link redirects, 8 s timeout, cached a day) and returns its name, address, rating, photo via `pagemeta.js`. Not served by `python3 -m http.server`. Tested 2026-11-24: Airbnb works; Booking.com (AWS WAF challenge), Agoda (no data in its HTML) and Klook (403) can't be read, so the app takes the name from the URL and matches it on the map with Photon |

### lib

| Module | What it does |
|---|---|
| `constants.js` | Budget categories, `newId()` |
| `countries.js` | Countries, currency per country, flags, country search |
| `regions.js` | Popular cities and areas; trip countries and cities; each day's base city/area and country (`tripCountries`, `cityCountry`, `dayBase`, `dayCountry`) |
| `places.js` | Photon place search and ranking (`searchPlaces` takes one country or a list), Google Maps links |
| `placeinfo.js` | Place info panel data: OSM tags, Wikipedia summary, public holidays, crowd tips |
| `discover.js` | Discover tab: Overpass queries, Photon fallback, distance, sort, cache |
| `travel.js` | Flight / transport plans: modes, titles, times, and `arrivals()` (where travel lands you, used by `dayBase`) |
| `ideas.js` | Saved places groups, turning a saved place into a plan |
| `pagemeta.js` | Reads Open Graph tags and schema.org JSON-LD from raw HTML (used by the function) |
| `booking.js` | Pasted booking links (Booking.com, Agoda, Klook, Airbnb…): site name, colour, name and group guessed from the URL, `isPreviewHost` allowlist for the function |
| `guides.js` | Hand-written Good to know guides (visa, do's and don'ts, money, transport, links) |
| `countryfacts.js` | Plugs, emergency numbers and driving side for every country |
| `wikivoyage.js` | Wikivoyage sections for countries without a hand-written guide |
| `budget.js` | Totals by category, day and person; paid logic; per-plan currency conversion |
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
  items: [{ id, date, time, title, location, category, estimatedCost, actualCost, paid,
            currency?,  // only when different from trip.currency
            travel?: { mode: "flight|train|bus|ferry|car", from, to, number, arrive, nextDay },  // time = departure
            notes, link, place?: { osm, lat, lon, kind, area, cc? }, fromIdea?, attachments?: [...] }],
  ideas: [{ id, title, group, location, link, bookingLink?, details?: { address, area, rating, ratingScale, reviews, stars, image, price }, notes, place?, createdAt }] }  // a plan made from one gets bookingLink || link
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
- Overpass `overpass-api.de` (fallback `maps.mail.ru`): Discover
- OSM API `api.openstreetmap.org`: place tags for the info panel
- Wikipedia and Wikivoyage APIs: summaries and country tips
- Nager.Date `date.nager.at`: public holidays
- `open.er-api.com` (fallback Frankfurter): exchange rates

OSM data needs the visible credit in the footer and on Discover results.

## Working on it

- `python3 -m http.server`, then open http://localhost:8000
- `npm test` (Node 22+, no installs)
- Redrawing: `render()` rebuilds the page from state. Don't call it while a form is open (see `formBusy()`), or what's typed is lost.
