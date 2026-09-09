export const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3100",
  "http://localhost:3001",
  "http://localhost:3200",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3100",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3200",
  "https://mazettofood.uz",
  "https://www.mazettofood.uz",
  "https://pos.mazettofood.uz",
];

export function resolveAllowedOrigins(configured = process.env.CORS_ORIGINS): string[] {
  if (!configured) {
    return defaultAllowedOrigins;
  }

  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
