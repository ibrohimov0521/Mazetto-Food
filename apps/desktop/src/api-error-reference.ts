export type DesktopApiError = {
  message?: string | string[];
  requestId?: string;
};

export function formatDesktopApiError(
  error: DesktopApiError | undefined,
  status: number,
  fallback: string,
): string {
  const rawMessage = Array.isArray(error?.message)
    ? error.message.join(", ")
    : error?.message;
  const message = rawMessage?.trim() || fallback;
  const requestId = error?.requestId?.trim();

  return status >= 500 && requestId
    ? `${message} (Murojaat kodi: ${requestId})`
    : message;
}
