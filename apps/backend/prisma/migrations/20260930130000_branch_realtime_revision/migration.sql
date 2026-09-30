ALTER TABLE "branches"
ADD COLUMN "realtime_revision" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "outbox_events"
ADD COLUMN "branch_revision" BIGINT;

WITH ranked_events AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "branchId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS "revision"
  FROM "outbox_events"
  WHERE "branchId" IS NOT NULL
)
UPDATE "outbox_events" AS event
SET "branch_revision" = ranked_events."revision"
FROM ranked_events
WHERE event."id" = ranked_events."id";

UPDATE "branches" AS branch
SET "realtime_revision" = COALESCE(
  (
    SELECT MAX(event."branch_revision")
    FROM "outbox_events" AS event
    WHERE event."branchId" = branch."id"
  ),
  0
);

CREATE UNIQUE INDEX "outbox_events_branchId_branch_revision_key" ON "outbox_events"("branchId", "branch_revision");
CREATE FUNCTION assign_outbox_branch_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."branchId" IS NOT NULL AND NEW."branch_revision" IS NULL THEN
    UPDATE "branches"
    SET "realtime_revision" = "realtime_revision" + 1
    WHERE "id" = NEW."branchId"
    RETURNING "realtime_revision" INTO NEW."branch_revision";

    IF NEW."branch_revision" IS NULL THEN
      RAISE EXCEPTION 'Outbox event branch does not exist';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "outbox_events_assign_branch_revision"
BEFORE INSERT ON "outbox_events"
FOR EACH ROW
EXECUTE FUNCTION assign_outbox_branch_revision();
