# MAZETTO FOOD Domain Rules

These are permanent architecture rules for MAZETTO FOOD. Future implementation tasks must preserve them unless the product owner explicitly updates this document.

1. One central backend.
2. One central database.
3. Web, Telegram, and POS must not create separate order logic.
4. Financial records must be auditable.
5. Payment and Order are separate domains.
6. Cash Shift and Business Day are separate domains.
7. Product cost and selling price are separate.
8. Every order has a source.
9. Every order belongs to a branch.
10. Orders must have a unique canonical order number.
11. Printer jobs must be reliable and retryable.
12. Frontends must not contain authoritative business logic.
13. Permissions must be enforced on the backend.
14. Multi-branch capability must be preserved throughout the architecture.
15. Mobile responsiveness is mandatory.

## Canonical Sources of Truth

| Domain                  | Canonical source                    | Rule                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operational order       | `Order`                             | All operational status, payment status, totals, kitchen flow, and reporting must read from `Order` and its child records.                                                                                                  |
| Customer order metadata | `CustomerOrder -> Order`            | `CustomerOrder` stores customer-facing metadata only: customer, canonical `orderId`, delivery/pickup type, contact/address snapshot, payment preference, and notes. Customer-facing status is derived from `Order.status`. |
| Payment transaction     | `Payment`                           | Completed tender records live in `Payment`. `Payment.methodCode` is an immutable historical snapshot of the configured method code at payment time.                                                                        |
| Payment configuration   | `PaymentMethod`                     | New payments must resolve an active branch or global `PaymentMethod`. Payment processing must not create payment-method configuration.                                                                                     |
| Cashier shift           | `Shift`                             | `Shift` is the cashier/cash-register shift source of truth. Cash transactions, revenue records, Z reports, dashboard active shifts, and shift close totals must use `Shift`.                                               |
| Inventory quantity      | `Stock.quantity`                    | Warehouse-level `Stock.quantity` is authoritative. `Ingredient.currentStock` is a deprecated compatibility cache and must not drive business logic or reports.                                                             |
| Recipe                  | `Recipe -> ProductVariant`          | A recipe belongs to one `ProductVariant`.                                                                                                                                                                                  |
| Recipe item             | `RecipeItem -> Recipe + Ingredient` | Recipe item variant is derived through `Recipe.variantId`; `RecipeItem` must not store a separate variant reference.                                                                                                       |

## Additional Clarifications

The backend is the system of record for orders, payments, product availability, permissions, shifts, business days, reports, and audit history.

Frontends may cache or display data, but they must not become independent sources of truth.

Historical financial records must remain immutable and auditable. Corrections should be modeled through explicit adjustment, cancellation, refund, or audit events rather than silent deletion.

Order source values must clearly distinguish at least WEB, TELEGRAM, and POS, while remaining extensible for future channels.

Branch ownership must be preserved across orders, employees, devices, reports, settings, and printer routing.
