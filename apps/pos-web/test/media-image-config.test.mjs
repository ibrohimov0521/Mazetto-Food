import assert from "node:assert/strict";
import test from "node:test";
import {
  canOptimizeProductImage,
  createPosImageConfig,
} from "../lib/media-image-config.mjs";

test("only optimizes the configured media host and base path", () => {
  assert.equal(
    canOptimizeProductImage("https://media.mazettofood.uz/products/a.png"),
    true,
  );
  assert.equal(
    canOptimizeProductImage("https://media.mazettofood.uz.evil.test/a.png"),
    false,
  );
  assert.equal(
    canOptimizeProductImage("https://user:secret@media.mazettofood.uz/a.png"),
    false,
  );
  assert.equal(canOptimizeProductImage("https://other.example/a.png"), false);
  assert.equal(canOptimizeProductImage("data:image/png;base64,abc"), false);
  assert.equal(
    canOptimizeProductImage(
      "https://cdn.example/media/products/a.webp",
      "https://cdn.example/media",
    ),
    true,
  );
  assert.equal(
    canOptimizeProductImage(
      "https://cdn.example/media-other/a.webp",
      "https://cdn.example/media",
    ),
    false,
  );
});

test("web thumbnails stay same-origin and use bounded card sizes", () => {
  const config = createPosImageConfig();
  assert.equal(config.path, undefined);
  assert.deepEqual(config.remotePatterns, [
    {
      protocol: "https",
      hostname: "media.mazettofood.uz",
      port: "",
      pathname: "/**",
    },
  ]);
  assert.ok(config.imageSizes.includes(256));
  assert.ok(config.imageSizes.includes(512));
  assert.deepEqual(config.qualities, [75]);
});

test("Desktop uses the shared optimizer rather than its read-only install directory", () => {
  const config = createPosImageConfig(undefined, "https://pos.mazettofood.uz/");
  assert.equal(config.path, "https://pos.mazettofood.uz/_next/image");
  assert.equal(
    createPosImageConfig("http://127.0.0.1:8080/media", "http://127.0.0.1:3217")
      .path,
    "http://127.0.0.1:3217/_next/image",
  );
});

test("rejects invalid media and public optimizer configuration", () => {
  for (const value of [
    "invalid",
    "ftp://cdn.example",
    "https://user:secret@cdn.example",
    "https://cdn.example?token=secret",
    "https://cdn.example#fragment",
  ]) {
    assert.throws(() => createPosImageConfig(value));
    assert.throws(() => createPosImageConfig(undefined, value));
  }
  assert.throws(() =>
    createPosImageConfig(undefined, "https://pos.example/private"),
  );
});
