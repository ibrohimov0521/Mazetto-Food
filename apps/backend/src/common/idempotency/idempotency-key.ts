import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";

const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_SCOPE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function normalizeIdempotencyKey(value: string | undefined): string {
  if (!value || !SAFE_IDEMPOTENCY_KEY.test(value)) {
    throw new BadRequestException(
      "Idempotency-Key 8-128 ta xavfsiz belgi bo'lishi kerak",
    );
  }

  return value;
}

export function buildIdempotencyScope(...parts: string[]): string {
  if (parts.length === 0 || parts.some((part) => !SAFE_SCOPE_PART.test(part))) {
    throw new Error(
      "Idempotency scope qismlari xavfsiz va bo'sh bo'lmasligi kerak",
    );
  }

  return parts.join(":");
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error("Idempotency payload JSON qiymat bo'lishi kerak");
    }
    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);

  return `{${entries.join(",")}}`;
}
