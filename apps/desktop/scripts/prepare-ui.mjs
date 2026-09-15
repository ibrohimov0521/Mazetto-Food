import { spawnSync } from "node:child_process";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const workspaceRoot = resolve(desktopDirectory, "../..");
const posDirectory = join(workspaceRoot, "apps", "pos-web");
const standaloneDirectory = join(posDirectory, ".next", "standalone");
const outputDirectory = join(desktopDirectory, "runtime", "pos-web");

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error("pnpm CLI path is not available");
}

const result = spawnSync(
  process.execPath,
  [pnpmCli, "--filter", "pos-web", "build"],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      API_INTERNAL_URL: "http://127.0.0.1:7359",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:7359/api/v1",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await materializeTree(standaloneDirectory, outputDirectory, {
  skipNodeModules: true,
});

const standaloneApp = join(outputDirectory, "apps", "pos-web");
await mkdir(join(standaloneApp, ".next"), { recursive: true });
await materializeTree(
  join(posDirectory, ".next", "static"),
  join(standaloneApp, ".next", "static"),
);
await materializeTree(
  join(posDirectory, "public"),
  join(standaloneApp, "public"),
);

// A packaged Electron binary cannot reliably act as a child Node runtime on
// Windows. Ship the Node executable used during packaging for the bundled UI.
await copyFile(process.execPath, join(outputDirectory, "node.exe"));

await flattenStandaloneDependencies(
  join(standaloneDirectory, "node_modules", ".pnpm"),
  join(standaloneApp, "node_modules"),
);

const packageJson = JSON.parse(
  await readFile(join(desktopDirectory, "package.json"), "utf8"),
);
await writeFile(
  join(outputDirectory, "mazetto-runtime.json"),
  `${JSON.stringify(
    {
      desktopVersion: packageJson.version,
      preparedAt: new Date().toISOString(),
      entry: "apps/pos-web/server.js",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Desktop UI prepared at ${outputDirectory}`);

async function materializeTree(
  source,
  destination,
  options = { skipNodeModules: false },
) {
  let resolvedSource = source;
  let sourceStats = await lstat(source);
  if (sourceStats.isSymbolicLink()) {
    resolvedSource = await realpath(source);
    sourceStats = await lstat(resolvedSource);
  }

  if (sourceStats.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const entries = await readdir(resolvedSource);
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".pnpm") {
        continue;
      }
      await materializeTree(
        join(resolvedSource, entry),
        join(destination, entry),
        options,
      );
    }
    return;
  }

  await mkdir(dirname(destination), { recursive: true });
  try {
    await link(resolvedSource, destination);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EXDEV"
    ) {
      await copyFile(resolvedSource, destination);
      return;
    }
    throw error;
  }
}

async function flattenStandaloneDependencies(source, destination) {
  const packageDirectories = await readdir(source, { withFileTypes: true });
  const copied = new Set();

  for (const packageDirectory of packageDirectories) {
    if (
      !packageDirectory.isDirectory() ||
      packageDirectory.name === "node_modules"
    ) {
      continue;
    }

    const packageNodeModules = join(
      source,
      packageDirectory.name,
      "node_modules",
    );
    const entries = await readdir(packageNodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith("@") && entry.isDirectory()) {
        const scopedEntries = await readdir(
          join(packageNodeModules, entry.name),
          {
            withFileTypes: true,
          },
        );
        for (const scopedEntry of scopedEntries) {
          await copyDependency(
            join(packageNodeModules, entry.name, scopedEntry.name),
            join(destination, entry.name, scopedEntry.name),
            copied,
          );
        }
        continue;
      }

      await copyDependency(
        join(packageNodeModules, entry.name),
        join(destination, entry.name),
        copied,
      );
    }
  }
}

async function copyDependency(source, destination, copied) {
  const key = destination.toLowerCase();
  if (copied.has(key)) {
    return;
  }
  copied.add(key);
  await materializeTree(source, destination, { skipNodeModules: true });
}
