/* checkout.js - the checkout modal: pickup slot, room, note, tip,
   loyalty points, and placing the order.

   The same idempotency key is reused while one attempt is in flight, so
   a double tap on "Place Order" can never create two orders. */

const checkoutModal = $('#checkoutModal');
const slotGrid = $('#slotGrid');
const roomInput = $('#roomInput');
const roomError = $('#roomError');
const noteInput = $('#noteInput');
const noteCounter = $('#noteCounter');
const tipRow = $('#tipRow2');
const tipFlatInput = $('#tipFlatInput');
const pointsBox = $('#pointsBox');
const placeBtn = $('#placeOrderBtn');
const checkoutError = $('#checkoutError');

let pendingKey = null;
let placing = false;

/* ----------------------------------------------------------- open */

async function openCheckout() {
  if (cartCount() === 0) return toast('Your cart is empty', 'warn');

  openModal('checkoutModal');
  hydrateFields();
  refreshCheckoutQuote();

  await Promise.all([loadPickupSlots(), loadWallet()]);
}

function hydrateFields() {
  const c = state.checkout;
  roomInput.value = c.room || '';
  noteInput.value = c.note || '';
  noteCounter.textContent = `${(c.note || '').length}/140`;
  tipFlatInput.value = c.tipFlat || '';

  $$('.tip-chip', tipRow).forEach((chip) =>
    chip.classList.toggle('active', Number(chip.dataset.tip) === Number(c.tipPercent))
  );
}

/* --------------------------------------------------- pickup slots */

async function loadPickupSlots() {
  render(slotGrid, skeletonRows(2));

  try {
    const data = await api.getPickupSlots();
    state.pickupSlots = data.slots;

    if (!data.open || data.slots.length === 0) {
      render(slotGrid, '<p class="status-sub">No pickup slots left today. Your order goes to the back of the queue.</p>');
      return;
    }

    render(
      slotGrid,
      data.slots
        .map(
          (s) => html`<button class="slot-chip ${s.full ? 'full' : ''} ${state.checkout.pickupSlot === s.slot ? 'active' : ''}"
                  data-slot="${s.slot}" ${raw(s.full ? 'disabled' : '')}>
              <span class="slot-time">${prettyClock(s.slot)}</span>
              <span class="slot-left">${s.full ? 'Full' : `${s.capacity - s.booked} left`}</span>
            </button>`
        )
        .join('')
    );
  } catch (err) {
    render(slotGrid, errorBlock(err, 'slotRetry'));
    const retry = $('#slotRetry');
    if (retry) retry.addEventListener('click', loadPickupSlots);
  }
}

delegate(slotGrid, '.slot-chip', 'click', (e, node) => {
  const slot = node.dataset.slot;
  const same = state.checkout.pickupSlot === slot;

  $$('.slot-chip', slotGrid).forEach((c) => c.classList.remove('active'));
  if (!same) node.classList.add('active');

  setCheckout({ pickupSlot: same ? null : slot });
  refreshCheckoutQuote();
});

/* ---------------------------------------------------------- wallet */

async function loadWallet() {
  try {
    const member = await api.getMember(deviceId());
    state.member = member;

    if (member.points < member.redeemBlock) {
      render(
        pointsBox,
        html`<p class="points-note">${member.points} points. Collect ${member.redeemBlock} to start spending them.</p>`
      );
      return;
    }

    const steps = [];
    for (let p = member.redeemBlock; p <= member.points; p += member.redeemBlock) steps.push(p);

    render(
      pointsBox,
      html`<p class="points-note">
          <strong>${member.points} points</strong> (${rupees(member.worth)}) &middot; ${member.tier}
        </p>
        <div class="points-row">
          <button class="chip ${state.checkout.redeemPoints === 0 ? 'active' : ''}" data-points="0">None</button>
          ${raw(
            steps
              .slice(0, 4)
              .map(
                (p) => html`<button class="chip ${state.checkout.redeemPoints === p ? 'active' : ''}"
                    data-points="${p}">${p} pts</button>`
              )
              .join('')
          )}
        </div>`
    );
  } catch (e) {
    pointsBox.innerHTML = '';
  }
}

delegate(pointsBox, '[data-points]', 'click', (e, node) => {
  $$('[data-points]', pointsBox).forEach((c) => c.classList.remove('active'));
  node.classList.add('active');
  setCheckout({ redeemPoints: Number(node.dataset.points) });
  refreshCheckoutQuote();
});

