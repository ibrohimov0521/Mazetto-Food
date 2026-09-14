import type { NextFunction, Response } from "express";
import {
  CORRELATION_ID_HEADER,
  requireCorrelationId,
  type RequestWithContext,
} from "./request-context";

export function correlationIdMiddleware(
  request: RequestWithContext,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader(CORRELATION_ID_HEADER, requireCorrelationId(request));
  next();
}
