import assert from "node:assert/strict";
import { test } from "node:test";
import { customerProfileForStorage } from "../lib/customer-session-storage.mjs";

test("customer profile persistence never includes auth tokens", () => {
  const session = {
    id: "customer-1",
    name: "Javohir",
    phone: "+998901234567",
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
    tokenType: "Bearer",
  };

  assert.deepEqual(customerProfileForStorage(session), {
    id: "customer-1",
    name: "Javohir",
    phone: "+998901234567",
  });
  assert.equal(session.accessToken, "access-secret");
  assert.equal(session.refreshToken, "refresh-secret");
});
