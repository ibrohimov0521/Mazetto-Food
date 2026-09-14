import { randomUUID } from "node:crypto";
import type { Request } from "express";

export const CORRELATION_ID_HEADER = "x-correlation-id";

const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type RequestWithContext = Request & {
  correlationId?: string;
};

export function resolveCorrelationId(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && SAFE_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

export function requireCorrelationId(request: RequestWithContext): string {
  if (!request.correlationId) {
    request.correlationId = resolveCorrelationId(
      request.headers[CORRELATION_ID_HEADER],
    );
  }

  return request.correlationId;
}
