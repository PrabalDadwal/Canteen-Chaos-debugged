# Debug log

## CC-01 — "The search suggestions are behind everything"

**Reproduced:** Typed "ch" or "paneer" in the search input on the menu page. The suggestion dropdown popped up below the input, but visually sat underneath the category tabs (`.cat-tabs`) and dish cards. Clicking on any suggestion except the very top edge clicked the category tab or background behind it instead of selecting the suggested dish.

**Cause:** In `frontend/style.css`, `.search-wrap` had `position: relative; z-index: 1;`. Meanwhile, `.cat-tabs` directly below it in `.filters` was styled with `position: relative; z-index: 40;`. Because both elements exist in the same stacking context inside `.filters`, the higher `z-index: 40` on `.cat-tabs` forced `.suggest-box` (even though it had `z-index: 100` within its own wrapper) to render behind the category bar.

**Fix:** Changed `.search-wrap` in `frontend/style.css` to have `z-index: 50;`. This elevates the search container and its child dropdown above `.cat-tabs` (`z-index: 40`), allowing suggestions to float over all tabs and cards without visual clipping.

**Checked:** Typed various dish names ("dosa", "momos", "paneer"). Suggestions render on top of `.cat-tabs`. Every suggestion item is fully visible and clickable, navigating smoothly to the dish detail modal.

**Time:** 15 minutes.

---

## CC-02 — "Can't read anything in dark mode"

**Reproduced:** Toggled the theme switch in the navbar to "Dark". While background colors correctly shifted to dark tones, dish titles and prices inside the menu grid cards became dark brown text on a dark `#201913` card background, making them nearly illegible.

**Cause:** In `frontend/style.css`, line 294, `.dish-body` had a hardcoded text color rule: `color: #2b2118;`. Because `.name-btn` (dish title) and `.dish-price` inherited their text color from `.dish-body`, they did not adopt the theme variable `--ink` (`#f2e8df` in dark mode).

**Fix:** Updated `.dish-body` in `frontend/style.css` to use `color: var(--ink);` instead of `#2b2118`. In light mode, `--ink` resolves to `#2b2118`; in dark mode, it automatically resolves to `#f2e8df`.

**Checked:** Switched back and forth between light and dark modes. Dish titles, prices, and descriptions are crisp and readable in both modes with strong contrast against the card background.

**Time:** 10 minutes.

---

## CC-03 — "The menu is wider than my phone"

**Reproduced:** Opened the site in mobile viewport (< 760px). The menu grid forced horizontal scrolling, and dish cards on the right were clipped off the screen, with the "Add to Cart" button partially inaccessible.

**Cause:** In `frontend/style.css`, under the `@media (max-width: 760px)` breakpoint, `.name-btn` was set to `width: max-content;`. In CSS Grid, grid column tracks default to `minmax(auto, 1fr)`. When dish names (e.g. "Chole Bhature with Pickled Onions") have `width: max-content`, the column track is forced wider than the 50% grid column width, overflowing the mobile viewport.

**Fix:** In `frontend/style.css` under `@media (max-width: 760px)`, set `.name-btn { width: 100%; max-width: 100%; }` and added `min-width: 0;` to `.menu-grid` and `.dish-card` to ensure grid items can shrink properly within their allocated columns.

**Checked:** Tested mobile viewports from 320px to 760px. Dish cards wrap text properly, cards fit evenly across the screen with no horizontal scrolling or cutoff buttons.

**Time:** 20 minutes.

---

## CC-04 — "The buttons don't work on my tablet"

**Reproduced:** Emulated a tablet screen width between 761px and 900px. Clicking the "Add to Cart" button or the star icon to favourite a dish did nothing, despite cursor and hover states appearing normal. Tested fine on desktop (>900px) and phones (<760px).

**Cause:** In `frontend/style.css`, the media query `@media (min-width: 761px) and (max-width: 900px)` introduced pseudo-elements `.dish-card::after` (with `bottom: 0; height: 58px; z-index: 3;`) and `.img-wrap::after` (with `top: 0; right: 0; width: 52px; height: 52px; z-index: 1;`). Because these transparent pseudo-elements sat with high z-index directly over the Add to Cart and Favorite buttons without `pointer-events: none;`, they intercepted all mouse and touch events before they could reach the underlying button elements.

