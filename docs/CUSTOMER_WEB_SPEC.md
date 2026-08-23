# MAZETTO FOOD Customer Web Specification

This document describes future customer web capabilities at a high level. It does not define screens, UI implementation, database models, or checkout logic.

## Purpose

The Customer Web application will provide a responsive menu browsing and ordering experience for customers. It must work well on mobile, tablet, and desktop.

Customer Web orders must use the same central backend, central database, canonical order numbers, and central Order Engine as POS and Telegram orders.

## Future Capabilities

The future customer web experience should support:

- browse menu without login
- categories
- product detail
- cart
- quantity controls
- modifiers/add-ons
- recommendations before checkout
- registration/login
- Telegram-assisted verification code
- saved addresses
- delivery
- pickup
- nearest branch suggestion
- payment selection
- order history
- order status
- profile
- responsive mobile UI

## Order Integration

Customer Web must not contain authoritative business logic for orders, payments, menu availability, discounts, or branch routing.

The frontend may guide the user experience, but final validation and business decisions must happen on the backend.

Every Customer Web order must have:

- source WEB
- branch
- canonical order number
- order status
- payment status
- auditable timestamps

## Responsiveness

The customer web interface must support desktop, tablet, and mobile.

Critical customer actions must not be desktop-only. No customer web page should cause horizontal overflow on mobile.
