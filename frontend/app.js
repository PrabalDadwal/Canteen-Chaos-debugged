/* ------------------------------------------------------------------
   app.js - rendering, cart state, and all the wiring.
   ------------------------------------------------------------------ */

const CART_KEY = 'cc_cart_v1';
const PACKING_CHARGE = 10;

const state = {
  dishes: [],
  cart: loadCart(),        // { [dishId]: qty }
  filters: { veg: 'all', q: '' },
  lastOrder: null,
};

/* ---------------------------------------------------------- helpers */

function rupees(n) {
  return 'Rs. ' + (Math.round((n + Number.EPSILON) * 100) / 100);
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch (e) {
    /* private browsing - carry on without saving */
  }
}

function cartCount() {
  return Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
}

function cartTotals() {
  let subtotal = 0;

  Object.entries(state.cart).forEach(([dishId, qty]) => {
    const dish = state.dishes.find((d) => d.id === Number(dishId));
    if (dish) subtotal += dish.price * qty;
  });

  subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  const packing = subtotal > 0 ? PACKING_CHARGE : 0;
  const total = Math.round((subtotal + packing + Number.EPSILON) * 100) / 100;

  return { subtotal, packing, total };
}

/* ---------------------------------------------------------- menu */

const menuGrid = document.getElementById('menuGrid');
const menuStatus = document.getElementById('menuStatus');

function showStatus(html) {
  menuStatus.innerHTML = html;
  menuStatus.hidden = false;
}

function hideStatus() {
  menuStatus.hidden = true;
  menuStatus.innerHTML = '';
}

async function loadMenu() {
  showStatus('<div class="spinner"></div>Loading the menu...');
  menuGrid.innerHTML = '';

  try {
    const data = await api.getMenu(state.filters);
    state.dishes = data.dishes;

    if (state.dishes.length === 0) {
      showStatus('No dishes match that search.');
      return;
    }

    hideStatus();
    renderMenu();
  } catch (err) {
    showStatus(
      `Could not load the menu.<br><small>${err.message}</small><br>` +
      `<button class="add-btn" style="width:auto;margin-top:10px" id="retryBtn">Try again</button>`
    );
    const retry = document.getElementById('retryBtn');
    if (retry) retry.addEventListener('click', loadMenu);
  } finally {
    updateCartUI();
  }
}

function renderMenu() {
  menuGrid.innerHTML = state.dishes.map(dishCard).join('');
}

function dishCard(dish) {
  const qty = state.cart[dish.id] || 0;

  return `
    <article class="dish-card ${dish.available ? '' : 'sold-out'}" data-id="${dish.id}">
      <img src="${dish.image}" alt="${dish.name}" loading="lazy" />
      <div class="dish-body">
        <h3 class="dish-name">${dish.name}</h3>
        <div class="dish-meta">
          <span class="veg-dot ${dish.veg ? '' : 'nonveg'}"></span>
          <span>${dish.category}</span>
          ${dish.available ? '' : '<span class="sold-tag">Sold out</span>'}
        </div>
        <div class="dish-price">${rupees(dish.price)}</div>
        <div class="qty-row">
          <button class="qty-btn" data-action="dec" aria-label="Reduce quantity of ${dish.name}">&minus;</button>
          <span class="qty-value" data-qty="${dish.id}">${qty}</span>
          <button class="qty-btn" data-action="inc" aria-label="Increase quantity of ${dish.name}">+</button>
        </div>
        <button class="add-btn" data-action="add" ${dish.available ? '' : 'disabled'}>
          Add to Cart
        </button>
      </div>
    </article>
  `;
}

// one listener on the grid, so it keeps working after a re-render
menuGrid.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;

  const card = e.target.closest('.dish-card');
  if (!card) return;

  const id = Number(card.dataset.id);
  const dish = state.dishes.find((d) => d.id === id);
  if (!dish || !dish.available) return;

  const action = button.dataset.action;
  const current = state.cart[id] || 0;

  if (action === 'inc' || action === 'add') {
    if (current >= 10) return;
    state.cart[id] = current + 1;
  }

  if (action === 'dec') {
    if (current <= 1) delete state.cart[id];
    else state.cart[id] = current - 1;
  }

  saveCart();
  updateQty(id);
  updateCartUI();

  if (action === 'add') openCart();
});

