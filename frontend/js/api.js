/* api.js - every network call. Nothing else calls fetch().

   What this layer takes care of:
     - a request replaced by a newer one is aborted, so a slow old answer
       can never overwrite a fresh one
     - a 200 response carrying { status: "error" } is still an error
     - GET requests can be cached briefly, so switching tabs does not
       re-fetch the same list every time
     - the device id and idempotency key headers are attached here
*/

const API_BASE = '/api';
const inFlight = new Map();
const cache = new Map();
const CACHE_MS = 15000;

class ApiError extends Error {
  constructor(message, status, details, requestId) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details || [];
    this.requestId = requestId;
    this.offline = status === 0;
  }
}

function cacheKey(path, options) {
  return `${options.method || 'GET'} ${path}`;
}

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function clearCache(prefix) {
  if (!prefix) return cache.clear();
  [...cache.keys()].filter((k) => k.includes(prefix)).forEach((k) => cache.delete(k));
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body = null,
    key = null,
    timeout = 9000,
    cacheable = false,
    headers = {},
  } = options;

  const ck = cacheKey(path, options);
  if (cacheable && method === 'GET') {
    const hit = readCache(ck);
    if (hit) return hit;
  }

  // one request per key: a new one cancels the last
  if (key && inFlight.has(key)) inFlight.get(key).abort();

  const controller = new AbortController();
  if (key) inFlight.set(key, controller);

  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'X-Member-Id': deviceId(),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (key) inFlight.delete(key);

    if (err.name === 'AbortError') {
      const cancelled = new ApiError('cancelled', 0);
      cancelled.cancelled = true;
      throw cancelled;
    }
    throw new ApiError('You seem to be offline', 0);
  }

  clearTimeout(timer);
  if (key) inFlight.delete(key);

  const requestId = res.headers.get('X-Request-Id');

  let payload = null;
  try {
    payload = await res.json();
  } catch (e) {
    throw new ApiError('The server sent something that was not JSON', res.status, [], requestId);
  }

  const looksWrong = payload && payload.status === 'error';

  if (!res.ok || looksWrong) {
    const message = (payload && (payload.error || payload.message)) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload && payload.details, requestId);
  }

  if (cacheable && method === 'GET') cache.set(ck, { at: Date.now(), data: payload });

  return payload;
}

function query(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined || v === 'all' || v === false) return;
    q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

const api = {
  health: () => request('/health'),

  /* menu */
  getMenu: (params = {}) => request('/menu' + query(params), { key: 'menu' }),
  suggest: (q) => request('/menu/suggest' + query({ q }), { key: 'suggest' }),
  getCategories: () => request('/menu/categories', { cacheable: true }),
  getPicks: () => request('/menu/picks', { cacheable: true }),
  getDish: (id) => request(`/menu/${id}`, { key: 'dish' }),

  /* cart and checkout */
  quote: (payload) => request('/cart/quote', { method: 'POST', body: payload, key: 'quote' }),
  getCoupons: () => request('/coupons', { cacheable: true }),
  getPickupSlots: () => request('/pickup-slots', { key: 'slots' }),
  getMember: (id) => request(`/members/${id}`, { key: 'member' }),

  placeOrder: (payload, idemKey) =>
    request('/orders', {
      method: 'POST',
      body: payload,
      headers: { 'Idempotency-Key': idemKey },
      timeout: 15000,
    }),

  /* orders */
  getOrder: (token) => request(`/orders/${token}`),
  listOrders: (params = {}) => request('/orders' + query(params), { key: 'orders' }),
  setStatus: (token, status, manual) =>
    request(`/orders/${token}/status`, { method: 'PATCH', body: { status, manual } }),
  rateOrder: (token, ratings) =>
    request(`/orders/${token}/rate`, { method: 'POST', body: { ratings } }),

  /* staff */
  setStock: (id, stock) => request(`/menu/${id}/stock`, { method: 'PATCH', body: { stock } }),
  setDishAvailability: (id, disabled) =>
    request(`/menu/${id}/availability`, { method: 'PATCH', body: { disabled } }),
  stats: () => request('/stats', { key: 'stats' }),

  clearCache,
};
