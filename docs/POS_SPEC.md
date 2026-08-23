# MAZETTO FOOD POS Specification

This document records known POS requirements and restaurant operational capabilities. It does not design screens and does not define implementation details.

AliPOS concepts are treated as functional references only. MAZETTO FOOD must preserve useful restaurant capabilities without copying legacy UI, colors, layouts, navigation, spacing, tables, or visual hierarchy.

## Order Types

The POS must support:

- DINE_IN_TABLE
- DINE_IN_HALL
- PICKUP
- DELIVERY

The architecture must remain extensible for future order channels.

Functional equivalents observed in older systems include table service, hall service, takeaway, delivery, and TV/display-related orders. These concepts may inform domain behavior, but must not drive the MAZETTO visual design.

## POS Order Creation

The future POS must support:

- create new order
- select category
- search product
- favorite/frequent products
- select product
- add product
- increase quantity
- decrease quantity
- remove item
- clear order
- product modifiers/add-ons
- product notes
- order notes
- add customer/guest
- multiple guests where appropriate
- calculate subtotal
- discount
- service fee
- delivery fee
- total
- send items to kitchen
- kitchen comment
- hold/save open order
- reopen appropriate orders
- finish order
- cancel order
- reprint receipt
- print precheck where applicable

## Product And Menu Management

The system must support:

- categories
- products
- product availability
- selling price
- cost price
- category priority/sorting
- product priority/sorting
- product image
- description
- modifiers/add-ons
- selected/recommended products
- combos
- branch-specific availability
- branch-specific prices if required
- product printer routing

A product may be routed to:

- kitchen printer
- bar printer
- receipt printer
- no printer

## Employees And Roles

Future roles include:

- SUPER_ADMIN
- ADMIN
- MANAGER
- CASHIER
- WAITER
- KITCHEN

Exact permissions will be designed later. Permissions must be enforced by the backend.

The system must track:

- employee
- role
- branch
- login time
- logout time
- terminal/device
- orders created
- orders closed
- orders cancelled
- payments accepted

Important actions must be auditable.

## Payments

The system must support configurable payment methods, including:

- CASH
- TERMINAL
- CLICK
- PAYME
- CARD
- RAHMAT
- CORPORATE_CARD
- OTHER

The architecture must not be hardcoded to only these methods. Payment methods must be configurable.

Order and payment are separate concepts. Split payment must be supported in the future, for example:

- 50,000 CASH
- 30,000 TERMINAL

Payment status must be tracked separately from order status.

Possible payment states:

- PENDING
- PAID
- FAILED
- REFUNDED
- PARTIALLY_REFUNDED

## Halls And Tables

The system must support:

- restaurant halls
- hall active/inactive state
- hall sort order
- optional hall service percentage
- tables
- table code
- table name
- table ordering
- table active/inactive state
- table layout/floor plan in a future stage

## Cashier Shifts

Cashier Shift is separate from Business Day.

A Cashier Shift must eventually track:

- shift number
- employee
- branch
- terminal
- openedAt
- closedAt
- opening balance
- closing balance
- sales
- cash
- card/terminal
- Click
- Payme
- other payments
- refunds
- cancellations
- expenses
- income
- order count

CashShift must not be confused with Daily Closing.

## Business Day And Daily Closing

Business Day is a separate concept from Cashier Shift.

An authorized administrator must eventually be able to perform:

- CLOSE BUSINESS DAY

The Business Day should aggregate the branch's financial activity. After a Business Day is closed, subsequent orders belong to the next Business Day.

Historical records must remain immutable and auditable.

## Order Audit

The system must never be designed around permanently deleting financial or order history.

Order audit must eventually track concepts such as:

- createdBy
- acceptedBy
- closedBy
- cancelledBy
- cancelledAt
- cancellationReason
- createdAt
- updatedAt
- closedAt

Cancelled products should remain visible in audit/history.

## Reporting

Required report categories include:

- final/summary report
- orders report
- payments report
- daily report
- tables report
- products report
- categories report
- employees report
- payment method report
- order type report
- cancellations report
- shifts report
- branch report

Reports should eventually support:

- today
- yesterday
- week
- month
- custom date range

Reports should support comparison against previous periods.

## Financial Reporting

Future financial metrics include:

- revenue
- gross sales
- order count
- average check
- cash total
- terminal total
- Click total
- Payme total
- other payments
- discounts
- refunds
- cancellations
- delivery fees
- service fees
- income
- expenses
- outstanding debt if enabled

## Profit And Cost

Products must eventually support:

- selling price
- cost price

Reports should eventually calculate:

- revenue
- cost of goods sold
- gross profit
- margin percentage

## Cancellations

Cancellation auditing must track:

- order
- order item
- quantity
- amount
- cancellation date/time
- employee who cancelled
- employee who originally created it
- cancellation reason

Cancellation reasons should eventually be configurable by Admin.

## Printer System

The future printer architecture must support:

- cashier receipt printer
- kitchen printer
- bar printer
- other routing types

Orders from WEB, TELEGRAM, and POS must use the same PrintJob architecture.

The server must not directly depend on a USB printer. A future local MAZETTO Print Agent will run on the restaurant computer and receive print jobs from the backend.

Expected PrintJob states:

- PENDING
- PRINTING
- PRINTED
- FAILED

Printer failures must not cause an order to disappear. Reprint must eventually be possible.

## Device And Terminal Management

The system must support registered devices such as:

- POS terminal
- Kitchen Display
- Print Agent
- Admin device where needed

Possible device metadata:

- device name
- device type
- OS
- branch
- last employee
- active state
- last seen
- IP where appropriate
- software version

## System Settings

Future configurable settings include:

- enable/disable dine-in
- enable/disable pickup
- enable/disable delivery
- product search
- confirmation before completing order
- precheck printing
- kitchen notification sound
- order numbering configuration
- default printer
- language
- service percentage
- delivery settings

Settings may eventually be branch-specific.
