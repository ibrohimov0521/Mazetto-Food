const loopbackHosts = new Set(["127.0.0.1", "localhost"]);
const targetOverrideParams = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "service",
]);

export function assertDisposableLoopbackDatabase(
  databaseUrl: string | undefined,
  expectedDatabase: string | RegExp,
  expectedPorts: string | readonly string[] = "5433",
): void {
  let url: URL;
  try {
    url = new URL(databaseUrl ?? "");
  } catch {
    throw new Error("A valid disposable PostgreSQL DATABASE_URL is required");
  }

  const hasTargetOverride = [...url.searchParams.keys()].some((key) =>
    targetOverrideParams.has(key.toLowerCase()),
  );
  const allowedPorts =
    typeof expectedPorts === "string" ? [expectedPorts] : expectedPorts;
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("Refusing database smoke with an invalid database name");
  }
  const databaseMatches =
    expectedDatabase instanceof RegExp
      ? expectedDatabase.test(databaseName)
      : databaseName === expectedDatabase;
  const expectedDatabaseLabel =
    expectedDatabase instanceof RegExp
      ? expectedDatabase.toString()
      : expectedDatabase;
  const expectedPortLabel = allowedPorts.join(" or ");

  if (
    hasTargetOverride ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !loopbackHosts.has(url.hostname) ||
    !allowedPorts.includes(url.port) ||
    !databaseMatches
  ) {
    throw new Error(
      `Refusing database smoke outside loopback PostgreSQL ${expectedDatabaseLabel} on port ${expectedPortLabel}`,
    );
  }
}
