CREATE FUNCTION "set_order_tenant_from_branch"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  branch_tenant_id TEXT;
  new_row JSONB;
  current_tenant_id TEXT;
BEGIN
  SELECT "tenantId"
  INTO branch_tenant_id
  FROM "branches"
  WHERE "id" = NEW."branchId";

  IF branch_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order branch must have a tenant';
  END IF;

  new_row := to_jsonb(NEW);
  current_tenant_id := NULLIF(new_row ->> 'tenantId', '');

  IF current_tenant_id IS NOT NULL AND current_tenant_id <> branch_tenant_id THEN
    RAISE EXCEPTION 'Order tenant must match its branch';
  END IF;

  new_row := new_row || jsonb_build_object('tenantId', branch_tenant_id);
  RETURN jsonb_populate_record(NEW, new_row);
END;
$$;

CREATE TRIGGER "orders_tenant_from_branch"
BEFORE INSERT OR UPDATE ON "orders"
FOR EACH ROW
EXECUTE FUNCTION "set_order_tenant_from_branch"();
