# Staff Workspaces

Updated: 2026-09-09. Scope: `apps/pos-web`.

## Changes

- Shared compact brand header, granted-workspace links, accessible icon controls,
  local logo and static leaf asset; responsive styles scoped to staff workspaces.
- Kitchen: four desktop workflow columns, mobile status filters, order search,
  visible modifiers and kitchen notes, elapsed time, refresh state, confirmation
  before cancellation. Actions match the staff member's backend permissions.
- Courier: separate workspace, status/search filters, readable customer address,
  call and Google/Yandex navigation links, order contents, completion confirmation.
  Completion is enabled only for READY/SERVED orders and staff with update rights.
  Missing, null and out-of-range coordinates do not create invalid map routes.
- POS: responsive catalog and receipt, mobile menu/order views with a fixed total
  and action bar, variant/modifier controls, exact cash and quick cash amounts.
  Default variant pricing matches cart pricing. Submission prevents duplicate
  clicks and cart edits in flight; failed retries retain the idempotency key.
- Shift: consistent opening/closing screen, readable cash movement list, numeric
  validation and closing confirmation. Load failures can be retried.

## Verification

Run the fixture-based browser checks against a running POS frontend:

```sh
node scripts/qa-staff-workspaces.mjs http://127.0.0.1:3103
```

The script intercepts every `/api/v1/` request. It uses synthetic staff/order data
and local product media; it does not create orders, change shifts or send delivery
status updates to the real backend. Unexpected API requests fail the test.

Checked viewports: 320x780, 390x844, 768x900, 1024x680, 1440x900.
All four workspaces are checked for horizontal overflow, visible controls,
loaded brand assets, role navigation and browser runtime errors. Screenshots
and structured results are written to `/tmp/mazetto-staff-qa`.

Behavioral checks cover kitchen acceptance through handoff, cancellation and
recovery after a simulated connection error; courier search, navigation,
completion and permissions; POS variants, required modifiers, totals, cash
validation, submission lock and retry identity; shift opening/closing and
view-only kitchen/courier access.

TypeScript, ESLint and production build are required release checks. This suite
verifies frontend behavior against the current API contracts. It does not replace
testing a real delivery, a cash drawer/printer or Telegram notifications.

## Performance Scope

No embedded map SDK, new font request or animation library was added. The shared
logo and leaf are small local static assets. Kitchen and courier refreshes avoid
overlapping requests and pause in hidden tabs. The customer website and its SEO
metadata are outside this change.
