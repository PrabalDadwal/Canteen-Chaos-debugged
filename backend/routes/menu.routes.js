// routes/menu.routes.js
// Browsing the menu: list, search, suggestions, one dish, ratings and
// "often bought with".

const express = require('express');

const store = require('../store');
const search = require('../logic/search');
const ratings = require('../logic/ratings');
const recommend = require('../logic/recommend');
const availability = require('../logic/availability');
const { getEffectiveTime } = require('../logic/time');
const { findDish } = require('../logic/pricing');
const { asyncHandler, notFound } = require('../middleware/errors');
const { parseListQuery } = require('../middleware/validate');

const router = express.Router();

/** Add the fields the browser needs but the file does not store. */
function decorate(dish, now, ratingRecords, counts) {
  const record = ratingRecords.find((r) => r.dishId === dish.id);

  return {
    ...dish,
    rating: record && record.count > 0 ? ratings.weightedAverage(record) : dish.rating,
    ratingCount: record ? record.count : 0,
    orderCount: counts.get(dish.id) || 0,
    servedNow: availability.isServedNow(dish, now),
    orderable: availability.isOrderable(dish, now),
    slotLabel: availability.slotLabel(dish.slot),
    blockedReason: availability.blockedReason(dish, now),
  };
}

function allDishes(now) {
  const counts = recommend.orderCounts(store.read('orders'));
  const records = store.read('ratings');
  return store.readMenu().map((d) => decorate(d, now, records, counts));
}

// GET /api/menu
router.get(
  '/',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    const { page, limit, sort } = parseListQuery(req.query);
    const { veg, q, category, servedOnly, maxPrice, tag } = req.query;

    let dishes = allDishes(now);

    if (veg === 'true') dishes = dishes.filter((d) => d.veg === true);
    if (veg === 'false') dishes = dishes.filter((d) => d.veg === false);
    if (category && category !== 'All') dishes = dishes.filter((d) => d.category === category);
    if (servedOnly === 'true') dishes = dishes.filter((d) => d.servedNow);
    if (tag) dishes = dishes.filter((d) => (d.tags || []).includes(tag));
    if (maxPrice) dishes = dishes.filter((d) => d.price <= Number(maxPrice));

    if (q) dishes = search.searchDishes(dishes, q);
    else dishes = search.sortDishes(dishes, sort);

    // a search is already ranked; only re-sort when the user asked for one
    if (q && sort !== 'default') dishes = search.sortDishes(dishes, sort);

    const paged = search.paginate(dishes, page, limit);

    res.json({
      ...paged,
      dishes: paged.items,
      items: undefined,
      slot: availability.currentSlot(now),
      open: availability.isCanteenOpen(now),
      serverTime: now.toISOString(),
    });
  })
);

// GET /api/menu/suggest?q=mom
router.get(
  '/suggest',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    const suggestions = search.suggest(allDishes(now), req.query.q || '', 6);
    res.json({ query: req.query.q || '', suggestions });
  })
);

// GET /api/menu/categories
router.get(
  '/categories',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    const dishes = allDishes(now);
    const counts = {};

    dishes.forEach((d) => {
      counts[d.category] = counts[d.category] || { name: d.category, count: 0, servedNow: 0 };
      counts[d.category].count += 1;
      if (d.servedNow) counts[d.category].servedNow += 1;
    });

    res.json({ categories: Object.values(counts) });
  })
);

// GET /api/menu/picks - the strip at the top of the menu page
router.get(
  '/picks',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    const orders = store.read('orders');
    const memberId = req.get('X-Member-Id');
    const mine = memberId ? orders.filter((o) => o.memberId === memberId) : [];

    res.json({ picks: recommend.forMember(mine, orders, allDishes(now), 4) });
  })
);

// GET /api/menu/:id
router.get(
  '/:id',
  asyncHandler((req, res) => {
    const now = new Date();
    const dish = findDish(req.params.id, allDishes(now));
    if (!dish) throw notFound('Dish not found');

    const record = store.read('ratings').find((r) => r.dishId === dish.id);
    const orders = store.read('orders');

    res.json({
      ...dish,
      ratingBreakdown: ratings.distributionPercent(record),
      alsoBought: recommend.alsoBought(dish.id, orders, allDishes(now), 3),
      minutesUntilSlot: availability.minutesUntilSlot(dish.slot, now),
    });
  })
);

module.exports = { router, allDishes, decorate };
