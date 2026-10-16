// logic/availability.js
// When the canteen is open, which meal is being served, and whether a
// given dish can be ordered at this moment.
//
// The server clock decides all of this. The browser's clock is never trusted.

const OPEN_FROM = 7 * 60;   // 07:00
const OPEN_TO = 22 * 60;    // 22:00

const SLOT_WINDOWS = {
  breakfast: { from: 7 * 60, to: 11 * 60 },
  lunch: { from: 11 * 60 + 30, to: 16 * 60 },
  evening: { from: 16 * 60 + 30, to: 22 * 60 },
  allday: { from: OPEN_FROM, to: OPEN_TO },
};

const SLOT_ORDER = ['breakfast', 'lunch', 'evening', 'allday'];

function minutesOfDay(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function isCanteenOpen(date = new Date()) {
  const m = minutesOfDay(date);
  return m >= OPEN_FROM && m < OPEN_TO;
}

/** The meal being served now, or null when closed. */
function currentSlot(date = new Date()) {
  if (!isCanteenOpen(date)) return null;
  const m = minutesOfDay(date);

  const named = SLOT_ORDER.slice(0, 3).find((key) => {
    const w = SLOT_WINDOWS[key];
    return m >= w.from && m < w.to;
  });

  return named || 'allday';
}

/** Minutes until a slot opens again, or 0 if it is open now. */
function minutesUntilSlot(slot, date = new Date()) {
  const window = SLOT_WINDOWS[slot];
  if (!window) return null;

  const m = minutesOfDay(date);
  if (m >= window.from && m < window.to) return 0;
  if (m < window.from) return window.from - m;

  return 24 * 60 - m + window.from; // tomorrow
}

function isServedNow(dish, date = new Date()) {
  if (!dish) return false;
  if (!isCanteenOpen(date)) return false;
  if (dish.slot === 'allday') return true;

  const window = SLOT_WINDOWS[dish.slot];
  if (!window) return false;

  const m = minutesOfDay(date);
  return m >= window.from && m < window.to;
}

/** In its slot, in stock, and not switched off by staff. */
function isOrderable(dish, date = new Date()) {
  if (!dish) return false;
  if (dish.disabled === true) return false;
  return isServedNow(dish, date) && Number(dish.stock) > 0;
}

function formatMinutes(total) {
  const h24 = Math.floor(total / 60);
  const mm = String(total % 60).padStart(2, '0');
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${suffix}`;
}

function slotLabel(slot) {
  const w = SLOT_WINDOWS[slot];
  if (!w) return 'Not served';
  return `Served ${formatMinutes(w.from)} - ${formatMinutes(w.to)}`;
}

/** Why can't I order this? Returns null when it is orderable. */
function blockedReason(dish, date = new Date()) {
  if (!isCanteenOpen(date)) return 'The canteen is closed';
  if (dish.disabled) return 'Taken off the menu today';
  if (Number(dish.stock) <= 0) return 'Sold out';
  if (!isServedNow(dish, date)) return slotLabel(dish.slot);
  return null;
}

module.exports = {
  OPEN_FROM,
  OPEN_TO,
  SLOT_WINDOWS,
  SLOT_ORDER,
  minutesOfDay,
  isCanteenOpen,
  currentSlot,
  minutesUntilSlot,
  isServedNow,
  isOrderable,
  slotLabel,
  formatMinutes,
  blockedReason,
};
