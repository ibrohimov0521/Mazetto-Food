const cachedResponses = new Map();
const listeners = new Map();
const MAX_TRACKED_RESPONSES = 300;
const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * @typedef {"live" | "cached" | "stale"} ApiFreshnessState
 * @typedef {{ cachedResponses: number; oldestCachedAt: string | null; freshnessState: ApiFreshnessState }} ApiFreshnessSnapshot
 * @typedef {(snapshot: ApiFreshnessSnapshot) => void} ApiFreshnessListener
 */

/** @param {number} [now] @param {string | null} [panelPath] @param {string | null} [scopeKey] @returns {ApiFreshnessSnapshot} */
export function getApiFreshnessSnapshot(
  now = Date.now(),
  panelPath = null,
  scopeKey = null,
) {
  const responses = [...cachedResponses.values()].filter(
    (entry) =>
      (panelPath === null || entry.panels.has(panelPath)) &&
      (scopeKey === null || entry.scopeKey === scopeKey),
  );
  const cachedAtValues = responses.map((entry) => entry.cachedAt);
  const times = cachedAtValues
    .map((value) => (value === null ? Number.NaN : Date.parse(value)))
    .filter(Number.isFinite);
  const oldestTime = times.length ? Math.min(...times) : null;
  const cacheAge = oldestTime === null ? null : Math.max(0, now - oldestTime);
  const hasUnknownTimestamp = times.length < cachedAtValues.length;
  const freshnessState =
    responses.length === 0
      ? "live"
      : hasUnknownTimestamp || cacheAge === null || cacheAge >= STALE_AFTER_MS
        ? "stale"
        : "cached";

  return {
    cachedResponses: responses.length,
    oldestCachedAt:
      oldestTime === null ? null : new Date(oldestTime).toISOString(),
    freshnessState,
  };
}

/**
 * @param {{ cachedResponses: number; freshnessState: ApiFreshnessState; isOffline: boolean; isConnecting: boolean; refreshing: boolean }} state
 */
export function getApiSyncStatusLabel({
  cachedResponses,
  freshnessState,
  isOffline,
  isConnecting,
  refreshing,
}) {
  const usesCachedData = cachedResponses > 0;
  if (refreshing && !isOffline) {
    if (!usesCachedData) return "Yangilanmoqda";
    return freshnessState === "stale"
      ? "Eski kesh yangilanmoqda"
      : "Kesh yangilanmoqda";
  }
  if (usesCachedData) {
    if (freshnessState === "stale") {
      return isOffline ? "Oflayn · kesh eski" : "Kesh eskirgan";
    }
    return isOffline ? "Oflayn · kesh" : "Keshdan o'qildi";
  }
  if (isOffline) return "Aloqa uzildi";
  return isConnecting ? "Ulanmoqda" : "Ulangan";
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

/** @param {ApiFreshnessListener} listener @param {string | null} [panelPath] @param {string | null} [scopeKey] */
export function subscribeApiFreshness(
  listener,
  panelPath = null,
  scopeKey = null,
) {
  listeners.set(listener, { panelPath, scopeKey });
  listener(getApiFreshnessSnapshot(Date.now(), panelPath, scopeKey));
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
 * @param {string | null} [panelPath]
 * @param {string | null} [scopeKey]
 */
export function recordApiResponseFreshness(
  path,
  source,
  cachedAt,
  panelPath = null,
  scopeKey = null,
) {
  if (path.split("?")[0].endsWith("/realtime/events")) return;

  const resourceKey = `${scopeKey ?? "anonymous"}\u0000${path}`;
  if (source === "offline-cache" || source === "offline-optimistic") {
    const parsedAt =
      typeof cachedAt === "string" ? Date.parse(cachedAt) : Number.NaN;
    const panels = new Set(cachedResponses.get(resourceKey)?.panels ?? []);
    if (panelPath) panels.add(panelPath);
    cachedResponses.set(resourceKey, {
      cachedAt: Number.isFinite(parsedAt)
        ? new Date(parsedAt).toISOString()
        : null,
      panels,
      scopeKey: scopeKey ?? "anonymous",
    });
    while (cachedResponses.size > MAX_TRACKED_RESPONSES) {
      cachedResponses.delete(cachedResponses.keys().next().value);
    }
  } else if (source === "online" || source === "online-optimistic") {
    cachedResponses.delete(resourceKey);
  } else {
    return;
  }

  notifyFreshnessSubscribers();
}

export function clearApiFreshness() {
  cachedResponses.clear();
  notifyFreshnessSubscribers();
}

function notifyFreshnessSubscribers() {
  for (const [listener, scope] of listeners) {
    listener(
      getApiFreshnessSnapshot(Date.now(), scope.panelPath, scope.scopeKey),
    );
  }
}

/**
 * @param {{ id: string; employeeId?: string; tenantId?: string; membershipId?: string; credentialVersion?: number; branchId?: string; isGlobalScope?: boolean; roles?: string[]; permissions?: string[] } | null} user
 */
export function getApiFreshnessScope(user) {
  if (!user) return "anonymous";
  const normalize = (values = []) => [...new Set(values)].sort();
  return JSON.stringify([
    user.id,
    user.employeeId ?? null,
    user.tenantId ?? null,
    user.membershipId ?? null,
    user.credentialVersion ?? null,
    user.branchId ?? null,
    user.isGlobalScope === true,
    normalize(user.roles),
    normalize(user.permissions),
  ]);
}
