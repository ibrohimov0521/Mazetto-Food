import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { normalizeIdempotencyKey } from "../idempotency/idempotency-key";

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const value = request.headers["idempotency-key"];
    return normalizeIdempotencyKey(Array.isArray(value) ? value[0] : value);
  },
);
