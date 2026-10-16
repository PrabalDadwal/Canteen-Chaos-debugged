/* utils.js - pure helpers. No DOM, no network, no state. */

function round2(n) {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

function rupees(n) {
  const value = round2(n);
  return 'Rs. ' + value.toFixed(2).replace(/\.00$/, '');
}

function pluralise(count, one, many) {
  return `${count} ${count === 1 ? one : many || one + 's'}`;
}

function debounce(fn, wait) {
  let timer = null;
  const wrapped = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

function throttle(fn, wait) {
  let last = 0;
  let queued = null;

  return function (...args) {
    const now = Date.now();
    const wait_left = wait - (now - last);

    if (wait_left <= 0) {
      clearTimeout(queued);
      last = now;
      return fn.apply(this, args);
    }

    clearTimeout(queued);
    queued = setTimeout(() => {
      last = Date.now();
      fn.apply(this, args);
    }, wait_left);
  };
}

/** Wait a bit, used by the polling backoff. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function clockString(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "13:45" -> "1:45 PM" */
function prettyClock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** localStorage that never throws, so private browsing cannot break the app. */
const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      /* nothing to do */
    }
  },
};

/** A random id for this device, so the loyalty wallet has an owner. */
function deviceId() {
  const existing = storage.get('cc_device_id', null);
  if (existing) return existing;

  const fresh = 'dev-' + Math.random().toString(36).slice(2, 10);
  storage.set('cc_device_id', fresh);
  return fresh;
}

/** A key that makes a repeated "Place Order" click harmless. */
function idempotencyKey() {
  return 'idem-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function groupBy(list, keyFn) {
  return list.reduce((groups, item) => {
    const key = keyFn(item);
    (groups[key] = groups[key] || []).push(item);
    return groups;
  }, {});
}

function unique(list) {
  return [...new Set(list)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
