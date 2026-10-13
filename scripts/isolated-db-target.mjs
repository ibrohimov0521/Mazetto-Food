const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const targetOverrideParams = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "service",
]);

function parseLoopbackPostgresUrl(databaseUrl, allowedPorts) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("A valid local PostgreSQL URL is required");
  }

  const port = url.port || "5432";
  const hasTargetOverride = [...url.searchParams.keys()].some((key) =>
    targetOverrideParams.has(key.toLowerCase()),
  );
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !loopbackHosts.has(url.hostname) ||
    !allowedPorts.includes(port) ||
    hasTargetOverride
  ) {
    throw new Error(
      "Refusing PostgreSQL URL outside the allowed loopback target",
    );
  }
  return url;
}

export function assertDisposableLoopbackDatabaseUrl(
  databaseUrl,
  expectedDatabase,
  allowedPorts = ["5432", "5433"],
) {
  const url = parseLoopbackPostgresUrl(databaseUrl, allowedPorts);
  let databaseName;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("Refusing database URL with an invalid database name");
  }
  const matches =
    expectedDatabase instanceof RegExp
      ? expectedDatabase.test(databaseName)
      : databaseName === expectedDatabase;
  if (!matches) {
    throw new Error(
      `Refusing database URL outside disposable database ${expectedDatabase}`,
    );
  }
  return url;
}

export function assertLocalPostgresAdminUrl(
  databaseUrl,
  allowedPorts = ["5432", "5433", "15432"],
) {
  const url = assertDisposableLoopbackDatabaseUrl(
    databaseUrl,
    /^[a-z0-9_]+$/i,
    allowedPorts,
  );
  url.pathname = "/postgres";
  return url;
}
