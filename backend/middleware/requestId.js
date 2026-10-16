// middleware/requestId.js
// Gives every request an id, echoes it back in a header, and logs how long
// it took. The id also goes into error responses, so a student can match a
// failed request in the browser to a line in the server log.

let counter = 0;

function requestId(req, res, next) {
  counter += 1;
  req.id = `r${Date.now().toString(36)}-${counter}`;
  res.setHeader('X-Request-Id', req.id);

  const started = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - started;
    if (process.env.QUIET === 'true') return;
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });

  next();
}

/**
 * The canteen wifi is slow, and so is this API on purpose: it keeps
 * loading states and race conditions honest. LATENCY_MS=0 turns it off.
 */
function fakeLatency(maxMs = 250) {
  return (req, res, next) => {
    if (maxMs <= 0) return next();
    setTimeout(next, Math.floor(Math.random() * maxMs));
  };
}

module.exports = { requestId, fakeLatency };
