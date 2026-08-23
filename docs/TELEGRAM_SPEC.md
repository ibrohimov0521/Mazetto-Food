# MAZETTO FOOD Telegram Specification

This document describes future Telegram responsibilities only. It does not implement Telegram integration, bot commands, authentication, or ordering logic.

Telegram must use the same central backend, central database, canonical order numbers, and central Order Engine as Customer Web and POS.

## Customer Responsibilities

The Telegram Bot will eventually:

- receive `/start`
- request phone contact if required
- associate Telegram user with customer
- issue temporary website login verification codes
- use a verification code lifetime of approximately 10 minutes
- allow users to browse/order through Telegram
- show order history/status

## Admin Notifications

Authorized admins may receive new order notifications including:

- order number
- source
- branch
- customer
- phone
- products
- quantities
- total
- payment method
- delivery/pickup
- address where applicable

Orders must have one canonical order number across all systems.

## Architecture Rules

Telegram must not create a separate order system. Telegram ordering and notifications must communicate through backend APIs and shared domain rules.

Telegram-specific behavior may include chat commands, contact sharing, verification codes, and notification formatting, but order, payment, menu, and audit authority belongs to the backend.
