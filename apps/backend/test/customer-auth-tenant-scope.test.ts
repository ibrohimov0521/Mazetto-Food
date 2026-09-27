import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { CustomerAuthService } from "../src/modules/customers/customer-auth.service";

test("customer identity endpoints stop before touching global identity data when tenants are ambiguous", async () => {
  const touched: string[] = [];
  const service = new CustomerAuthService(
    {
      restaurantTenant: {
        findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
      },
      $transaction: async () => { touched.push("transaction"); },
      customer: { findUnique: async () => { touched.push("customer"); } },
      customerVerificationChallenge: {
        findFirst: async () => { touched.push("challenge"); },
        count: async () => { touched.push("rate-limit"); },
      },
      customerSession: { findFirst: async () => { touched.push("session"); } },
    } as never,
    { verifyAsync: async () => { touched.push("jwt"); } } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(service.requestCode({ phone: "+998901234567" } as never), ForbiddenException);
  await assert.rejects(service.verifyCode({ phone: "+998901234567", code: "123456" } as never), ForbiddenException);
  await assert.rejects(service.refresh({ refreshToken: "refresh-token" } as never), ForbiddenException);
  assert.deepEqual(touched, []);
});
