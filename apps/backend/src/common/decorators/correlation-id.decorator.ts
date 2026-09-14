import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import {
  requireCorrelationId,
  type RequestWithContext,
} from "../request/request-context";

export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    requireCorrelationId(
      context.switchToHttp().getRequest<RequestWithContext>(),
    ),
);
