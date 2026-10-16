// middleware/validate.js
// A tiny schema checker, so routes do not each invent their own way of
// rejecting bad input. Shape only - business rules live in logic/.

const { badRequest } = require('./errors');

const CHECKS = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
};

/**
 * schema: { field: { type, required, min, max, pattern, enum } }
 * Returns a list of problems, empty when the body is fine.
 */
function checkShape(body, schema) {
  const problems = [];
  const source = body && typeof body === 'object' ? body : {};

  Object.entries(schema).forEach(([field, rule]) => {
    const value = source[field];
    const missing = value === undefined || value === null || value === '';

    if (missing) {
      if (rule.required) problems.push(`${field} is required`);
      return;
    }

    const check = CHECKS[rule.type];
    if (check && !check(value)) {
      problems.push(`${field} must be a ${rule.type}`);
      return;
    }

    if (rule.min !== undefined && Number(value) < rule.min) {
      problems.push(`${field} must be at least ${rule.min}`);
    }
    if (rule.max !== undefined && Number(value) > rule.max) {
      problems.push(`${field} must be at most ${rule.max}`);
    }
    if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
      problems.push(`${field} cannot be longer than ${rule.maxLength} characters`);
    }
    if (rule.pattern && !rule.pattern.test(String(value))) {
      problems.push(rule.message || `${field} is not in the right format`);
    }
    if (rule.enum && !rule.enum.includes(value)) {
      problems.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    }
  });

  return problems;
}

/** Express middleware form. */
function validateBody(schema) {
  return (req, res, next) => {
    const problems = checkShape(req.body, schema);
    if (problems.length > 0) return next(badRequest('Invalid request', problems));
    next();
  };
}

/** Pull page/limit/sort out of a query string, with sane defaults. */
function parseListQuery(query = {}, { defaultLimit = 12, maxLimit = 48 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, sort: query.sort || 'default' };
}

module.exports = { checkShape, validateBody, parseListQuery };
