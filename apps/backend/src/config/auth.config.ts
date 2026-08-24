const DEVELOPMENT_ACCESS_SECRET = "development-only-access-secret-change-before-production";
const DEVELOPMENT_REFRESH_SECRET = "development-only-refresh-secret-change-before-production";
const DEVELOPMENT_CUSTOMER_ACCESS_SECRET = "development-only-customer-access-secret-change-before-production";
const DEVELOPMENT_CUSTOMER_REFRESH_SECRET = "development-only-customer-refresh-secret-change-before-production";

export function getJwtAccessSecret(): string {
  return getRequiredSecret("JWT_ACCESS_SECRET", DEVELOPMENT_ACCESS_SECRET);
}

export function getJwtRefreshSecret(): string {
  return getRequiredSecret("JWT_REFRESH_SECRET", DEVELOPMENT_REFRESH_SECRET);
}

export function getJwtAccessExpiresIn(): number {
  return getPositiveNumber("JWT_ACCESS_EXPIRES_IN_SECONDS", 900);
}

export function getJwtRefreshExpiresIn(): number {
  return getPositiveNumber("JWT_REFRESH_EXPIRES_IN_SECONDS", 604800);
}

export function getCustomerJwtAccessSecret(): string {
  return getRequiredSecret("CUSTOMER_JWT_ACCESS_SECRET", DEVELOPMENT_CUSTOMER_ACCESS_SECRET);
}

export function getCustomerJwtRefreshSecret(): string {
  return getRequiredSecret("CUSTOMER_JWT_REFRESH_SECRET", DEVELOPMENT_CUSTOMER_REFRESH_SECRET);
}

export function getCustomerJwtAccessExpiresIn(): number {
  return getPositiveNumber("CUSTOMER_JWT_ACCESS_EXPIRES_IN_SECONDS", 900);
}

export function getCustomerJwtRefreshExpiresIn(): number {
  return getPositiveNumber("CUSTOMER_JWT_REFRESH_EXPIRES_IN_SECONDS", 604800);
}

function getRequiredSecret(name: string, developmentFallback: string): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be configured in production`);
  }

  return developmentFallback;
}

function getPositiveNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return parsed;
}
