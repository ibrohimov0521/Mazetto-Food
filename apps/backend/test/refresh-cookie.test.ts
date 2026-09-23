import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRefreshCookie,
  CUSTOMER_REFRESH_COOKIE,
  readRefreshToken,
  setRefreshCookie,
  STAFF_REFRESH_COOKIE,
} from "../src/common/auth/refresh-cookie";

test("body refresh token legacy Desktop uchun cookie'dan ustun", () => {
  const request = { headers: { cookie: `${STAFF_REFRESH_COOKIE}=cookie-token` } } as never;
  assert.equal(readRefreshToken(request, "desktop-token", STAFF_REFRESH_COOKIE), "desktop-token");
  assert.equal(readRefreshToken(request, undefined, STAFF_REFRESH_COOKIE), "cookie-token");
});

test("refresh cookie HttpOnly, SameSite va cheklangan path bilan yoziladi", () => {
  const calls: unknown[][] = [];
  const response = {
    cookie: (...args: unknown[]) => calls.push(args),
    clearCookie: (...args: unknown[]) => calls.push(args),
  } as never;
  setRefreshCookie(response, STAFF_REFRESH_COOKIE, "secret", "/api/v1/auth", 60);
  clearRefreshCookie(response, STAFF_REFRESH_COOKIE, "/api/v1/auth");
  assert.deepEqual(calls[0], [STAFF_REFRESH_COOKIE, "secret", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 60_000,
  }]);
  assert.deepEqual(calls[1], [STAFF_REFRESH_COOKIE, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/api/v1/auth",
  }]);
});

test("production customer refresh cookie Secure va customer auth path bilan yoziladi", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const calls: unknown[][] = [];
    const response = {
      cookie: (...args: unknown[]) => calls.push(args),
    } as never;

    setRefreshCookie(
      response,
      CUSTOMER_REFRESH_COOKIE,
      "customer-secret",
      "/api/v1/customer/auth",
      604800,
    );

    assert.deepEqual(calls[0], [CUSTOMER_REFRESH_COOKIE, "customer-secret", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/v1/customer/auth",
      maxAge: 604_800_000,
    }]);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
