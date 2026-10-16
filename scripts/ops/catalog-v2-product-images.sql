BEGIN;

CREATE TEMP TABLE catalog_v2_image_updates (
  code text PRIMARY KEY,
  image_url text NOT NULL
) ON COMMIT DROP;

INSERT INTO catalog_v2_image_updates (code, image_url) VALUES
  ('ALIPOS_20261009_33', '/products/alipos-20261009-33.webp'),
  ('ALIPOS_20261009_35', '/products/alipos-20261009-35.webp'),
  ('ALIPOS_20261009_36', '/products/alipos-20261009-36.webp'),
  ('ALIPOS_20261009_40', '/products/alipos-20261009-40.webp'),
  ('ALIPOS_20261009_41', '/products/alipos-20261009-41.webp'),
  ('ALIPOS_20261009_42', '/products/alipos-20261009-42.webp'),
  ('ALIPOS_20261009_43', '/products/alipos-20261009-43.webp'),
  ('ALIPOS_20261009_44', '/products/alipos-20261009-44.webp'),
  ('ALIPOS_20261009_45', '/products/alipos-20261009-45.webp'),
  ('ALIPOS_20261009_46', '/products/alipos-20261009-46.webp'),
  ('ALIPOS_20261009_47', '/products/alipos-20261009-47.webp'),
  ('ALIPOS_20261009_48', '/products/alipos-20261009-48.webp'),
  ('ALIPOS_20261009_49', '/products/alipos-20261009-49.webp'),
  ('ALIPOS_20261009_50', '/products/alipos-20261009-50.webp'),
  ('ALIPOS_20261009_51', '/products/alipos-20261009-51.webp'),
  ('ALIPOS_20261009_52', '/products/alipos-20261009-52.webp'),
  ('ALIPOS_20261009_53', '/products/alipos-20261009-53.webp'),
  ('ALIPOS_20261009_54', '/products/alipos-20261009-54.webp'),
  ('ALIPOS_20261009_55', '/products/alipos-20261009-55.webp'),
  ('ALIPOS_20261009_56', '/products/alipos-20261009-56.webp'),
  ('ALIPOS_20261009_57', '/products/alipos-20261009-57.webp'),
  ('ALIPOS_20261009_58', '/products/alipos-20261009-58.webp'),
  ('ALIPOS_20261009_59', '/products/alipos-20261009-59.webp'),
  ('ALIPOS_20261009_60', '/products/alipos-20261009-60.webp'),
  ('ALIPOS_20261009_61', '/products/alipos-20261009-61.webp'),
  ('ALIPOS_20261009_62', '/products/alipos-20261009-62.webp'),
  ('ALIPOS_20261009_63', '/products/alipos-20261009-63.webp'),
  ('ALIPOS_20261009_64', '/products/alipos-20261009-64.webp'),
  ('ALIPOS_20261009_65', '/products/alipos-20261009-65.webp'),
  ('ALIPOS_20261009_66', '/products/alipos-20261009-66.webp'),
  ('ALIPOS_20261009_69', '/products/alipos-20261009-69.webp'),
  ('ALIPOS_20261009_76', '/products/alipos-20261009-76.webp'),
  ('ALIPOS_20261009_84', '/products/alipos-20261009-84.webp'),
  ('ALIPOS_20261009_85', '/products/alipos-20261009-85.webp'),
  ('ALIPOS_20261009_87', '/products/alipos-20261009-87.webp'),
  ('ALIPOS_20261009_89', '/products/alipos-20261009-89.webp'),
  ('ALIPOS_20261009_94', '/products/alipos-20261009-94.webp'),
  ('ALIPOS_20261009_95', '/products/alipos-20261009-95.webp'),
  ('ALIPOS_20261009_96', '/products/alipos-20261009-96.webp'),
  ('ALIPOS_20261009_97', '/products/alipos-20261009-97.webp'),
  ('ALIPOS_20261009_98', '/products/alipos-20261009-98.webp'),
  ('ALIPOS_20261009_99', '/products/alipos-20261009-99.webp'),
  ('ALIPOS_20261009_100', '/products/alipos-20261009-100.webp'),
  ('ALIPOS_20261009_101', '/products/alipos-20261009-101.webp'),
  ('ALIPOS_20261009_102', '/products/alipos-20261009-102.webp'),
  ('ALIPOS_20261009_146', '/products/alipos-20261009-146.webp'),
  ('ALIPOS_20261009_147', '/products/alipos-20261009-147.webp'),
  ('ALIPOS_20261009_148', '/products/alipos-20261009-148.webp'),
  ('ALIPOS_20261009_149', '/products/alipos-20261009-149.webp'),
  ('ALIPOS_20261009_150', '/products/alipos-20261009-150.webp'),
  ('ALIPOS_20261009_151', '/products/alipos-20261009-151.webp'),
  ('ALIPOS_20261009_152', '/products/alipos-20261009-152.webp'),
  ('ALIPOS_20261009_153', '/products/alipos-20261009-153.webp'),
  ('ALIPOS_20261009_154', '/products/alipos-20261009-154.webp'),
  ('ALIPOS_20261009_156', '/products/alipos-20261009-156.webp'),
  ('ALIPOS_20261009_158', '/products/alipos-20261009-158.webp'),
  ('ALIPOS_20261009_159', '/products/alipos-20261009-159.webp'),
  ('ALIPOS_20261009_160', '/products/alipos-20261009-160.webp'),
  ('ALIPOS_20261009_161', '/products/alipos-20261009-161.webp'),
  ('ALIPOS_20261009_162', '/products/alipos-20261009-162.webp'),
  ('ALIPOS_20261009_163', '/products/alipos-20261009-163.webp'),
  ('ALIPOS_20261009_165', '/products/alipos-20261009-165.webp'),
  ('ALIPOS_20261009_172', '/products/alipos-20261009-172.webp'),
  ('ALIPOS_20261009_174', '/products/alipos-20261009-174.webp'),
  ('ALIPOS_20261009_175', '/products/alipos-20261009-175.webp'),
  ('ALIPOS_20261009_157', '/products/alipos-20261009-45.webp');

DO $$
DECLARE
  expected_count integer;
  matched_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count FROM catalog_v2_image_updates;
  SELECT COUNT(*) INTO matched_count
  FROM products AS product
  INNER JOIN catalog_v2_image_updates AS image_update
    ON image_update.code = product.code
  WHERE product."branchId" IS NULL;

  IF matched_count <> expected_count THEN
    RAISE EXCEPTION 'Expected % shared catalog products, found %', expected_count, matched_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM products AS product
    INNER JOIN catalog_v2_image_updates AS image_update
      ON image_update.code = product.code
    WHERE product."branchId" IS NULL
      AND product."imageUrl" IS NOT NULL
      AND product."imageUrl" <> image_update.image_url
  ) THEN
    RAISE EXCEPTION 'Refusing to replace an existing, different product image URL';
  END IF;
END $$;

UPDATE products AS product
SET "imageUrl" = image_update.image_url
FROM catalog_v2_image_updates AS image_update
WHERE image_update.code = product.code
  AND product."branchId" IS NULL;

COMMIT;
