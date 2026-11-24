// Bookings: tickets, hotels, passes and tours that are booked and paid for, with their documents.
// A plan can point at one (item.bookingId). The booking is then where the money lives, so the
// budget counts it once, however many plans use it, and the plan's own cost is left out.

import { newId } from "./constants.js";

export const PAID_BY = ["Card", "Cash", "PayPal", "Bank transfer", "Points or vouchers", "Other"];
export const BOOKING_SITES = ["Booking.com", "Agoda", "Airbnb", "Klook", "KKday", "Trip.com", "Expedia", "GetYourGuide", "Official website", "Airline"];

export const emptyBooking = (category = "Activities") => ({
  id: newId(), title: "", category, provider: "", link: "", confirmation: "",
  date: "", endDate: "", amount: 0, paid: false, paidBy: "", notes: "",
});

export const bookingsOf = (trip) => trip.bookings ?? [];

/** The booking a plan uses, if it still exists. */
export const bookingOf = (trip, item) => (item?.bookingId ? bookingsOf(trip).find((b) => b.id === item.bookingId) ?? null : null);

/** Plans that use a booking. */
export const plansUsing = (trip, booking) => trip.items.filter((i) => i.bookingId === booking.id);

/**
 * What the budget counts: plans without a booking as they are, then each booking once
 * (on the day of the first plan that uses it, else its own date). Booking entries carry `booking: true`.
 */
export function budgetEntries(trip) {
  const bookings = bookingsOf(trip);
  if (!bookings.length) return trip.items;
  const ids = new Set(bookings.map((b) => b.id));
  const plans = trip.items.filter((i) => !(i.bookingId && ids.has(i.bookingId)));
  const entries = bookings.map((b) => {
    const dates = plansUsing(trip, b).map((i) => i.date).filter(Boolean).sort();
    return {
      id: b.id, booking: true, title: b.title, category: b.category || "Other",
      date: dates[0] ?? b.date ?? "", time: "",
      estimatedCost: Number(b.amount) || 0, actualCost: null, paid: Boolean(b.paid),
      ...(b.currency ? { currency: b.currency } : {}),
    };
  });
  return [...plans, ...entries];
}
