# Staff Workspaces

Updated: 2026-09-09. Scope: `apps/pos-web`.

## Panel Shell Update (2026-09-13)

Admin and staff workspaces now share `PanelNavbar`: menu and back controls on
the left, workspace-specific actions followed by branch scope and the profile
menu on the right. Logout stays inside the profile menu. Staff sidebars can be
hidden and restored; the preference persists across pages and reloads.

Staff screens match admin density: 80% at viewport widths of 768px and above,
100% on phones. Full-height kitchen/POS layouts compensate for the scale.
Printing remains at 100%. Kitchen retains four desktop status columns and two
independent ticket lanes in each status, including collapsed cards.

Local browser checks covered admin, accounting, POS, kitchen, waiter, courier
and shift at 320, 390, 768, 1024 and 1440px. Checks included header order and
bounds, density, profile menus, logout, history dialogs and the tablet drawer.
Kitchen fixtures additionally covered 1200-1920px, collapse/reflow, sidebar
persistence, TV mode and action failure/retry. These are frontend checks with
local preview data, not live payment or production database tests.

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
