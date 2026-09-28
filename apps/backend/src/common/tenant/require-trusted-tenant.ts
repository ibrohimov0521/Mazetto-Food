import { ForbiddenException } from "@nestjs/common";
import type { TenantRequestContext } from "./tenant-request-context.service";

export function requireTrustedTenantId(
  context?: TenantRequestContext,
): string {
  if (!context || context.kind !== "TRUSTED") {
    throw new ForbiddenException(
      "Tasdiqlangan restoran domeni talab qilinadi.",
    );
  }
  return context.tenantId;
}
