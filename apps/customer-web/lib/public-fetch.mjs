const transientStatuses = new Set([408, 425, 500, 502, 503, 504]);
const safeErrorNames = new Set([
  "AbortError",
  "TimeoutError",
  "TypeError",
  "NetworkError",
]);

export async function fetchPublicDataWithRetry(
  url,
  options = {},
  {
    maxAttempts = 3,
    retryDelayMs = 200,
    timeoutMs = 3000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const { signal: callerSignal, ...requestOptions } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetchImpl(url, { ...requestOptions, signal });
      if (attempt < maxAttempts && transientStatuses.has(response.status)) {
        try {
          await response.body?.cancel();
        } catch {
          // A failed body cancellation must not block the bounded retry.
        }
        await delay(retryDelayMs * attempt, callerSignal);
        continue;
      }

      return { response, attempts: attempt, error: null };
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      if (attempt === maxAttempts) {
        return { response: null, attempts: attempt, error };
      }
      await delay(retryDelayMs * attempt, callerSignal);
    }
  }

  throw new Error("Public request retry loop ended unexpectedly");
}

export function safeCatalogRouteLabel(path) {
  const pathname = path.split("?", 1)[0] || "/";
  return pathname.replace(
    /^\/customer\/menu\/products\/[^/]+$/,
    "/customer/menu/products/:id",
  );
}

export function logCatalogUpstreamEvent({
  path,
  status,
  attempts,
  elapsedMs,
  reason,
  recovered = false,
}) {
  const entry = {
    event: recovered
      ? "customer_catalog_upstream_recovered"
      : "customer_catalog_upstream_failed",
    route: safeCatalogRouteLabel(path),
    status: Number.isInteger(status) ? status : null,
    attempts,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    ...(safeErrorNames.has(reason) ? { reason } : {}),
  };

  const serialized = JSON.stringify(entry);
  if (recovered) console.info(serialized);
  else console.warn(serialized);
}

function delay(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
