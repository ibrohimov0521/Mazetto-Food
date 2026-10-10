import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const patchFiles = readdirSync("patches").filter((file) =>
  file.endsWith(".patch"),
);

if (patchFiles.length === 0) {
  console.log("No pnpm patched dependencies; Docker context check skipped.");
  process.exit(0);
}

const appEntries = readdirSync("apps", { withFileTypes: true }).filter(
  (entry) => entry.isDirectory(),
);
const patchedPackageNames = new Set(
  patchFiles.map((file) =>
    file.replace(/@[^@]+\.patch$/, "").replace(/\+/g, "/"),
  ),
);
const manifestPaths = [
  "package.json",
  ...appEntries.map((entry) => "apps/" + entry.name + "/package.json"),
].filter((manifest) => existsSync(join(".", manifest)));
const patchedDependencyManifests = manifestPaths.filter((path) => {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  };

  return Object.keys(dependencies).some((name) => patchedPackageNames.has(name));
});
const dockerfiles = appEntries
  .map((entry) => join("apps", entry.name, "Dockerfile"))
  .filter(existsSync);
let checked = 0;

for (const dockerfile of dockerfiles) {
  const source = readFileSync(dockerfile, "utf8");
  const stages = source.split(/^(?=FROM\b)/m);

  for (const stage of stages) {
    const commands = [...stage.matchAll(/^RUN\b.*\bpnpm\s+(?:install|--filter|exec)\b.*$/gm)];

    for (const command of commands) {
      const beforeCommand = stage.slice(0, command.index);
      const copies = [...beforeCommand.matchAll(/^COPY\s+(\S+)\s+(\S+)\s*$/gm)];
      const copiesFullContext = copies.some(
        ([, sourcePath, targetPath]) => sourcePath === "." && targetPath === ".",
      );
      const copiesRootManifest = /^COPY\s+package\.json(?:\s|$)/m.test(
        beforeCommand,
      );
      const copiesPatchDirectory = copies.some(
        ([, sourcePath, targetPath]) =>
          sourcePath === "patches" && targetPath === "./patches",
      );
      const missingManifests = patchedDependencyManifests.filter((manifest) => {
        if (copiesFullContext) return false;
        if (manifest === "package.json") return !copiesRootManifest;

        return !copies.some(
          ([, sourcePath, targetPath]) =>
            (sourcePath === manifest && targetPath === "./" + manifest) ||
            (manifest.startsWith(sourcePath + "/") &&
              targetPath === "./" + sourcePath),
        );
      });
      const issues = [];

      if (!copiesFullContext && !copiesPatchDirectory) {
        issues.push("patches/");
      }
      if (missingManifests.length > 0) {
        issues.push("patched dependency manifests: " + missingManifests.join(", "));
      }

      if (issues.length > 0) {
        console.error(dockerfile + ": missing " + issues.join("; "));
        process.exitCode = 1;
      } else {
        console.log("OK " + dockerfile);
      }

      checked += 1;
    }
  }
}

if (checked === 0) {
  console.error("No Dockerfile pnpm install/build commands were found.");
  process.exitCode = 1;
}
