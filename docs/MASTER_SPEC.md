# MAZETTO FOOD Master Specification

MAZETTO FOOD is a production restaurant platform built around one central backend and one central database. Every customer-facing, cashier-facing, administrative, Telegram, realtime, and printing workflow must integrate through this shared system of record.

This document is a permanent product specification foundation. It does not define UI screens, database models, or implementation details.

## Ecosystem

The MAZETTO FOOD ecosystem consists of:

1. Customer Web
2. Telegram Bot
3. POS / Cashier System
4. Admin System
5. Backend API
6. PostgreSQL
7. Redis
8. Realtime communication
9. Local Print Agent
10. Thermal receipt and kitchen printers
11. Multi-branch management
12. Reporting and finance

## Central Architecture Rule

All systems must use one central backend and one central database.

The Customer Web, Telegram Bot, POS, Admin System, Print Agent, and future connected devices must not create isolated business logic or independent order storage. They may provide different interfaces and workflows, but authoritative restaurant behavior belongs to the backend.

## Central Order Engine

Orders coming from these sources must ultimately use the same central Order Engine:

- WEB
- TELEGRAM
- POS

The Order Engine must preserve a single canonical order lifecycle across all channels. Channel-specific UI behavior may differ, but order creation, order numbering, order status, payment association, kitchen routing, audit history, and reporting must remain consistent.

## Source And Branch Requirements

Every order must have:

- a unique canonical order number
- a source
- a branch
- auditable creation and state-change metadata

Multi-branch capability must be preserved throughout the architecture, even when an early implementation stage works with only one branch.

## Financial Integrity

Financial and order records must be auditable. The system must not be designed around permanent deletion of financial or order history.

Payment and Order are separate domains. An order may be unpaid, paid, failed, refunded, or partially refunded depending on payment state, while the order itself has its own lifecycle.

Cashier Shift and Business Day are separate domains. A Cashier Shift tracks employee/terminal activity. A Business Day aggregates branch-level financial activity for daily closing.

## Realtime And Printing

Realtime communication must support future order updates, kitchen workflows, POS updates, and admin visibility.

Printing must be handled through a reliable PrintJob architecture. The backend must not directly depend on a USB printer. A local MAZETTO Print Agent will eventually run on the restaurant computer and receive print jobs from the backend.

## Product Scope Boundary

This specification preserves useful restaurant system capabilities discovered from existing workflow analysis. AliPOS is a functional reference only and must not be visually copied.

MAZETTO FOOD will have its own modern interface and product identity.
