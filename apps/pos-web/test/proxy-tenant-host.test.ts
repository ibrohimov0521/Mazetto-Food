import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

test("POS API proxy replaces a forged forwarded host with the request host", () => {
  const response = proxy(
    new NextRequest("https://mazettofood.uz/api/v1/auth/login", {
      headers: {
        host: "mazettofood.uz",
        "x-forwarded-host": "other-restaurant.example",
      },
    }),
  );

  assert.equal(
    response.headers.get("x-middleware-request-x-forwarded-host"),
    "mazettofood.uz",
  );
});

test("POS API proxy removes a forged forwarded host when Host is missing", () => {
  const response = proxy(
    new NextRequest("https://mazettofood.uz/api/v1/auth/login", {
      headers: { "x-forwarded-host": "other-restaurant.example" },
    }),
  );

  assert.equal(
    response.headers.get("x-middleware-request-x-forwarded-host"),
    null,
  );
});
