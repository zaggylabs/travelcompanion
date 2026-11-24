// Booking links pasted into Saved places. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBookingLink, toUrl } from "../assets/js/lib/booking.js";

const p = (u) => parseBookingLink(u);

test("recognises booking sites and guesses the name from the URL", () => {
  assert.deepEqual([p("https://www.booking.com/hotel/jp/gracery-shinjuku.en-gb.html?aid=1").site, p("https://www.booking.com/hotel/jp/gracery-shinjuku.en-gb.html?aid=1").name], ["Booking.com", "Gracery Shinjuku"]);
  assert.equal(p("https://www.booking.com/hotel/jp/gracery-shinjuku.html").group, "Stays");
  assert.equal(p("https://www.agoda.com/en-sg/hotel-gracery-shinjuku/hotel/tokyo-jp.html?cid=1").name, "Hotel Gracery Shinjuku");
  const k = p("https://www.klook.com/en-SG/activity/1418-universal-studios-japan-osaka/");
  assert.equal(k.site, "Klook");
  assert.equal(k.name, "Universal Studios Japan Osaka");
  assert.equal(k.group, "Activities");
  assert.equal(p("https://www.klook.com/en-SG/hotels/detail/123456-mitsui-garden-hotel-ginza/").group, "Stays");
  const a = p("https://www.airbnb.com.sg/rooms/12345678?adults=2");
  assert.equal(a.site, "Airbnb");
  assert.equal(a.name, null);
  assert.equal(a.group, "Stays");
  assert.equal(p("https://www.getyourguide.com/tokyo-l193/tokyo-teamlab-planets-ticket-t401379/").name, "Tokyo Teamlab Planets Ticket");
  assert.equal(p("https://www.expedia.com/Tokyo-Hotels-Hotel-Gracery-Shinjuku.h9212384.Hotel-Information").name, "Hotel Gracery Shinjuku");
  assert.equal(p("https://www.tripadvisor.com/Restaurant_Review-g1066456-d1679433-Reviews-Ichiran_Shibuya-Shibuya_Tokyo.html").name, "Ichiran Shibuya");
  assert.equal(p("https://www.tripadvisor.com/Restaurant_Review-g1066456-d1679433-Reviews-Ichiran_Shibuya-Shibuya_Tokyo.html").group, "Food");
  assert.equal(p("https://www.kkday.com/en-sg/product/20543-mt-fuji-day-tour").name, "Mt Fuji Day Tour");
});

test("unknown sites still work, and plain text isn't a link", () => {
  const x = p("www.someryokan.jp/stay/");
  assert.equal(x.site, "someryokan.jp");
  assert.equal(x.group, "Stays");
  assert.equal(p("Ichiran Shibuya"), null);
  assert.equal(p("go late"), null);
  assert.equal(toUrl("hello.world"), null);
  assert.ok(toUrl("https://a.com"));
});
