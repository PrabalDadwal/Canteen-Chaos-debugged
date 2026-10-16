/* dom.js - small DOM helpers. Loaded early; every other module uses these.

   Templates are written as tagged strings:  html`<p>${name}</p>`
   which escapes every value unless it is wrapped in raw().  */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const RAW = Symbol('raw');
const raw = (value) => ({ [RAW]: String(value) });

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tagged template that escapes by default. Arrays are joined. */
function html(strings, ...values) {
  return strings.reduce((out, chunk, i) => {
    if (i === 0) return chunk;

    const value = values[i - 1];
    let piece;

    if (value === null || value === undefined || value === false) piece = '';
    else if (value && value[RAW] !== undefined) piece = value[RAW];
    else if (Array.isArray(value)) piece = value.map((v) => (v && v[RAW] !== undefined ? v[RAW] : escapeHtml(v))).join('');
    else piece = escapeHtml(value);

    return out + piece + chunk;
  }, '');
}

/** Replace a container's contents in one go. */
function render(target, markup) {
  const node = typeof target === 'string' ? $(target) : target;
  if (node) node.innerHTML = markup;
  return node;
}

function show(node, visible = true) {
  if (node) node.hidden = !visible;
}

function setText(selector, text) {
  const node = typeof selector === 'string' ? $(selector) : selector;
  if (node) node.textContent = text;
}

/**
 * One listener on a container that handles clicks on anything matching
 * `selector` inside it. Survives every re-render, which a per-element
 * listener does not.
 */
function delegate(container, selector, type, handler) {
  const root = typeof container === 'string' ? $(container) : container;
  if (!root) return () => {};

  const listener = (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  };

  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

/** Read a data-* value off the nearest matching ancestor. */
function dataOf(target, selector, key) {
  const node = target.closest(selector);
  return node ? node.dataset[key] : null;
}

function focusFirst(container) {
  const node = container.querySelector(
    'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (node) node.focus();
}

/** Every element in a container that can take keyboard focus. */
function focusableIn(container) {
  return $$(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    container
  ).filter((node) => !node.disabled && node.offsetParent !== null);
}
