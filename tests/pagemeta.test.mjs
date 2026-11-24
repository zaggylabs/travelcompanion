// Reading booking pages for Saved places. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, parsePageMeta } from "../assets/js/lib/pagemeta.js";
import { isPreviewHost } from "../assets/js/lib/booking.js";

const hotel = `<!doctype html><html><head>
<title>Hotel Gracery Shinjuku, Tokyo – Updated 2026 Prices</title>
<meta property="og:title" content="Hotel Gracery Shinjuku, Tokyo &ndash; Updated 2026 Prices" />
<meta property="og:image" content="https://cf.bstatic.com/xdata/images/hotel/max1024x768/1.jpg" />
<script type="application/ld+json">{"@context":"http://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>
<script type="application/ld+json">
{"@context":"http://schema.org","@type":"Hotel","name":"Hotel Gracery Shinjuku",
 "address":{"@type":"PostalAddress","streetAddress":"Kabukicho 1-19-1, Shinjuku-ku","addressLocality":"Tokyo","postalCode":"160-8466","addressCountry":"Japan"},
 "aggregateRating":{"@type":"AggregateRating","ratingValue":8.6,"bestRating":10,"reviewCount":"12345"},
 "hasMap":"https://maps.googleapis.com/x", "priceRange":"Prices for upcoming dates start at SGD 180 per night"}
</script></head><body></body></html>`;

test("reads a hotel page's JSON-LD", () => {
  const m = parsePageMeta(hotel, "https://www.booking.com/hotel/jp/gracery-shinjuku.html");
  assert.equal(m.name, "Hotel Gracery Shinjuku");
  assert.equal(m.group, "Stays");
  assert.equal(m.address, "Kabukicho 1-19-1, Shinjuku-ku, Tokyo, 160-8466, Japan");
  assert.equal(m.area, "Tokyo, Japan");
  assert.equal(m.rating, 8.6);
  assert.equal(m.ratingScale, 10);
  assert.equal(m.reviews, 12345);
  assert.equal(m.image, "https://cf.bstatic.com/xdata/images/hotel/max1024x768/1.jpg");
  assert.equal(m.blocked, false);
});

test("falls back to Open Graph tags and cleans the title", () => {
  const html = `<meta property="og:title" content="Universal Studios Japan Ticket - Klook Singapore"><meta property="og:image" content="/img/usj.jpg"><meta name="description" content="Skip the queue">`;
  const m = parsePageMeta(html, "https://www.klook.com/activity/1418-usj/");
  assert.equal(m.name, "Universal Studios Japan Ticket");
  assert.equal(m.image, "https://www.klook.com/img/usj.jpg");
  assert.equal(m.description, "Skip the queue");
  assert.equal(cleanTitle("Hotel Gracery Shinjuku in Tokyo - Room Deals, Photos & Reviews", "Tokyo"), "Hotel Gracery Shinjuku");
  assert.equal(cleanTitle("Booking.com"), null);
});

test("spots bot checks, and only fetches booking sites", () => {
  const m = parsePageMeta("<title>Just a moment...</title>", "https://www.booking.com/");
  assert.equal(m.name, null);
  assert.equal(m.blocked, true);
  assert.ok(isPreviewHost("www.booking.com"));
  assert.ok(isPreviewHost("www.airbnb.com.sg"));
  assert.ok(isPreviewHost("abnb.me"));
  assert.ok(isPreviewHost("s.klook.com"));
  assert.ok(!isPreviewHost("google.com"));
  assert.ok(!isPreviewHost("evil-booking.com"));
  assert.ok(!isPreviewHost("169.254.169.254"));
});
