# MAZETTO FOOD Release Readiness Checklist

Last updated: 2026-10-12

This checklist is for the next controlled production release. It is documentation only; it does not authorize deployment by itself.

## Safety Rules

- Do not release without an explicit approval prompt.
- Do not skip the production database backup.
- Do not run `prisma migrate dev`, `prisma db push`, `migrate reset`, drop, truncate, or volume delete commands against production.
- Do not expose Telegram tokens, webhook secrets, JWT secrets, database URLs, or Cloudflare credentials in logs or reports.
- Do not create extra production test orders unless the release prompt explicitly asks for one controlled order.

## Controlled Release Order

1. Preflight
   - Confirm local HEAD and `origin/main`.
   - Confirm production currently healthy (`pnpm release:smoke`).
   - Confirm pending commits are expected.
   - Confirm no uncommitted source changes except approved local artifacts.
   - Run `pnpm release:gate <sha> --since <prod-sha>` and stop if it refuses. The commit must be on `origin/main` and its CI `verify` check must be green. The output lists which apps to redeploy and any new migrations. See `docs/CI_CD.md`.

2. Production database backup
   - Create a PostgreSQL dump before migration.
   - Verify the backup can be listed with `pg_restore --list`.
   - Record the backup path.
   - `scripts/ops-backup-production.sh` writes a verified dump and
     `latest-verified.json` into `MAZETTO_BACKUP_DIR`. A failed or empty dump
     never updates that evidence file.
   - For the Super Admin `Tizim holati` page, mount this backup directory
     **read-only** in the backend container and set
     `MAZETTO_BACKUP_STATUS_FILE` to its `latest-verified.json` path inside
     the container. The backend also checks that the referenced dump exists
     beside the evidence file and has the recorded byte size. Without the
     mount, the page reports `Ulanmagan`; do not treat that as backup success.
   - `pg_restore --list` proves that the archive is readable, not that a
     database has been restored successfully. Schedule a restore drill into
     an isolated database before calling disaster recovery verified.
   - Dokploy/R2 application backups are separate from this PostgreSQL dump
     evidence. Their status is not inferred by the admin page.

3. Approved commit is on `main`
   - Changes reach `main` only through a PR whose `verify` check is green; direct pushes are blocked by branch protection.
   - Avoid committing untracked QA screenshots, temporary DB files, `.env`, or secrets.

4. Apply production migrations before deploying any application
   - Keep the currently deployed backend running while applying additive migrations.
   - Copy only the pending migration directories from the approved commit into the running backend container, then run `prisma migrate status`, `prisma migrate deploy`, and `prisma migrate status` again. See the exact commands in `docs/CI_CD.md`.
   - Do not run `prisma:migrate:dev` on production.
   - Deploy the backend image only after the new migrations are confirmed applied. The credential-version migration is read by the new authentication code.

5. Customer-web deploy if changed
   - Build with the existing production public build arguments.
   - Required public values include API and media base URLs.

6. BestTeam owner panel deploy if changed
   - After migrations and backend deploy, dispatch the `platform-web` phase with `migrations_applied=true`.
   - Verify `https://admin.mazetto.uz/login` returns HTTP 200 in the read-only smoke.

7. Media volume population
   - Use the prepared media copy script only during an approved release.
   - Target production path: `/var/lib/docker/volumes/mazetto-media/_data`.
   - Copy only approved existing files from the manifest.
   - Do not fabricate unresolved assets.

8. Media service validation
   - Confirm media service is running.
   - Confirm `/healthz` returns success.
   - Confirm representative category/product files return HTTP 200 after population.
   - Confirm known unresolved assets remain documented rather than falsely marked complete.

9. Telegram webhook health check
   - Verify webhook info only.
   - Do not reset or change the webhook unless the release prompt explicitly requires it.

10. Public route health

- Run `pnpm release:smoke` (or GitHub Actions → Production smoke). It is read-only and covers backend health with database, customer-web pages, the customer menu/home APIs from step 11, pos-web, owner login, and media health, and protected endpoints that must return 401 without a token. Representative media file URLs still need the manual check below.
- Backend health.
- Customer web home.
- Customer menu.
- Media representative URLs.

11. API smoke
    - Customer branches.
    - Customer menu categories.
    - Customer menu products.
    - Customer home data.

12. Telegram UX smoke
    - Verify `/start`.
    - Verify main menu edits in place.
    - Verify Lavash family appears once.
    - Verify Burger family appears once.
    - Verify category pagination if a category has more than one page.
    - Verify branch location button.
    - Avoid creating duplicate production orders unless a controlled order proof is explicitly approved.

13. Mark the release
    - Move the `production` tag to the released commit: `git tag -f production <sha> && git push -f origin production`.
    - Automatic deploys and `pnpm release:gate` (without `--since`) compare against this tag. If it is left behind, the next automatic deploy sees already-applied migrations as new and stops.

## Media Release Command Shape