/* ------------------------------------------------------ tip + form */

delegate(tipRow, '.tip-chip', 'click', (e, node) => {
  const percent = Number(node.dataset.tip);
  const same = Number(state.checkout.tipPercent) === percent;

  $$('.tip-chip', tipRow).forEach((c) => c.classList.remove('active'));
  if (!same) node.classList.add('active');

  tipFlatInput.value = '';
  setCheckout({ tipPercent: same ? 0 : percent, tipFlat: 0 });
  refreshCheckoutQuote();
});

tipFlatInput.addEventListener(
  'input',
  debounce(() => {
    const result = checkField('tip', tipFlatInput.value);
    if (!result.ok) return toast(result.message, 'warn');

    $$('.tip-chip', tipRow).forEach((c) => c.classList.remove('active'));
    setCheckout({ tipFlat: Number(result.value) || 0, tipPercent: 0 });
    refreshCheckoutQuote();
  }, 400)
);

bindField(roomInput, roomError, 'room', (result) => {
  if (result.ok) setCheckout({ room: result.value });
});

noteInput.addEventListener('input', () => {
  noteCounter.textContent = `${noteInput.value.length}/140`;
  setCheckout({ note: noteInput.value });
});

/* ----------------------------------------------------------- quote */

const refreshCheckoutQuote = debounce(async () => {
  try {
    const quote = await api.quote(orderPayload());
    state.quote = quote;
    renderBill(quote);
    renderCheckoutSummary(quote);
  } catch (err) {
    if (err.cancelled) return;
    checkoutError.textContent = err.message;
    checkoutError.hidden = false;
  }
}, 200);

function renderCheckoutSummary(quote) {
  const lines = [
    ['Subtotal', quote.subtotal, false],
    ['Combo offer', -quote.comboDiscount, true],
    [`Coupon ${quote.couponCode || ''}`, -quote.couponDiscount, true],
    ['Points', -quote.pointsValue, true],
    ['Packing', quote.packing, false],
    ['Rush hour', quote.rushSurcharge, false],
    ['GST (5%)', quote.gst, false],
    ['Tip', quote.tip, false],
  ].filter(([, value]) => value !== 0);

  render(
    '#checkoutSummary',
    lines
      .map(([label, value]) => html`<div class="row ${value < 0 ? 'discount' : ''}">
          <span>${label}</span><span>${rupees(Math.abs(value))}</span>
        </div>`)
      .join('') +
      html`<div class="row total"><span>Total</span><span>${rupees(quote.total)}</span></div>`
  );

  placeBtn.textContent = `Place Order · ${rupees(quote.total)}`;
}

/* ------------------------------------------------------ placing it */

placeBtn.addEventListener('click', async () => {
  if (placing) return;              // the click guard
  if (cartCount() === 0) return toast('Your cart is empty', 'warn');

  const room = checkField('room', roomInput.value);
  if (!room.ok) {
    roomError.textContent = room.message;
    roomError.hidden = false;
    roomInput.focus();
    return;
  }

  placing = true;
  pendingKey = pendingKey || idempotencyKey();  // one key per attempt
  checkoutError.hidden = true;
  placeBtn.disabled = true;
  placeBtn.textContent = 'Placing...';

  try {
    const order = await api.placeOrder(orderPayload(), pendingKey);

    rememberToken(order.token);
    clearCart();
    api.clearCache();
    api.clearCache('/coupons');

    pendingKey = null;
    couponInput.value = '';

    closeModal('checkoutModal');
    renderCartLines();
    renderBill(null);

    showOrderModal(order);
    toast(`Order ${order.token} placed`, 'ok');

    loadMenu();      // stock moved
    loadWallet();    // points moved
  } catch (err) {
    const extra = (err.details || []).slice(0, 3).join(' • ');
    checkoutError.textContent = extra ? `${err.message}: ${extra}` : err.message;
    checkoutError.hidden = false;

    // a conflict means the world changed under us, so start a fresh attempt
    if (err.status === 409) {
      pendingKey = null;
      loadMenu();
      refreshCheckoutQuote();
    }

    toast(err.message, 'bad');
  } finally {
    placing = false;
    placeBtn.disabled = false;
    placeBtn.textContent = state.quote ? `Place Order · ${rupees(state.quote.total)}` : 'Place Order';
  }
});
