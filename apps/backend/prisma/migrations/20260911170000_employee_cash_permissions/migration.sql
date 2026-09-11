-- Existing employees need the same permissions as newly seeded roles.
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('KITCHEN', 'COURIER')
  AND p."code" IN ('SHIFT_VIEW_OWN', 'SHIFT_OPEN', 'SHIFT_CLOSE', 'CASH_TRANSACTION_CREATE')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
