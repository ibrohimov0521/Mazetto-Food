const cachedResponses = new Map();
const listeners = new Set();
const MAX_TRACKED_RESPONSES = 300;
const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * @typedef {"live" | "cached" | "stale"} ApiFreshnessState
 * @typedef {{ cachedResponses: number; oldestCachedAt: string | null; freshnessState: ApiFreshnessState }} ApiFreshnessSnapshot
 * @typedef {(snapshot: ApiFreshnessSnapshot) => void} ApiFreshnessListener
 */

/** @param {number} [now] @returns {ApiFreshnessSnapshot} */
export function getApiFreshnessSnapshot(now = Date.now()) {
  const cachedAtValues = [...cachedResponses.values()].map(
    (entry) => entry.cachedAt,
  );
  const times = cachedAtValues
    .map((value) => (value === null ? Number.NaN : Date.parse(value)))
    .filter(Number.isFinite);
  const oldestTime = times.length ? Math.min(...times) : null;
  const cacheAge = oldestTime === null ? null : Math.max(0, now - oldestTime);
  const hasUnknownTimestamp = times.length < cachedAtValues.length;
  const freshnessState =
    cachedResponses.size === 0
      ? "live"
      : hasUnknownTimestamp || cacheAge === null || cacheAge >= STALE_AFTER_MS
        ? "stale"
        : "cached";

  return {
    cachedResponses: cachedResponses.size,
    oldestCachedAt:
      oldestTime === null ? null : new Date(oldestTime).toISOString(),
    freshnessState,
  };
}

/** @param {string | null} timestamp @param {number} [now] */
export function formatApiFreshnessAge(timestamp, now = Date.now()) {
  const cachedAt = timestamp === null ? Number.NaN : Date.parse(timestamp);
  if (!Number.isFinite(cachedAt)) return "yoshi noma'lum";

  const age = Math.max(0, now - cachedAt);
  if (age < 60_000) return "hozirgina";
  if (age < 60 * 60 * 1000) return `${Math.floor(age / 60_000)} daq avval`;
  if (age < 24 * 60 * 60 * 1000)
    return `${Math.floor(age / (60 * 60 * 1000))} soat avval`;
  return `${Math.floor(age / (24 * 60 * 60 * 1000))} kun avval`;
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
