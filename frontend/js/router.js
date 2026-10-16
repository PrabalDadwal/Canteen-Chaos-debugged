/* router.js - a tiny hash router.
   Each route says what to do when it is entered and when it is left, so a
   view cannot leave a timer running behind it. */

const routes = new Map();

function defineRoute(name, { enter = null, leave = null, title = null } = {}) {
  routes.set(name, { enter, leave, title });
}

function routeFromHash() {
  const raw = (location.hash || '#/menu').replace(/^#\//, '').split('?')[0];
  return routes.has(raw) ? raw : 'menu';
}

/** Anything after a ? in the hash, e.g. #/menu?category=Snacks */
function routeParams() {
  const [, qs] = (location.hash || '').split('?');
  return Object.fromEntries(new URLSearchParams(qs || ''));
}

let currentRoute = null;

function goto(name) {
  if (location.hash !== `#/${name}`) location.hash = `#/${name}`;
  else applyRoute();
}

function applyRoute() {
  const next = routeFromHash();
  if (next === currentRoute) return;

  const previous = routes.get(currentRoute);
  if (previous && previous.leave) previous.leave();

  currentRoute = next;
  state.route = next;

  $$('.view').forEach((view) => {
    view.hidden = view.id !== `view-${next}`;
  });

  $$('.nav-link').forEach((link) => {
    const active = link.dataset.route === next;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const entry = routes.get(next);
  document.title = entry.title ? `${entry.title} · Hostel Canteen` : 'Hostel Canteen';
  if (entry.enter) entry.enter(routeParams());

  closeAllModals();
  window.scrollTo(0, 0);
  emit('route', next);
}

window.addEventListener('hashchange', applyRoute);
