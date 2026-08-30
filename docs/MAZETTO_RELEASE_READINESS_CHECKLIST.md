# MAZETTO FOOD Release Readiness Checklist

Last updated: 2026-08-30

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
   - Confirm production currently healthy.
   - Confirm pending commits are expected.
   - Confirm no uncommitted source changes except approved local artifacts.

2. Production database backup
   - Create a PostgreSQL dump before migration.
   - Verify the backup can be listed with `pg_restore --list`.
   - Record the backup path.

3. Push approved commit chain
   - Push only after local validations pass.
   - Avoid pushing untracked QA screenshots, temporary DB files, `.env`, or secrets.

4. Backend deploy
   - Deploy backend image built from the approved commit.
   - Runtime must provide real `DATABASE_URL`.
   - Run production migrations with `pnpm --dir apps/backend run prisma:migrate:deploy` or equivalent `prisma migrate deploy`.
   - Do not run `prisma:migrate:dev` on production.

5. Customer-web deploy if changed
   - Build with the existing production public build arguments.
   - Required public values include API and media base URLs.

6. Media volume population
   - Use the prepared media copy script only during an approved release.
   - Target production path: `/var/lib/docker/volumes/mazetto-media/_data`.
   - Copy only approved existing files from the manifest.
   - Do not fabricate unresolved assets.

7. Media service validation
   - Confirm media service is running.
   - Confirm `/healthz` returns success.
   - Confirm representative category/product files return HTTP 200 after population.
   - Confirm known unresolved assets remain documented rather than falsely marked complete.

8. Telegram webhook health check
   - Verify webhook info only.
   - Do not reset or change the webhook unless the release prompt explicitly requires it.

9. Public route health
   - Backend health.
   - Customer web home.
   - Customer menu.
   - Media representative URLs.

10. API smoke
    - Customer branches.
    - Customer menu categories.
    - Customer menu products.
    - Customer home data.

11. Telegram UX smoke
    - Verify `/start`.
    - Verify main menu edits in place.
    - Verify Lavash family appears once.
    - Verify Burger family appears once.
    - Verify category pagination if a category has more than one page.
    - Verify branch location button.
    - Avoid creating duplicate production orders unless a controlled order proof is explicitly approved.

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

- Production media direct URLs are not considered complete until the media volume is populated.
- Eight product media assets remain unresolved and should keep using fallback behavior until approved assets exist.
- Click and Payme are not active payment providers.
- Staff Telegram activation remains a separate phase.

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
