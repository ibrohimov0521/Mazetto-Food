export function realtimeSocketOrigin(apiUrl: string): string {
  const url = new URL(apiUrl);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Desktop realtime API URL is invalid");
  }
  return url.origin;
}
