export function withApiErrorReference(message, status, requestId) {
  return status >= 500 && typeof requestId === "string" && requestId
    ? `${message} (Murojaat kodi: ${requestId})`
    : message;
}

