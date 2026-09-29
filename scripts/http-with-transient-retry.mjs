const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

export async function fetchWithTransientRetry(
  url,
  options = {},
  { timeoutMs, retryDelayMs = 300 } = {},
) {
  const { signal: callerSignal, ...requestOptions } = options;

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const timeoutSignal = timeoutMs === undefined
        ? undefined
        : AbortSignal.timeout(timeoutMs);
      const signal = callerSignal && timeoutSignal
        ? AbortSignal.any([callerSignal, timeoutSignal])
        : callerSignal ?? timeoutSignal;
      const response = await fetch(url, {
        ...requestOptions,
        ...(signal ? { signal } : {}),
      });

      if (
        attempt < maxAttempts - 1 &&
        TRANSIENT_HTTP_STATUSES.has(response.status)
      ) {
        await response.body?.cancel();
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * (attempt + 1)),
        );
        continue;
      }
      return response;
    } catch (error) {
      if (attempt < maxAttempts - 1 && !callerSignal?.aborted) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * (attempt + 1)),
        );
        continue;
      }
      throw error;
    }
  }

  throw new Error(`request failed after retry: ${url}`);
}
