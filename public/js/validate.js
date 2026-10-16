/* validate.js - form rules shared by the cart, checkout and staff forms.
   The server checks all of this again; this layer exists so the person
   finds out before they press the button. */

const RULES = {
  room: {
    pattern: /^[A-H]-[0-9]{3}$/,
    message: 'Room must look like B-204',
    normalise: (v) => String(v).trim().toUpperCase(),
  },
  note: {
    maxLength: 140,
    message: 'Note cannot be longer than 140 characters',
  },
  coupon: {
    pattern: /^[A-Z0-9]{4,12}$/,
    message: 'Coupon codes are 4 to 12 letters or numbers',
    normalise: (v) => String(v).trim().toUpperCase(),
  },
  tip: {
    min: 0,
    max: 100,
    message: 'Tip must be between Rs. 0 and Rs. 100',
  },
  stock: {
    min: 0,
    max: 99,
    integer: true,
    message: 'Stock must be a whole number from 0 to 99',
  },
  points: {
    min: 0,
    step: 50,
    message: 'Points are spent 50 at a time',
  },
};

/**
 * Check one value against a named rule.
 * Returns { ok, value, message }. An empty value passes unless required.
 */
function checkField(name, rawValue, { required = false } = {}) {
  const rule = RULES[name];
  if (!rule) return { ok: true, value: rawValue, message: null };

  const value = rule.normalise ? rule.normalise(rawValue) : rawValue;
  const empty = value === '' || value === null || value === undefined;

  if (empty) {
    return required
      ? { ok: false, value, message: 'This is required' }
      : { ok: true, value, message: null };
  }

  if (rule.pattern && !rule.pattern.test(String(value))) {
    return { ok: false, value, message: rule.message };
  }
  if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
    return { ok: false, value, message: rule.message };
  }

  if (rule.min !== undefined || rule.max !== undefined || rule.step || rule.integer) {
    const num = Number(value);

    if (Number.isNaN(num)) return { ok: false, value, message: rule.message };
    if (rule.integer && !Number.isInteger(num)) return { ok: false, value, message: rule.message };
    if (rule.min !== undefined && num < rule.min) return { ok: false, value, message: rule.message };
    if (rule.max !== undefined && num > rule.max) return { ok: false, value, message: rule.message };
    if (rule.step && num % rule.step !== 0) return { ok: false, value, message: rule.message };

    return { ok: true, value: num, message: null };
  }

  return { ok: true, value, message: null };
}

/**
 * Wire an input to a rule: validates as the person types, shows the
 * message under the field, and reports back through onChange.
 */
function bindField(input, errorNode, ruleName, onChange) {
  if (!input) return { check: () => ({ ok: true }) };

  const run = () => {
    const result = checkField(ruleName, input.value);

    input.classList.toggle('invalid', !result.ok);
    input.setAttribute('aria-invalid', String(!result.ok));

    if (errorNode) {
      errorNode.textContent = result.message || '';
      errorNode.hidden = result.ok;
    }

    if (onChange) onChange(result);
    return result;
  };

  input.addEventListener('input', run);
  input.addEventListener('blur', run);

  return { check: run };
}

/** Check a whole form at once: { field: [ruleName, value] }. */
function checkAll(entries) {
  const problems = [];
  const values = {};

  Object.entries(entries).forEach(([field, [ruleName, value, options]]) => {
    const result = checkField(ruleName, value, options);
    values[field] = result.value;
    if (!result.ok) problems.push(`${field}: ${result.message}`);
  });

  return { ok: problems.length === 0, values, problems };
}
