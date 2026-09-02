import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  categoryAssets,
  mediaRoot,
  productAssets,
  releaseAssets,
  unresolvedProductAssets,
} from "./media-assets.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const nginxConfigPath = path.join(repoRoot, "apps/media/nginx.conf");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const nginxConfig = readFileSync(nginxConfigPath, "utf8");
  assert(
    nginxConfig.includes(`root ${mediaRoot};`),
    `nginx root must stay ${mediaRoot}`,
  );

  assert(categoryAssets.length === 10, "Expected 10 category media assets");
  assert(productAssets.length === 74, "Expected 74 available product media assets");
  assert(unresolvedProductAssets.length === 0, "Expected 0 unresolved product assets");

  const seenPaths = new Set();
  let totalBytes = 0;

  for (const asset of releaseAssets) {
    assert(asset.urlPath.startsWith(`/${asset.kind === "category" ? "categories" : "products"}/`), `Invalid URL path: ${asset.urlPath}`);
    assert(!/\s/.test(asset.urlPath), `URL path contains whitespace: ${asset.urlPath}`);
    assert(asset.urlPath === asset.urlPath.toLowerCase(), `URL path must be lowercase: ${asset.urlPath}`);
    assert(!seenPaths.has(asset.urlPath), `Duplicate media URL path: ${asset.urlPath}`);
    seenPaths.add(asset.urlPath);

    const sourcePath = path.join(repoRoot, asset.source);
    assert(existsSync(sourcePath), `Missing local media source: ${asset.source}`);
    const size = statSync(sourcePath).size;
    assert(size > 0, `Empty local media source: ${asset.source}`);
    totalBytes += size;
  }

  for (const urlPath of unresolvedProductAssets) {
    assert(urlPath.startsWith("/products/"), `Unresolved path must be a product: ${urlPath}`);
    assert(!seenPaths.has(urlPath), `Unresolved asset is also marked available: ${urlPath}`);
  }

  console.log("Mazetto media asset validation passed");
  console.log(`nginx_root=${mediaRoot}`);
  console.log(`category_assets=${categoryAssets.length}`);
  console.log(`available_product_assets=${productAssets.length}`);
  console.log(`unresolved_product_assets=${unresolvedProductAssets.length}`);
  console.log(`release_files=${releaseAssets.length}`);
  console.log(`release_size_bytes=${totalBytes}`);
}

main();
