import { SetMetadata } from "@nestjs/common";
import type { TenantFeatureCode } from "../tenant/tenant-feature-catalog";

export const TENANT_FEATURE_KEY = "tenant-feature";
export const RequiresTenantFeature = (code: TenantFeatureCode) =>
  SetMetadata(TENANT_FEATURE_KEY, code);
