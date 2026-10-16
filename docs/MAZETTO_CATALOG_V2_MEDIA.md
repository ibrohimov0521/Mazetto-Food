# Supplemental Catalog Product Images

This release adds 65 optimized WebP visuals for the 65 imported catalog items that had image files. The matching product codes are registered in `apps/media/scripts/media-assets.mjs`.

The owner identified `Tepitok` (code `ALIPOS_20261009_157`) as plain boiled water. It uses the same generic, unbranded water visual as `suv 1.5l`; no unsupported Tepitok package or logo is invented.

These are consistent catalog visuals, not guaranteed photographs of the exact retail packaging. Generated package lettering can differ from the real brands. Replace a visual with an owner-confirmed package photo when one is available.

The SQL file updates only the 66 shared catalog rows with the listed ALIPOS codes, refuses unexpected/missing rows and refuses to overwrite a different existing image URL. Apply it to staging first, verify image requests, and only then apply it to production after a database backup and media-volume backup.