**Fix:** Added `pointer-events: none;` to `.dish-card::after, .img-wrap::after` in `frontend/style.css` so clicks pass straight through to the underlying action buttons.

**Checked:** Tested at widths between 761px and 900px (e.g., 768px iPad mini and 820px iPad Air). Clicking "Add to Cart" immediately increments the cart count and updates the card quantity stepper; clicking the star toggles saved dish state as expected.

**Time:** 25 minutes.

---

## CC-05 — "The category bar scrolls away on my phone"

**Reproduced:** Scrolled down the dishes list on a mobile screen (< 480px). The top category bar (`.filters`) scrolled off the screen instead of remaining pinned to the top of the viewport.

**Cause:** In `frontend/style.css`, under `@media (max-width: 480px)`, the `.view` element had `overflow-x: hidden;`. According to the CSS positioning specification, setting `overflow-x: hidden` on a parent element creates a new scroll/clipping context, which invalidates and breaks `position: sticky; top: 0;` on any descendant element like `.filters`.

**Fix:** Changed `.view { overflow-x: hidden; }` to `.view { overflow-x: clip; }` in `frontend/style.css`. `overflow-x: clip` suppresses horizontal page overflow without establishing a scroll container, allowing `position: sticky; top: 0;` to continue functioning properly.

**Checked:** Tested scrolling on mobile viewport (375px, 412px, 480px). The category and filter bar remains firmly sticky at the top while dishes scroll smoothly underneath.

**Time:** 15 minutes.

---

## CC-06 — "I ordered more than they had"

**Reproduced:** Found a dish with stock of 2 (or set stock to 2 in `backend/data/menu.json`). Added 5 units of that dish to cart and submitted an order. The server accepted the order (HTTP 201 Created), reducing the menu stock to -3.

**Cause:** Two locations in `backend/logic/validation.js` failed to enforce remaining stock:
1. In `validateLine()`, the check only tested `if (Number(dish.stock) <= 0)`, which only catches already sold-out dishes, but never verified `qty > Number(dish.stock)`.
2. In `reserveStock()`, `dish.stock -= item.qty` was executed unconditionally without checking whether `dish.stock < item.qty`.

**Fix:**
1. In `backend/logic/validation.js` inside `validateLine()`, added:
   `else if (qty > Number(dish.stock)) errors.push('Only ' + dish.stock + ' left for ' + dish.name);`
2. In `reserveStock()`, added:
   `if (dish.stock < item.qty) return errors.push('Only ' + dish.stock + ' left for ' + dish.name);`

**Checked:** Attempting to place an order for quantity greater than available stock now returns HTTP 400 Bad Request with a clear validation error. Order placement is blocked, and menu stock never drops below 0.

**Time:** 20 minutes.

---

## CC-07 — "Cancelling makes it worse"

**Reproduced:** Placed an order with 2 plates of a dish (e.g. stock goes from 10 to 8). From the order modal or Counter Dashboard, cancelled the order. The stock dropped again to 6 instead of restoring back to 10.

**Cause:** In `backend/logic/validation.js`, inside `releaseStock(items, menu)`, line 123 had:
`return { ...dish, stock: dish.stock - line.qty };`
It subtracted `line.qty` instead of adding it back.

**Fix:** In `backend/logic/validation.js` inside `releaseStock()`, changed subtraction to addition:
`return { ...dish, stock: dish.stock + line.qty };`

**Checked:** Tested placing an order for 2 items (stock 10 -> 8), then cancelling the order. The stock immediately and accurately restored from 8 back to 10. Repeated cancellations correctly replenish stock.

**Time:** 10 minutes.

---

## CC-08 — "An old coupon still works"

**Reproduced:** Added items to cart totaling > Rs. 100 and entered the promo code `FRESHERS24` (which had expired on 2024-09-30 according to `backend/data/coupons.json`). The discount was accepted and deducted Rs. 30 from the total.

**Cause:** In `backend/logic/pricing.js`, `applyCoupon()` checked `usesLeft <= 0`, `minOrder`, `vegOnly`, and meal slots, but never checked `coupon.expiresAt` against the current timestamp `now`. (Note: while `backend/routes/coupons.routes.js` filtered out expired coupons from public listing, direct submission bypassed expiration check).

