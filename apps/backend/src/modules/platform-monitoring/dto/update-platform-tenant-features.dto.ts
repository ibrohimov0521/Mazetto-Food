import { ArrayMaxSize, IsArray, IsIn, IsString } from "class-validator";
import { TENANT_FEATURE_CODES } from "../../../common/tenant/tenant-feature-catalog";

export class UpdatePlatformTenantFeaturesDto {
  @IsArray()
  @ArrayMaxSize(TENANT_FEATURE_CODES.length)
  @IsString({ each: true })
  @IsIn(TENANT_FEATURE_CODES, { each: true })
  enabledCodes!: string[];
}
