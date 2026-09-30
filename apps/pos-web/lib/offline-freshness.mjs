const cachedResponses = new Map();
const listeners = new Set();
const MAX_TRACKED_RESPONSES = 300;

/**
 * @typedef {{ cachedResponses: number; oldestCachedAt: string | null }} ApiFreshnessSnapshot
 * @typedef {(snapshot: ApiFreshnessSnapshot) => void} ApiFreshnessListener
 */

/** @returns {ApiFreshnessSnapshot} */
export function getApiFreshnessSnapshot() {
  const times = [...cachedResponses.values()]
    .map((entry) => entry.cachedAt)
    .filter((value) => value !== null)
    .sort();
  return {
    cachedResponses: cachedResponses.size,
    oldestCachedAt: times[0] ?? null,
  };
}

/** @param {ApiFreshnessListener} listener */
export function subscribeApiFreshness(listener) {
  listeners.add(listener);
  listener(getApiFreshnessSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Realtime cursor responses must not make a cached menu appear live, while a
 * later online response refreshes that resource's freshness.
 * @param {string} path
 * @param {string} source
 * @param {string | null} cachedAt
 */
export function recordApiResponseFreshness(path, source, cachedAt) {
  if (path.split("?")[0].endsWith("/realtime/events")) return;

  if (source === "offline-cache" || source === "offline-optimistic") {
    const parsedAt =
      typeof cachedAt === "string" ? Date.parse(cachedAt) : Number.NaN;
    cachedResponses.set(path, {
      cachedAt: Number.isFinite(parsedAt)
        ? new Date(parsedAt).toISOString()
        : null,
    });
    while (cachedResponses.size > MAX_TRACKED_RESPONSES) {
      cachedResponses.delete(cachedResponses.keys().next().value);
    }
  } else if (source === "online" || source === "online-optimistic") {
    cachedResponses.delete(path);
  } else {
    return;
  }

  const snapshot = getApiFreshnessSnapshot();
  for (const listener of listeners) listener(snapshot);
}

export function clearApiFreshness() {
  cachedResponses.clear();
  const snapshot = getApiFreshnessSnapshot();
  for (const listener of listeners) listener(snapshot);
}
