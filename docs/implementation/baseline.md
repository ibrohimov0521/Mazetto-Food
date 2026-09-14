# Implementation baseline

Captured: 2026-09-14 (Asia/Tashkent)

Commit: `5d19ff2` (`codex/measoft-research`)

Production base: `d2bba66`, already deployed and smoke-tested before this implementation sequence.

## Repository state

- Worktree was clean after the research checkpoint commit.
- Stack remains Next.js 16.3.2 / React 19, NestJS 11, Prisma 7.2, PostgreSQL, Redis, Socket.IO, Node print agent and Telegram bot.
- Research and current repository do not differ in production code: the only commit after the deployed base contains `docs/measoft-research/`.

## Verification

| Check                  | Result         | Notes                                                                                                                                                                                               |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`       | PASS           | 5/5 workspace packages                                                                                                                                                                              |
| `pnpm lint`            | PASS           | 5/5 workspace packages                                                                                                                                                                              |
| Backend build          | PASS           | `pnpm --filter backend build`                                                                                                                                                                       |
| Customer web build     | PASS           | `pnpm --filter customer-web build`                                                                                                                                                                  |
| POS web build          | PASS           | `pnpm --filter pos-web build`                                                                                                                                                                       |
| Print agent build      | PASS           | `pnpm --filter print-agent build`                                                                                                                                                                   |
| Telegram bot build     | PASS           | `pnpm --filter telegram-bot build`                                                                                                                                                                  |
| Backend tests          | PASS           | 174/174                                                                                                                                                                                             |
| Ops validators         | PASS           | 27/27                                                                                                                                                                                               |
| Parallel `pnpm verify` | TRANSIENT FAIL | 12 tasks passed, then customer Next build worker exited with Windows `3221226505`; the same customer build passed alone. Treat as local parallel worker/resource instability, not a source failure. |

## Database state

- Schema has 27 migrations; latest are `20260913160000_supplemental_table_orders` and `20260914010000_custom_role_scope`.
- Local `DATABASE_URL` is intentionally unavailable, so local `prisma migrate status` could not be completed against a database.
- The production phased deploy immediately before this work reported 27 migrations and schema up to date. This is release evidence, not a substitute for running migration status in each later deploy environment.

## Known technical debt before implementation

- `OrderStatus` mixes order, kitchen and delivery semantics.
- Generic order status mutation remains available alongside action-based kitchen transitions.
- No complete immutable order event/outbox foundation.
- Print polling has no durable lease/attempt model.
- Courier ownership is represented by `servedById`, without assignment/handoff history.
- Courier-reported delivery can collapse into final completion.
- Cash movements exist, but courier expected/submitted/verified settlement is not first-class.
- Notification dead letters are Redis/in-memory bounded records rather than durable jobs.
- Full tenant/restaurant isolation is not yet structural.

## Baseline policy

The parallel build-worker crash is recorded as pre-existing environment behavior. A change is accepted only if sequential builds, tests and validators remain green; before release, the standard clean CI workflow remains the authority.
