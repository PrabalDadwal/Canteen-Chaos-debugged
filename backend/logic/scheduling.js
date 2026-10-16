// logic/scheduling.js
// Pickup slots. The counter can only hand out so many orders in a
// 15-minute window, so slots have capacity and a cutoff.

const { isCanteenOpen, minutesOfDay, OPEN_FROM, OPEN_TO } = require('./availability');

const SLOT_MINUTES = 15;
const SLOT_CAPACITY = 6;      // orders per 15-minute window
const CUTOFF_MINUTES = 10;    // cannot pick a slot starting sooner than this
const HORIZON_SLOTS = 8;      // how far ahead we offer

/** "13:45" for a given minute-of-day. */
function toClock(minutes) {
  const h = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function fromClock(clock) {
  const [h, m] = String(clock).split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Round a time up to the next 15-minute mark. */
function nextBoundary(minutes) {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

/** How many orders are already booked into each slot. */
function bookingCounts(orders) {
  const counts = {};
  orders.forEach((o) => {
    if (o.status === 'cancelled' || !o.pickupSlot) return;
    counts[o.pickupSlot] = (counts[o.pickupSlot] || 0) + 1;
  });
  return counts;
}

/**
 * The slots a student can choose right now.
 * Returns [{ slot, label, booked, capacity, full }].
 */
function availableSlots(orders, now = new Date()) {
  if (!isCanteenOpen(now)) return [];

  const counts = bookingCounts(orders);
  const earliest = nextBoundary(minutesOfDay(now) + CUTOFF_MINUTES);
  const slots = [];

  for (let i = 0; i < HORIZON_SLOTS; i++) {
    const start = earliest + i * SLOT_MINUTES;
    if (start >= OPEN_TO) break;

    const slot = toClock(start);
    const booked = counts[slot] || 0;

    slots.push({
      slot,
      label: `${toClock(start)} - ${toClock(start + SLOT_MINUTES)}`,
      booked,
      capacity: SLOT_CAPACITY,
      full: booked >= SLOT_CAPACITY,
    });
  }

  return slots;
}

/**
 * Can this order be booked into this slot?
 * Returns { ok, reason }.
 */
function canBook(slot, orders, now = new Date()) {
  const minutes = fromClock(slot);
  if (minutes === null) return { ok: false, reason: 'Pickup time must look like 13:45' };
  if (minutes % SLOT_MINUTES !== 0) return { ok: false, reason: 'Pickup time must be on a 15 minute mark' };

  if (minutes < OPEN_FROM || minutes >= OPEN_TO) {
    return { ok: false, reason: 'The canteen is closed at that time' };
  }

  const nowMinutes = minutesOfDay(now);
  if (minutes < nowMinutes + CUTOFF_MINUTES) {
    return { ok: false, reason: `Pick a time at least ${CUTOFF_MINUTES} minutes from now` };
  }

  if (minutes > nowMinutes + HORIZON_SLOTS * SLOT_MINUTES + SLOT_MINUTES) {
    return { ok: false, reason: 'That is too far ahead' };
  }

  const booked = bookingCounts(orders)[slot] || 0;
  if (booked >= SLOT_CAPACITY) {
    return { ok: false, reason: `The ${slot} slot is full` };
  }

  return { ok: true, reason: null };
}

/** Rush hour: the lunch crush, when everything takes longer. */
function isRushHour(now = new Date()) {
  const m = minutesOfDay(now);
  return m >= 12 * 60 + 30 && m < 14 * 60;
}

module.exports = {
  SLOT_MINUTES,
  SLOT_CAPACITY,
  CUTOFF_MINUTES,
  HORIZON_SLOTS,
  toClock,
  fromClock,
  nextBoundary,
  bookingCounts,
  availableSlots,
  canBook,
  isRushHour,
};
