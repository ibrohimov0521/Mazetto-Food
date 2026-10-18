import { isDeepStrictEqual } from "node:util";

const ALWAYS_SHARED = new Set([
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "turbo.json",
]);

export function hasSharedBuildChange(
  changedFiles,
  { basePackageJson, targetPackageJson },
) {
  if (
    changedFiles.some(
      (file) => ALWAYS_SHARED.has(file) || file.startsWith("packages/"),
    )
  ) {
    return true;
  }

  if (!changedFiles.includes("package.json")) {
    return false;
  }

  try {
    const baseManifest = JSON.parse(basePackageJson);
    const targetManifest = JSON.parse(targetPackageJson);
    delete baseManifest.scripts?.test;
    delete targetManifest.scripts?.test;
    return !isDeepStrictEqual(baseManifest, targetManifest);
  } catch {
    return true;
  }
}
