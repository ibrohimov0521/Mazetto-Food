# Customer Checkout and Delivery Location Handoff

Status: deployed to production and verified on 2026-09-07 (application release f5aa81c).
Repository: /home/javohir/dev/mazetto-food
This change does not implement admin or courier screens.

## Shared Contract

All paths below have the /api/v1 prefix and use the existing success/data envelope.
Customer endpoints require a customer bearer token; ownership comes from the token, never from a submitted customerId.

- GET /customer/me/addresses returns { id, label, location, updatedAt }[].
- PUT /customer/me/addresses/:id creates or updates an address for the current customer. Body: { label, location }. The client generates an id once and reuses it on retry.
- DELETE /customer/me/addresses/:id deletes only the current customer's address. Response: { deleted: true }.
- Maximum 10 saved addresses per customer. Concurrent saves are serialized per customer.
- Labels are at most 40 characters. Address identifiers contain 1-80 letters, digits or hyphens.

Location example (synthetic coordinates, not a customer's address):

~~~json
{
  "latitude": 41.3159,
  "longitude": 69.2812,
  "address": "Amir Temur ko'chasi",
  "house": "12A",
  "apartment": "24",
  "entrance": "2",
  "floor": "3",
  "landmark": "Dorixona yonida",
  "source": "map"
}
~~~

latitude and longitude are finite JSON numbers in [-90, 90] and [-180, 180].
source is gps or map. GPS may include accuracyMeters (0-100000). Accuracy is an estimate, not proof that the person is at the location.
address (3-200 characters) and house (1-40) are required after trimming.
apartment, entrance and floor are optional (20 characters each); landmark is optional (120).

POST /customer/orders accepts deliveryLocation in addition to the existing fields.
For DELIVERY, the new web checkout requires explicit address confirmation. The backend normalizes the structured location and derives the legacy deliveryAddress text from it.
For PICKUP, deliveryLocation and deliveryAddress are not stored.
Existing text-only web/Telegram clients remain supported by the backend, so legacy orders can have a null deliveryLocation.

Order.deliveryLocation and CustomerOrder.deliveryLocation are independent JSON snapshots.
Editing or deleting CustomerAddress does not change previous orders.
The checkout idempotency hash includes the structured location, so changing coordinates cannot silently reuse another checkout request.
The operational customerPhone now uses the validated recipient phone entered during checkout; it falls back to the account phone for legacy callers.

## Admin and Courier Work

GET /online-orders already returns deliveryLocation on each CustomerOrder and its nested order.
The existing operational order detail queries return the scalar Order.deliveryLocation field.
The customer order history exposes CustomerOrder.deliveryLocation at the root.
Preserve existing staff permissions and branch scope. Courier access must additionally follow assignment/role rules in the courier implementation.

Show the delivery address, house, apartment, entrance, floor and landmark.
Use the saved order snapshot, never the customer's current address book.
Show a map pin from latitude/longitude, and a navigation action using those exact coordinates.
Render address strings as text, not HTML.

For Google navigation, build a URL using URL and URLSearchParams:
https://www.google.com/maps/dir/
Parameters: api=1, destination=<latitude>,<longitude>, travelmode=driving, dir_action=navigate.
Do not invent an origin: the map app can use the courier's current position or ask for one.
Navigation vs route preview depends on the device and availability of a current position.
Google documents that Maps URLs do not need an API key:
https://developers.google.com/maps/documentation/urls/get-started

For null or invalid coordinates, show the legacy address and an unavailable-location state. Never link to 0,0 or navigate to a branch instead.
Do not treat a customer-entered coordinate as proof of physical presence.

## Web Behavior

Checkout follows the existing teal, yellow and ivory palette, with Lucide controls.
The map is dynamically loaded only while editing an address.
OpenStreetMap tiles are displayed via Leaflet 1.9.4 with visible attribution. No Google/Yandex API key was configured.
NEXT_PUBLIC_MAP_TILE_URL and NEXT_PUBLIC_MAP_ATTRIBUTION can configure an alternative tile provider at build time.
Respect provider attribution and tile caching requirements:
https://operations.osmfoundation.org/policies/tiles/
https://leafletjs.com/reference.html

GPS is requested only after the customer presses the locate button, with a 10-second timeout.
An independent 12-second deadline releases the UI when a device never answers the permission prompt. Late callbacks are ignored after manual selection, timeout or dialog closure.
Checkout now uses an explicit 46px teal edit button with a Pencil icon. Shared botanical assets decorate the brand header, menu edges and checkout/dialog title bands without intercepting map or button input.
Map dragging/clicking remains an alternative when GPS is denied. Map movement supersedes any pending GPS result.
The initial map center is only a viewing position, not a confirmed delivery location.
Street and building details are entered by the customer; this version does not perform address search/reverse geocoding.
Authenticated address books are stored on the server; guest address books are stored in this browser. The preferred address id and current checkout selection are scoped by account. The preview uses separate storage and never submits a real order.
The first add-to-cart action opens a fulfillment dialog. Returning customers can choose a saved address. The selected fulfillment is kept for the current checkout in session storage, scoped by account. Guest selection transfers once when signing in; it is never replayed over a later account selection.
Checkout displays the chosen address with an edit action opening the same dialog. Cancelling an edit preserves the previous address. A completed order resets the confirmation requirement.
Saving can be turned off; the location is then sent only with that order.
Saving failures keep the draft editable and do not report a false success.
Selecting pickup in the dialog records the branch and removes delivery data from the order.
Browsing, adding to cart and selecting an address work without login. Completing a real order still requires authentication.

Branch availability and price calculations retain the backend's existing behavior.
There are currently no geographic delivery polygons, service radius or distance-based fee rules in the backend. The implementation does not claim a selected coordinate is inside a service area.
The existing backend currently returns a zero delivery fee. Synthetic UI QA uses 12000 to verify nonzero fee display.

## Migration and Release

New additive migration: 20260907130000_customer_delivery_locations.
Adds nullable deliveryLocation JSONB fields to orders/customer_orders and the customer_addresses table.
Applied to mazetto_dev and then production mazetto after a verified, protected database backup.
For production, apply the migration and deploy backend before deploying the new customer web.
No admin or POS files were edited.
Do not deploy only the web against the old backend: address saving needs the new endpoints and schema.

## Verification

- Customer web lint, TypeScript and production build.
- scripts/qa-botanical-location.mjs: native browser geolocation with supplied test coordinates, denied/unavailable/timeout/thrown/missing callbacks, low accuracy, manual fallback, responsive edit button. Physical-device GPS still depends on OS/browser permissions.
- Backend lint, TypeScript and build.
- scripts/qa-fulfillment-flow.mjs: first-add gating, cancellation/focus, guest and account saved addresses, guest-to-account transfer, address changes, reload persistence, order payload/idempotency, pickup omission, responsive dialog/checkout and log-in-free preview. The older checkout QA filenames forward to this unified suite.
- apps/backend/scripts/qa-delivery-locations.mjs: real dev API auth/ownership/validation and persistence; transactionally verifies both order snapshots and admin response, recipient phone, historical immutability, pickup and old-client compatibility.
- QA order transactions are rolled back; test customers/addresses are cleaned up; no Telegram/kitchen notifications are sent.

Run the backend check after building backend. It explicitly refuses any database other than mazetto_dev.
