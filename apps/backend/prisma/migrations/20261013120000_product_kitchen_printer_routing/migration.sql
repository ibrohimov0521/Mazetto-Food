ALTER TABLE "products"
ALTER COLUMN "printerRouting" SET DEFAULT 'KITCHEN';

UPDATE "products"
SET "printerRouting" = 'KITCHEN'
WHERE "printerRouting" = 'NONE';
