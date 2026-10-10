import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const patchFiles = readdirSync("patches").filter((file) =>
  file.endsWith(".patch"),
);

if (patchFiles.length === 0) {
  console.log("No pnpm patched dependencies; Docker context check skipped.");
  process.exit(0);
}

const dockerfiles = readdirSync("apps", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join("apps", entry.name, "Dockerfile"))
  .filter(existsSync);
let checked = 0;

for (const dockerfile of dockerfiles) {
  const source = readFileSync(dockerfile, "utf8");
  const installs = [...source.matchAll(/^RUN\s+pnpm\s+install\b.*$/gm)];

  for (const install of installs) {
    const beforeInstall = source.slice(0, install.index);
    const copiesPatchDirectory = /^COPY\s+patches\s+\.\/patches\s*$/m.test(
      beforeInstall,
    );

    if (!copiesPatchDirectory) {
      console.error(dockerfile + ": copy patches/ before pnpm install");
      process.exitCode = 1;
    } else {
      console.log("OK " + dockerfile);
    }

    checked += 1;
  }
}

if (checked === 0) {
  console.error("No Dockerfile pnpm install stages were found.");
  process.exitCode = 1;
}
