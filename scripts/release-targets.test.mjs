import assert from "node:assert/strict";
import test from "node:test";
import { hasSharedBuildChange } from "./release-targets.mjs";

const baseManifest = {
  name: "mazetto-food",
  packageManager: "pnpm@11.19.0",
  scripts: {
    test: "turbo run test",
    build: "turbo run build",
  },
  devDependencies: { turbo: "^2.5.0" },
};

function changedManifest(mutator) {
  const manifest = structuredClone(baseManifest);
  mutator(manifest);
  return JSON.stringify(manifest);
}

const basePackageJson = JSON.stringify(baseManifest);

test("root test-script-only changes do not trigger app rebuilds", () => {
  const targetPackageJson = changedManifest((manifest) => {
    manifest.scripts.test += " && node --test scripts/extra.test.mjs";
  });

  assert.equal(
    hasSharedBuildChange(
      ["package.json", ".github/workflows/ci.yml", "scripts/extra.test.mjs"],
      { basePackageJson, targetPackageJson },
    ),
    false,
  );
});

test("dependency and package-manager changes still trigger app rebuilds", () => {
  const targetPackageJson = changedManifest((manifest) => {
    manifest.devDependencies.turbo = "^2.6.0";
  });

  assert.equal(
    hasSharedBuildChange(["package.json"], {
      basePackageJson,
      targetPackageJson,
    }),
    true,
  );
});

test("lifecycle script changes still trigger app rebuilds", () => {
  const targetPackageJson = changedManifest((manifest) => {
    manifest.scripts.postinstall = "node scripts/setup.mjs";
  });

  assert.equal(
    hasSharedBuildChange(["package.json"], {
      basePackageJson,
      targetPackageJson,
    }),
    true,
  );
});

test("unparseable manifests fail closed", () => {
  assert.equal(
    hasSharedBuildChange(["package.json"], {
      basePackageJson,
      targetPackageJson: "{",
    }),
    true,
  );
});
