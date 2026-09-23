import assert from "node:assert/strict";
import test from "node:test";
import { resolveDesktopUpdateFeed } from "../src/update-feed.js";

test("default GitHub release feed keeps electron-updater GitHub provider", () => {
  assert.deepEqual(
    resolveDesktopUpdateFeed(
      "https://github.com/ibrohimov0521/Mazetto-Food/releases/latest/download/",
    ),
    {
      provider: "github",
      owner: "ibrohimov0521",
      repo: "Mazetto-Food",
      releaseType: "release",
    },
  );
});

test("custom admin or Dokploy feed uses the generic provider", () => {
  assert.deepEqual(
    resolveDesktopUpdateFeed("https://updates.mazettofood.uz/desktop"),
    { provider: "generic", url: "https://updates.mazettofood.uz/desktop/" },
  );
});

test("generic feed URLs keep an explicit trailing slash stable", () => {
  assert.deepEqual(
    resolveDesktopUpdateFeed("https://updates.mazettofood.uz/desktop/"),
    { provider: "generic", url: "https://updates.mazettofood.uz/desktop/" },
  );
});
