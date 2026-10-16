// logic/ratings.js
// Dish ratings. Stored as running totals so an average never has to walk
// every order, and weighted so one angry review cannot sink a dish.

const PRIOR_COUNT = 5;    // pretend every dish starts with 5 votes...
const PRIOR_MEAN = 3.8;   // ...at roughly the canteen average

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function blankRating(dishId) {
  return { dishId, count: 0, sum: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
}

function isValidStars(stars) {
  return Number.isInteger(stars) && stars >= 1 && stars <= 5;
}

/**
 * Bayesian average: pulls a dish with very few votes towards the canteen
 * mean, so 1 five-star vote does not beat 200 four-star votes.
 */
function weightedAverage(record) {
  if (!record || record.count === 0) return PRIOR_MEAN;
  const total = record.sum + PRIOR_MEAN * PRIOR_COUNT;
  const votes = record.count + PRIOR_COUNT;
  return round1(total / votes);
}

/** Add one vote. Returns a new record; does not change the old one. */
function addRating(record, stars) {
  if (!isValidStars(stars)) return record;

  const next = record ? structuredClone(record) : blankRating(null);
  next.count += 1;
  next.sum += stars;
  next.distribution[stars] = (next.distribution[stars] || 0) + 1;

  return next;
}

/** What share of votes each star got, for the bars in the dish modal. */
function distributionPercent(record) {
  if (!record || record.count === 0) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return Object.fromEntries(
    Object.entries(record.distribution).map(([stars, n]) => [
      stars,
      Math.round((n / record.count) * 100),
    ])
  );
}

/**
 * Apply a whole order's ratings.
 * ratings looks like [{ dishId, stars }].
 * Returns { records, applied, errors }.
 */
function applyOrderRatings(records, ratings, orderItems) {
  const errors = [];
  const allowed = new Set(orderItems.map((l) => Number(l.dishId)));
  let next = records.slice();
  let applied = 0;

  ratings.forEach((entry, index) => {
    const dishId = Number(entry && entry.dishId);
    const stars = Number(entry && entry.stars);

    if (!allowed.has(dishId)) {
      errors.push(`ratings[${index}]: dish ${dishId} was not in this order`);
      return;
    }
    if (!isValidStars(stars)) {
      errors.push(`ratings[${index}]: stars must be a whole number from 1 to 5`);
      return;
    }

    const existing = next.find((r) => r.dishId === dishId) || blankRating(dishId);
    const updated = addRating({ ...existing, dishId }, stars);

    next = next.filter((r) => r.dishId !== dishId).concat(updated);
    applied += 1;
  });

  return { records: next, applied, errors };
}

module.exports = {
  PRIOR_COUNT,
  PRIOR_MEAN,
  blankRating,
  isValidStars,
  weightedAverage,
  addRating,
  distributionPercent,
  applyOrderRatings,
};