Dry run:

```bash
pnpm media:prepare
```

Approved release copy target:

```bash
node apps/media/scripts/prepare-media-release.mjs --target /var/lib/docker/volumes/mazetto-media/_data
```

Then verify:

```bash
pnpm media:validate
curl -I https://media.mazettofood.uz/categories/lavash.webp
curl -I https://media.mazettofood.uz/products/lavash-big.webp
```

## Current Known Gaps

- Production read-only smoke passed 27/27 on 2026-10-12 against the deployed baseline. Its media check verifies image URLs returned by the public category and product APIs; all API-referenced images returned HTTP 200. Local and PR-only source changes are not included in this production check.
- The local media manifest validates 11 category assets, 74 product assets, and 0 unresolved product assets. A direct production check of all 85 manifest URLs found one 404: `/categories/blyudalar.webp`. The current public category API points `Blyudalar` to `/categories/doner.webp`, so the missing manifest file is not currently referenced. Keep it documented until confirmed removable or deliberately copied.
- Click and Payme are available only as cashier-selected manual settlement methods when enabled; they are not automated providers. Customer checkout currently supports cash only. The NBU QR SMS has no reliable order identifier, so automatic order matching requires a bank API/export or trusted reconciliation feed.
- Production Telegram `getWebhookInfo` could not be checked from the current noninteractive server shell because bot credentials were not present. No webhook was changed. Customer/staff bot health and real-user Telegram UX still need a secret-authorized check.
- Fresh production backup `/mnt/storage/backups/mazetto/postgres/mazetto-20261011-090128252.dump` (539,693 bytes; 703 archive entries) has a `latest-verified.json` record and SHA-256 `782b03a035259bbf45194c783582f6001bd5a80299ac99be360bfc33fb18dbc9`. A full `--exit-on-error` restore passed in a disposable network-disabled PostgreSQL 18 container with no volume (76 public tables); this verifies the backup, not application rollback or a live recovery procedure.
- Desktop 0.1.116 is not published. Windows workstation installation/update, the new credential save prompt, offline recovery, and physical receipt plus shift-close printer output remain acceptance tests.
- Current grouped audit changes are not included in the deployed baseline; local gates passed but do not replace physical printer, payment-provider, Telegram, and Windows Desktop acceptance.
- Customer standalone browser QA had no local API attached; no offline-readiness conclusion should be drawn from that browser session.
- Full release acceptance passed through migrations, seed, and database-backed order-to-cash-to-stock-to-print E2E using a disposable volume-free PostgreSQL container.
- A non-blocking PostgreSQL client query-queue deprecation warning came from Prisma's adapter during that isolated E2E; it does not fail the test but should be tracked before a pg@9 upgrade.
- Mocked staff workflows also passed across five viewport sizes; this does not replace tests using the live restaurant account, real staff device, or physical printer.

## Step 14 Release Record

Date: 2026-08-30

Completed:

- Approved chain through `568b6ac121e953cea6a06c108e9b3f43949849d8` was pushed and deployed.
- PostgreSQL backup was created before release:
  `/home/javohir/backups/mazetto/postgres/mazetto-step14-pre-release-20260830-040100.dump`
- Backend image deployed:
  `mazetto-food-backend-pdslpm:568b6ac`
- Customer-web image deployed:
  `mazetto-food-customerweb-yvb3d0:568b6ac`
- No production migration was executed because production already had all 16 migrations applied with 0 failed migrations.
- Media volume was backed up before population:
  `/home/javohir/backups/mazetto/media/mazetto-media-step14-pre-populate-20260830-040606.tar.gz`
- Media volume was populated with 37 approved assets:
  10 category files and 27 product files.

Verified:

- Backend health returned 200.
- Customer-web `/`, `/menu`, `/cart`, `/checkout`, `/orders`, and `/profile` returned 200.
- Customer API returned 1 branch, 10 categories, and 35 products.
- Media representative URLs returned 200 for `lavash.webp`, `lavash-big.webp`, and `cheese-fries.webp`.
- Known unresolved `chicken-strips.webp` remained 404 as expected.
- Telegram webhook host remained `api.mazettofood.uz`, pending updates were 0, and last error was absent.

Not performed:

- No new real production order was created.
- No Click/Payme activation.
- No staff Telegram activation.
- No Cloudflare change.

Remaining after Step 14:

- Human Telegram UX smoke for the newly deployed single-message navigation and quick-add merge should be done manually from a real Telegram account without creating an unnecessary extra production order.
- Eight authentic media assets remain unresolved.

## Read-only Telegram webhook verification (2026-10-12)

- Both production customer and staff bot `getWebhookInfo` calls succeeded: `api.mazettofood.uz`, 0 pending updates, and no last error. Tokens were not printed; no webhook or message was changed.
- This supersedes the earlier current-gap note that credentials were unavailable. Real-account Telegram UX and order-notification smoke remain pending.
