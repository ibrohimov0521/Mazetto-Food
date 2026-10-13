import assert from "node:assert/strict";
import test from "node:test";
import {
  createMediaImageConfig,
  createMediaRemotePattern,
} from "../lib/media-remote-pattern.mjs";

test("defaults to the existing production media host", () => {
  assert.deepEqual(createMediaRemotePattern(undefined), {
    protocol: "https",
    hostname: "media.mazettofood.uz",
    port: "",
    pathname: "/**",
  });
});

test("supports configured local and custom media origins", () => {
  assert.deepEqual(createMediaRemotePattern("http://localhost:8080/media/"), {
    protocol: "http",
    hostname: "localhost",
    port: "8080",
    pathname: "/media/**",
  });
});

test("bypasses Next image optimization in development but keeps it in production", () => {
  assert.equal(
    createMediaImageConfig(undefined, "development").unoptimized,
    true,
  );
  assert.equal(
    createMediaImageConfig(undefined, "production").unoptimized,
    false,
  );
});

test("rejects malformed and non-HTTP media URLs", () => {
  for (const value of ["not a URL", "ftp://media.example.com"]) {
    assert.throws(() => createMediaRemotePattern(value), /HTTP\(S\)/);
  }
});

test("rejects credentials, query strings, and fragments in media origins", () => {
  for (const value of [
    "https://user:secret@media.example.com",
    "https://media.example.com?token=secret",
    "https://media.example.com#fragment",
  ]) {
    assert.throws(() => createMediaRemotePattern(value), /credential-free/);
  }
});
