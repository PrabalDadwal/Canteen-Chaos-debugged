// middleware/errors.js
// One place for "not found" and for turning a thrown error into JSON.

class HttpError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, message, details);
const notFound = (message = 'Not found') => new HttpError(404, message);
const conflict = (message, details) => new HttpError(409, message, details);
const tooMany = (message) => new HttpError(429, message);

/** Wrap an async route so a rejected promise reaches the error handler. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No such route: ${req.method} ${req.path}` });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;

  if (status >= 500) console.error(`[${req.id || '-'}]`, err);

  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on the server' : err.message,
    details: err.details && err.details.length ? err.details : undefined,
    requestId: req.id,
  });
}

module.exports = {
  HttpError,
  badRequest,
  notFound,
  conflict,
  tooMany,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
