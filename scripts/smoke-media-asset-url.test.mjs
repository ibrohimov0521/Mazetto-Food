import assert from "node:assert/strict";
import test from "node:test";
import { resolveMediaAssetUrl } from "./smoke-media-asset-url.mjs";

const mediaOrigin = "https://media.mazettofood.uz";

test("resolves relative catalog images on the configured media origin", () => {
  assert.equal(
    resolveMediaAssetUrl("/products/lavash.webp", mediaOrigin),
    "https://media.mazettofood.uz/products/lavash.webp",
  );
});

test("accepts absolute images only when they use the configured media origin", () => {
  assert.equal(
    resolveMediaAssetUrl(
      "https://media.mazettofood.uz/categories/doner.webp",
      mediaOrigin,
    ),
    "https://media.mazettofood.uz/categories/doner.webp",
  );
  assert.throws(
    () => resolveMediaAssetUrl("https://example.com/image.webp", mediaOrigin),
    /sozlangan media hostidan/,
  );
});

test("rejects network-path, non-web, and credentialed image URLs", () => {
  assert.throws(() =>
    resolveMediaAssetUrl("//127.0.0.1/latest/meta-data", mediaOrigin),
  );
  assert.throws(() =>
    resolveMediaAssetUrl("file:///etc/passwd", mediaOrigin),
  );
  assert.throws(() =>
    resolveMediaAssetUrl(
      "https://user:pass@media.mazettofood.uz/a.webp",
      mediaOrigin,
    ),
  );
});

test("rejects a configured media base with credentials or a non-web scheme", () => {
  assert.throws(() =>
    resolveMediaAssetUrl("/image.webp", "file:///tmp/media"),
  );
  assert.throws(() =>
    resolveMediaAssetUrl(
      "/image.webp",
      "https://user:pass@media.mazettofood.uz",
    ),
  );
});
