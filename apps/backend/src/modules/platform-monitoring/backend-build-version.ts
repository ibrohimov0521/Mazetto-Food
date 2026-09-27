import { readFileSync } from "node:fs";
import { join } from "node:path";

export function resolveBackendBuildVersion(configuredVersion = process.env.MAZETTO_BUILD_VERSION): string {
  const configured = configuredVersion?.trim();
  if (configured) return configured.slice(0, 40);

  try {
    const packageJson = JSON.parse(readFileSync(join(__dirname, "../../../package.json"), "utf8")) as {
      version?: unknown;
    };
    if (typeof packageJson.version === "string" && packageJson.version.trim()) {
      return packageJson.version.trim().slice(0, 40);
    }
  } catch {
    // The package version is best-effort when running from a standalone test bundle.
  }

  return "unknown";
}

export function resolveBackendBuildId(configuredBuildId = process.env.MAZETTO_BUILD_ID): string | undefined {
  const buildId = configuredBuildId?.trim();
  return buildId ? buildId.slice(0, 40) : undefined;
}
