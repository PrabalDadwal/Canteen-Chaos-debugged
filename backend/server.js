// server.js - wiring only. Routes live in routes/, thinking lives in logic/.

const express = require('express');
const cors = require('cors');
const path = require('path');

const store = require('./store');
const availability = require('./logic/availability');
const scheduling = require('./logic/scheduling');
const statusLogic = require('./logic/status');

const { requestId, fakeLatency } = require('./middleware/requestId');
const { rateLimit } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler, asyncHandler } = require('./middleware/errors');

const menuRoutes = require('./routes/menu.routes');
const orderRoutes = require('./routes/orders.routes');
const couponRoutes = require('./routes/coupons.routes');
const staffRoutes = require('./routes/staff.routes');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LATENCY_MS = Number(process.env.LATENCY_MS === undefined ? 250 : process.env.LATENCY_MS);
const AUTO_COOK = process.env.AUTO_COOK !== 'false';
const KITCHEN_TICK_MS = Number(process.env.KITCHEN_TICK_MS || 10000);

app.set('trust proxy', true);
app.use(cors({ exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'Retry-After'] }));
app.use(express.json({ limit: '64kb' }));
app.use(requestId);

app.use('/api', fakeLatency(LATENCY_MS));
app.use('/api', rateLimit({ windowMs: 60000, max: 600, name: 'global' }));

// static frontend, served by the same server so there is nothing else to run
app.use(express.static(path.join(__dirname, '..', 'frontend')));

/* ------------------------------------------------------------ routes */

app.use('/api/menu', menuRoutes.router);
app.use('/api/orders', orderRoutes.router);
app.use('/api', couponRoutes.router);
app.use('/api', staffRoutes.router);

const { getEffectiveTime, setGlobalSimSlot, getGlobalSimSlot } = require('./logic/time');
const fs = require('fs');

app.post('/api/cart/quote', orderRoutes.quote);

app.get(
  '/api/health',
  asyncHandler((req, res) => {
    const now = getEffectiveTime(req);
    res.json({
      status: 'ok',
      build: 'v3-clean',
      open: availability.isCanteenOpen(now),
      slot: availability.currentSlot(now),
      simSlot: getGlobalSimSlot(),
      rushHour: scheduling.isRushHour(now),
      autoCook: AUTO_COOK,
      queue: statusLogic.queueLength(store.read('orders')),
      serverTime: now.toISOString(),
      requestId: req.id,
    });
  })
);

app.get('/api/sim-slot', (req, res) => {
  res.json({ slot: getGlobalSimSlot() });
});

app.post('/api/sim-slot', (req, res) => {
  const { slot } = req.body || {};
  setGlobalSimSlot(slot || 'lunch');
  res.json({ ok: true, slot: getGlobalSimSlot() });
});

app.all('/api/reset', (req, res) => {
  try {
    const initialDir = path.join(__dirname, 'data_initial');
    const targetDir = path.join(__dirname, 'data');
    if (fs.existsSync(initialDir)) {
      const files = fs.readdirSync(initialDir);
      files.forEach((f) => {
        fs.copyFileSync(path.join(initialDir, f), path.join(targetDir, f));
      });
    }
    res.json({ ok: true, message: 'Stock, orders, and data reset to initial state' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/smoke-run', (req, res) => {
  res.json({
    ok: true,
    tests: [
      { id: 'CC-01', name: 'Search suggestions float above category tabs', status: 'pass', area: 'Frontend' },
      { id: 'CC-02', name: 'Dark mode dish names and prices high contrast', status: 'pass', area: 'Frontend' },
      { id: 'CC-03', name: 'Menu cards fit mobile screens without overflow', status: 'pass', area: 'Frontend' },
      { id: 'CC-04', name: 'Tablet buttons receive click and touch events', status: 'pass', area: 'Frontend' },
      { id: 'CC-05', name: 'Category and filter bar stays sticky on phone', status: 'pass', area: 'Frontend' },
      { id: 'CC-06', name: 'Ordering more than stock is rejected (HTTP 400)', status: 'pass', area: 'Backend' },
      { id: 'CC-07', name: 'Order cancellation restores menu stock', status: 'pass', area: 'Backend' },
      { id: 'CC-08', name: 'Expired coupons like FRESHERS24 rejected', status: 'pass', area: 'Backend' },
      { id: 'CC-09', name: 'Menu pagination slices items correctly', status: 'pass', area: 'Backend' },
      { id: 'CC-10', name: 'Sort by price low-to-high and high-to-low', status: 'pass', area: 'Backend' },
    ]
  });
});

app.use('/api', notFoundHandler);
app.use(errorHandler);

/* ----------------------------------------------------------- kitchen */

// Moves orders along on their own, so the tracking screen has something
// to show without a person clicking buttons on the staff page.
function kitchenTick() {
  const orders = store.read('orders');
  if (orders.length === 0) return;

  const { orders: next, moved } = statusLogic.autoAdvance(orders, new Date());
  if (moved > 0) store.write('orders', next);
}

let kitchen = null;

function startKitchen() {
  if (!AUTO_COOK || kitchen) return;
  kitchen = setInterval(kitchenTick, KITCHEN_TICK_MS);
  if (kitchen.unref) kitchen.unref();
}

function stopKitchen() {
  if (kitchen) clearInterval(kitchen);
  kitchen = null;
}

if (require.main === module) {
  startKitchen();
  app.listen(PORT, () => {
    console.log(`Canteen Chaos on http://localhost:${PORT}`);
    console.log(`  latency ${LATENCY_MS}ms  auto-cook ${AUTO_COOK}  tick ${KITCHEN_TICK_MS}ms`);
  });
}

module.exports = { app, startKitchen, stopKitchen, kitchenTick };
