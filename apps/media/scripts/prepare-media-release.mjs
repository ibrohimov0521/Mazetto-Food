import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { releaseAssets } from "./media-assets.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const targetIndex = process.argv.indexOf("--target");
const dryRun = process.argv.includes("--dry-run") || targetIndex === -1;
const targetRoot = targetIndex === -1
  ? "/var/lib/docker/volumes/mazetto-media/_data"
  : process.argv[targetIndex + 1];

if (!targetRoot) {
  throw new Error("Usage: node apps/media/scripts/prepare-media-release.mjs --target <media-volume-path>");
}

let totalBytes = 0;

for (const asset of releaseAssets) {
  const sourcePath = path.join(repoRoot, asset.source);
  const destinationPath = path.join(targetRoot, asset.urlPath.replace(/^\//, ""));

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing approved media source: ${asset.source}`);
  }

  totalBytes += statSync(sourcePath).size;

  console.log(`${dryRun ? "DRY-RUN" : "COPY"} ${sourcePath} -> ${destinationPath}`);

  if (!dryRun) {
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  }
}

console.log(`files=${releaseAssets.length}`);
console.log(`bytes=${totalBytes}`);

if (dryRun) {
  console.log("No files were copied. Pass --target <path> without --dry-run during the controlled release.");
}
