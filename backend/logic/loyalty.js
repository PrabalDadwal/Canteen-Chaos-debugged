// logic/loyalty.js
// Canteen points. Earned on what you actually pay for food, spent in
// blocks, and always verified against the server's copy of the balance.

const POINTS_PER_RUPEE = 1 / 20;   // 1 point for every Rs. 20 of food
const POINT_VALUE = 0.2;           // 1 point is worth Rs. 0.20
const REDEEM_BLOCK = 50;           // points can only be spent 50 at a time
const MAX_REDEEM_SHARE = 0.5;      // never take more than half the food bill

const TIERS = [
  { name: 'Regular', from: 0, bonus: 1 },
  { name: 'Frequent', from: 300, bonus: 1.2 },
  { name: 'Legend', from: 800, bonus: 1.5 },
];

function tierFor(points) {
  return TIERS.slice().reverse().find((t) => points >= t.from) || TIERS[0];
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Points earned on an order, after discounts, rounded down. */
function pointsEarned(foodTotal, lifetimePoints = 0) {
  const tier = tierFor(lifetimePoints);
  return Math.floor(foodTotal * POINTS_PER_RUPEE * tier.bonus);
}

/**
 * Check a redemption request.
 * Returns { ok, points, value, reason }.
 */
function checkRedemption(requestedPoints, balance, subtotal) {
  const points = Number(requestedPoints) || 0;
  if (points <= 0) return { ok: true, points: 0, value: 0, reason: null };

  if (!Number.isInteger(points)) {
    return { ok: false, points: 0, value: 0, reason: 'Points must be a whole number' };
  }
  if (points % REDEEM_BLOCK !== 0) {
    return { ok: false, points: 0, value: 0, reason: `Points are spent ${REDEEM_BLOCK} at a time` };
  }
  if (points > balance) {
    return { ok: false, points: 0, value: 0, reason: `You only have ${balance} points` };
  }

  const value = round2(points * POINT_VALUE);
  const cap = round2(subtotal * MAX_REDEEM_SHARE);

  if (value > cap) {
    return {
      ok: false,
      points: 0,
      value: 0,
      reason: `Points can cover at most Rs. ${cap} of this order`,
    };
  }

  return { ok: true, points, value, reason: null };
}

/** A member record, created on first sight. */
function blankMember(id) {
  return { id, points: 0, lifetimePoints: 0, orders: 0, createdAt: new Date().toISOString() };
}

function applyOrder(member, { earned, spent }) {
  return {
    ...member,
    points: member.points - spent + earned,
    lifetimePoints: member.lifetimePoints + earned,
    orders: member.orders + 1,
  };
}

module.exports = {
  POINTS_PER_RUPEE,
  POINT_VALUE,
  REDEEM_BLOCK,
  MAX_REDEEM_SHARE,
  TIERS,
  tierFor,
  pointsEarned,
  checkRedemption,
  blankMember,
  applyOrder,
};
