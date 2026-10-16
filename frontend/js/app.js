/* app.js - routes, theme, keyboard shortcuts, connection handling and
   boot. Loaded last, so every other module is already defined. */

/* ---------------------------------------------------------- routes */

defineRoute('menu', {
  title: 'Menu',
  enter: () => {
    loadMenu();
    loadPicks();
  },
});

defineRoute('orders', {
  title: 'My Orders',
  enter: loadMyOrders,
  leave: stopTracking,
});

defineRoute('staff', {
  title: 'Counter',
  enter: () => {
    startStaffLoop();
    loadStock();
  },
  leave: stopStaffLoop,
});

/* ------------------------------------------------------------- nav */

const navToggle = $('#navToggle');
const siteNav = $('#siteNav');

navToggle.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

delegate(siteNav, '.nav-link', 'click', () => {
  siteNav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
});

/* ----------------------------------------------------------- theme */

const themeBtn = $('#themeBtn');

function applyTheme(theme) {
  setTheme(theme);
  themeBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
  themeBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// follow the system setting until the person picks one themselves
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!currentTheme()) applyTheme(e.matches ? 'dark' : 'light');
});

/* ------------------------------------------------------- shortcuts */

document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

  if (e.key === '/' && !typing) {
    e.preventDefault();
    goto('menu');
    $('#searchInput').focus();
    return;
  }

  if (e.key.toLowerCase() === 'c' && !typing && !topModal()) {
    e.preventDefault();
    openCart();
  }
});

/* ------------------------------------------------- connection care */

// a tab coming back into view should not show stale numbers
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  api.clearCache();

  if (state.route === 'staff') loadStaff();
  if (state.route === 'orders') loadMyOrders();
  if (state.route === 'menu') loadMenu();
});

window.addEventListener('offline', () => {
  document.body.classList.add('is-offline');
  toast('You are offline. Your cart is saved.', 'warn', { ms: 5000 });
});

window.addEventListener('online', () => {
  document.body.classList.remove('is-offline');
  toast('Back online', 'ok');
  api.clearCache();
  applyRoute();
  loadMenu();
});

/* ------------------------------------------------------------ boot */

async function boot() {
  applyTheme(preferredTheme());
  setText('#buildTag', document.documentElement.dataset.build || 'unknown');
  setText('#cartCount', cartCount());

  try {
    const health = await api.health();

    state.slot = health.slot;
    state.open = health.open;
    state.rushHour = health.rushHour;
    state.serverTime = health.serverTime;

    setText('#serverClock', clockString(health.serverTime));
    renderSlotBar();
  } catch (e) {
    setText('#slotBar', 'Cannot reach the canteen server.');
  }

  renderCartLines();
  loadCouponHints();
  loadCategories();

  applyRoute();

  // the clock in the footer ticks along with the server, not the laptop
  setInterval(() => {
    if (!state.serverTime) return;
    state.serverTime = new Date(new Date(state.serverTime).getTime() + 30000).toISOString();
    setText('#serverClock', clockString(state.serverTime));
  }, 30000);
}

boot();
