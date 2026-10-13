const loopbackHosts = new Set(["127.0.0.1", "localhost"]);

export function assertDisposableLoopbackDatabase(
  databaseUrl: string | undefined,
  expectedDatabase: string,
  expectedPort = "5433",
): void {
  let url: URL;
  try {
    url = new URL(databaseUrl ?? "");
  } catch {
    throw new Error("A valid disposable PostgreSQL DATABASE_URL is required");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !loopbackHosts.has(url.hostname) ||
    url.port !== expectedPort ||
    url.pathname !== `/${expectedDatabase}`
  ) {
    throw new Error(
      `Refusing database smoke outside loopback PostgreSQL ${expectedDatabase} on port ${expectedPort}`,
    );
  }
}
