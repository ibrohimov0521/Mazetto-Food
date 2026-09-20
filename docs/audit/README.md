# MAZETTO FOOD product audit

Audit snapshot: 2026-09-21

This directory is the current source of truth for the product-wide audit. Older
phase notes in `docs/MAZETTO_WORK_STATUS.md` are historical and must not be used
as the current release status.

## Documents

- [Function catalog](./FUNCTION_CATALOG_2026-09-21.md) - every user-facing and
  operational area, its owner, entry point, expected behavior, and current state.
- [Operating guide](./OPERATING_GUIDE_2026-09-21.md) - how customer, staff,
  administrator, Desktop, printer, and Telegram workflows are intended to work.
- [Runtime status](./RUNTIME_STATUS_2026-09-21.md) - where each component runs,
  what was verified live, and what still requires an authenticated or physical
  device smoke test.
- [Remediation plan](./REMEDIATION_PLAN_2026-09-21.md) - confirmed defects and
  missing capabilities, ordered for one-by-one implementation.

## Audit method

The review covered the application routes, backend controllers and services,
Prisma schema, role/permission seeds, Desktop gateway/outbox/updater/printing,
Telegram webhook agent, deployment workflows, and public production health
endpoints. It also compared reachable routes with sidebar navigation and
offline command definitions with the backend controller contract.

`Verified` means confirmed from code and, where possible, a live read-only
health check. `Partial` means the main path exists but one or more required
contracts or user flows are incomplete. `Missing` means the capability is
expected for production operation but has no complete implementation.

No fake production orders, payments, staff changes, or Telegram messages were
created during this audit. Those write-path checks are explicitly listed as
release acceptance tests in the remediation plan.
