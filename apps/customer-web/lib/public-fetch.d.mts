type PublicFetchResult =
  | { response: Response; attempts: number; error: null }
  | { response: null; attempts: number; error: unknown };

export function fetchPublicDataWithRetry(
  url: string,
  options?: RequestInit & { next?: object | undefined },
  config?: {
    maxAttempts?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<PublicFetchResult>;

export function safeCatalogRouteLabel(path: string): string;

export function logCatalogUpstreamEvent(input: {
  path: string;
  status: number | null;
  attempts: number;
  elapsedMs: number;
  reason?: string;
  recovered?: boolean;
}): void;
