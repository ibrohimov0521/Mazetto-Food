import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRefreshCookie,
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