**Fix:** In `backend/logic/pricing.js` inside `applyCoupon()`, added an expiration check:
```javascript
if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
  return { valid: false, discount: 0, reason: 'This coupon has expired' };
}
```

**Checked:** Entering `FRESHERS24` in cart quote or order placement now returns an error: "This coupon has expired" with 0 discount. Valid coupons (e.g., `BYTE10`, `FLAT50`) continue to apply correctly.

**Time:** 15 minutes.

---

## CC-09 — "The menu shows more dishes than it should"

**Reproduced:** Loaded the menu page with initial page request of limit 5. Instead of rendering the first 5 dishes, the server returned all dishes at once (all 35+ items rendered immediately on first load).

**Cause:** In `backend/logic/search.js`, inside `paginate(list, page, limit)`, line 98 computed `items = list.slice(start, start + perPage)`, but line 101 returned `items: list` (the entire un-sliced list) instead of `items: items`.

**Fix:** In `backend/logic/search.js`, changed line 101 from `items: list` to `items`.

**Checked:** Initial menu load now returns exactly 5 dishes. Clicking "Load more" or triggering the scroll sentinel retrieves the next 5 items sequentially.

**Time:** 15 minutes.

---

## CC-10 — "Sorting by price is backwards"

**Reproduced:** Selected "Price: low to high" from the sort dropdown. The most expensive items (Rs. 150) appeared at the top. Selecting "Price: high to low" put the cheapest items first.

**Cause:** In `backend/logic/search.js`, lines 79-80, the sort comparison functions in `SORTERS` were inverted:
```javascript
'price-asc': (a, b) => b.price - a.price,  // descending comparator
'price-desc': (a, b) => a.price - b.price, // ascending comparator
```

**Fix:** Corrected the comparators in `backend/logic/search.js`:
```javascript
'price-asc': (a, b) => a.price - b.price,
'price-desc': (a, b) => b.price - a.price,
```

**Checked:** Selecting "Price: low to high" displays dishes starting from Rs. 20 up to Rs. 150. Selecting "Price: high to low" displays dishes starting from Rs. 150 down to Rs. 20.

**Time:** 5 minutes.

---

## Extra credit

1. **End-to-End Automated Verification (`backend/smoke.js`):**
   - Verified that the full smoke test suite covers every backend bug (price sort order, pagination page difference, coupon expiration, stock overdraft rejection, order cancellation stock replenishment).
   - All tests pass cleanly without errors.

2. **Canteen Time Simulation & 24/7 Testing:**
   - Because the canteen operates between 7:00 AM and 10:00 PM, developers working late at night would find all dishes marked as "not served now".
   - Added support for `X-Simulate-Hour` header or `?simSlot=lunch|breakfast|evening|allday` override, along with an interactive time-of-day switcher in the Challenge companion toolbar.

3. **In-Browser Challenge Workbench & Ticket Viewer:**
   - Integrated an accessible developer toolbar on the top of the interface allowing testers to inspect all 10 problem statements, view the bug log, trigger data resets, and switch between Student Menu, Orders, and Counter Dashboard with one click.

4. **My Orders Not Displaying Placed Orders (`backend/routes/orders.routes.js`):**
   - **Reproduced:** Placed an order from the menu. Navigated to "My Orders" (`#/orders`). Even though the order was successfully created and active in the database, the screen showed "No orders found" for the member ID.
   - **Cause:** In `backend/routes/orders.routes.js` line 188, the filter checked:
     `if (req.query.memberId) orders = orders.filter((o) => o.memberId === req.query.userId);`
     The client sends `?memberId=<id>`, leaving `req.query.userId` as `undefined`. Comparing `o.memberId === undefined` discarded all orders.
   - **Fix:** Changed the filter to use `const memberId = req.query.memberId || req.query.userId; if (memberId) orders = orders.filter((o) => o.memberId === memberId);`.
   - **Checked:** Orders placed by the current browser device now immediately and reliably appear in the "My Orders" section under "Happening now" with full tracking, cancellation, and rating actions.
