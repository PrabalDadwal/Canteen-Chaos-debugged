// routes/coupons.routes.js
// Coupons a student can actually use right now, pickup slots, and the
// loyalty wallet.

const express = require('express');

const store = require('../store');
const availability = require('../logic/availability');
const scheduling = require('../logic/scheduling');
const loyalty = require('../logic/loyalty');
const { getEffectiveTime } = require('../logic/time');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

// GET /api/coupons
router.get(
  '/coupons',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    const slot = availability.currentSlot(now);

    const usable = store
      .read('coupons')
      .filter((c) => new Date(c.expiresAt) > now && c.usesLeft > 0)
      .filter((c) => !slot || c.slots.includes(slot));

    res.json({
      slot,
      coupons: usable.map((c) => ({
        code: c.code,
        description: c.description,
        minOrder: c.minOrder,
        vegOnly: c.vegOnly,
        usesLeft: c.usesLeft,
      })),
    });
  })
);

// GET /api/pickup-slots
router.get(
  '/pickup-slots',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    res.json({
      open: availability.isCanteenOpen(now),
      rushHour: scheduling.isRushHour(now),
      cutoffMinutes: scheduling.CUTOFF_MINUTES,
      slots: scheduling.availableSlots(store.read('orders'), now),
    });
  })
);

// GET /api/members/:id - the wallet for one device
router.get(
  '/members/:id',
  asyncHandler((req, res) => {
    const member =
      store.read('members').find((m) => m.id === req.params.id) ||
      loyalty.blankMember(req.params.id);

    const tier = loyalty.tierFor(member.lifetimePoints);
    const nextTier = loyalty.TIERS.find((t) => t.from > member.lifetimePoints);

    res.json({
      ...member,
      tier: tier.name,
      pointValue: loyalty.POINT_VALUE,
      redeemBlock: loyalty.REDEEM_BLOCK,
      worth: Math.round(member.points * loyalty.POINT_VALUE * 100) / 100,
      nextTier: nextTier ? { name: nextTier.name, pointsAway: nextTier.from - member.lifetimePoints } : null,
    });
  })
);

module.exports = { router };
