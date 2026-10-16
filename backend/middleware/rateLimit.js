// middleware/rateLimit.js
// A fixed-window limiter, kept in memory. Enough to stop someone
// double-tapping "Place Order" forty times, not a production limiter.

const { tooMany } = require('./errors');

function rateLimit({ windowMs = 60000, max = 20, name = 'default' } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  // drop old entries now and then so the map cannot grow forever
  const sweep = setInterval(() => {
    const now = Date.now();
    hits.forEach((entry, key) => {
      if (entry.resetAt <= now) hits.delete(key);
    });
  }, windowMs);

  if (sweep.unref) sweep.unref();

  return function limiter(req, res, next) {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      setHeaders(res, max, max - 1, now + windowMs);
      return next();
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    setHeaders(res, max, remaining, entry.resetAt);

    if (entry.count > max) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', seconds);
      return next(tooMany(`Too many requests. Try again in ${seconds}s.`));
    }

    next();
  };
}

function setHeaders(res, limit, remaining, resetAt) {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
}

module.exports = { rateLimit };
