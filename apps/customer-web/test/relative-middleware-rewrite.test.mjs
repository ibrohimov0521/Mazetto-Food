import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveServerProtocol,
  toServerMiddlewareRewrite,
} from "../lib/relative-middleware-rewrite.mjs";

test("forwarded protocol accepts only a normalized HTTP scheme", () => {
  assert.equal(resolveServerProtocol(" HTTPS, http ", "http:"), "https:");
  assert.equal(resolveServerProtocol("http", "https:"), "http:");
  assert.equal(resolveServerProtocol("https-malformed", "http:"), "http:");
  assert.equal(resolveServerProtocol(null, "https:"), "https:");
});

test("production rewrite matches the standalone Docker server origin", () => {
  assert.equal(
    toServerMiddlewareRewrite("https://www.mazettofood.uz/uz/menu?from=home", {
      hostname: "0.0.0.0",
      port: 3000,
      protocol: "https:",
    }),
    "https://0.0.0.0:3000/uz/menu?from=home",
  );
});

test("HTTP and IPv6 server origins preserve locale routes", () => {
  assert.equal(
    toServerMiddlewareRewrite("http://localhost/ru/checkout", {
      hostname: "::1",
      port: "3107",
      protocol: "http:",
    }),
    "http://[::1]:3107/ru/checkout",
  );
});

test("unsafe rewrites and invalid server origins are ignored", () => {
  assert.equal(toServerMiddlewareRewrite("javascript:alert(1)", { hostname: "localhost", port: 3000, protocol: "http:" }), null);
  assert.equal(toServerMiddlewareRewrite("https://example.com//evil", { hostname: "localhost", port: 3000, protocol: "http:" }), null);
  assert.equal(toServerMiddlewareRewrite("https://example.com/uz", { hostname: "invalid host", port: 3000, protocol: "https:" }), null);
});