function updateQty(id) {
  const el = menuGrid.querySelector(`[data-qty="${id}"]`);
  if (el) el.textContent = state.cart[id] || 0;
}

/* ---------------------------------------------------------- cart */

const cartPanel = document.getElementById('cartPanel');
const cartOverlay = document.getElementById('cartOverlay');
const cartItems = document.getElementById('cartItems');
const cartError = document.getElementById('cartError');
const placeOrderBtn = document.getElementById('placeOrderBtn');

function updateCartUI() {
  const count = cartCount();
  document.getElementById('cartCount').textContent = count;

  const entries = Object.entries(state.cart);

  if (entries.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
  } else {
    cartItems.innerHTML = entries
      .map(([dishId, qty]) => {
        const dish = state.dishes.find((d) => d.id === Number(dishId));
        if (!dish) return '';
        return `
          <div class="cart-line">
            <span class="cart-line-name">${dish.name} &times; ${qty}</span>
            <span>${rupees(dish.price * qty)}</span>
          </div>`;
      })
      .join('');
  }

  const { subtotal, packing, total } = cartTotals();
  document.getElementById('subtotal').textContent = rupees(subtotal);
  document.getElementById('packing').textContent = rupees(packing);
  document.getElementById('total').textContent = rupees(total);

  placeOrderBtn.disabled = count === 0;
}

function openCart() {
  cartPanel.hidden = false;
  cartOverlay.hidden = false;
}

function closeCart() {
  cartPanel.hidden = true;
  cartOverlay.hidden = true;
}

document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

/* ---------------------------------------------------------- order */

placeOrderBtn.addEventListener('click', async () => {
  const items = Object.entries(state.cart).map(([dishId, qty]) => ({
    dishId: Number(dishId),
    qty,
  }));

  cartError.hidden = true;
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Placing...';

  try {
    const order = await api.placeOrder(items);
    state.lastOrder = order;
    state.cart = {};
    saveCart();
    renderMenu();
    updateCartUI();
    closeCart();
    showOrderModal(order);
  } catch (err) {
    cartError.textContent = err.message;
    cartError.hidden = false;
  } finally {
    placeOrderBtn.textContent = 'Place Order';
    placeOrderBtn.disabled = cartCount() === 0;
  }
});

/* ---------------------------------------------------------- modal */

const modal = document.getElementById('orderModal');
const modalBackdrop = document.getElementById('modalBackdrop');
let lastFocused = null;

function showOrderModal(order) {
  document.getElementById('orderToken').textContent = order.token;
  document.getElementById('orderEta').textContent =
    `Ready in about ${order.etaMinutes} minutes`;
  document.getElementById('orderStatus').textContent = order.status;

  lastFocused = document.activeElement;
  modal.hidden = false;
  modalBackdrop.hidden = false;
  document.getElementById('modalClose').focus();
  document.addEventListener('keydown', onModalKeydown);
}

function closeModal() {
  modal.hidden = true;
  modalBackdrop.hidden = true;
  document.removeEventListener('keydown', onModalKeydown);
  if (lastFocused) lastFocused.focus();
}

function onModalKeydown(e) {
  if (e.key === 'Escape') {
    closeModal();
    return;
  }

  // keep focus inside the dialog while it is open
  if (e.key === 'Tab') {
    const focusables = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

document.getElementById('modalClose').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

/* ---------------------------------------------------------- filters */

const searchInput = document.getElementById('searchInput');
let searchTimer = null;

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const value = e.target.value;
  searchTimer = setTimeout(() => {
    state.filters.q = value;
    loadMenu();
  }, 300);
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    state.filters.veg = chip.dataset.veg;
    loadMenu();
  });
});

/* ---------------------------------------------------------- nav */

const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');

navToggle.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

document.getElementById('myOrderLink').addEventListener('click', (e) => {
  e.preventDefault();
  if (state.lastOrder) showOrderModal(state.lastOrder);
});

/* ---------------------------------------------------------- start */

document.getElementById('buildTag').textContent =
  document.documentElement.dataset.build || 'unknown';

loadMenu();
