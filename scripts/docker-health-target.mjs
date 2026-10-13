const legacyContainers = {
  postgres: "mazetto-postgres",
  redis: "mazetto-redis",
};

export function isDockerHealthOutputHealthy(kind, output) {
  const value = String(output ?? "").trim();
  if (kind === "postgres") return value.includes("accepting connections");
  if (kind === "redis") return value === "PONG";
  throw new Error(`Unsupported Docker health target: ${kind}`);
}

export function parseDockerContainerRows(output) {
  return String(output)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [id, image, names] = line.split("|");
      return { id, image, names };
    })
    .filter((row) => row.id && row.image && row.names);
}

export function resolveDockerHealthTarget(kind, rows, override) {
  const legacy = legacyContainers[kind];
  if (!legacy) throw new Error(`Unsupported Docker health target: ${kind}`);
  if (typeof override === "string" && override.trim()) {
    return { container: override.trim(), source: "override" };
  }

  const imageName = kind === "postgres" ? "postgres" : "redis";
  const candidates = rows.filter((row) => {
    const image = String(row.image ?? "")
      .split("/")
      .pop()
      .split(/[:@]/)[0];
    const identity = String(row.names ?? "").toLowerCase();
    const appScoped =
      identity.includes("mazetto-food-") ||
      identity.includes(legacy.toLowerCase());
    return (
      image.toLowerCase() === imageName &&
      appScoped &&
      identity.includes(imageName)
    );
  });

  if (candidates.length === 1) {
    return { container: candidates[0].id, source: "discovered" };
  }
  if (candidates.length > 1) {
    return {
      error: `aniq emas: ${candidates.length} ta mos konteyner; ${kind === "postgres" ? "MAZETTO_PG_CONTAINER" : "MAZETTO_REDIS_CONTAINER"} ni belgilang`,
      candidates: candidates.map(({ names }) => names),
    };
  }
  return { container: legacy, source: "legacy" };
}
