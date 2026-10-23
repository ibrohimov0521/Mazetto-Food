import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { TENANT_FEATURE_CODES } from "../../../common/tenant/tenant-feature-catalog";

export class CreatePlatformTenantOnboardingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,30}[A-Za-z0-9]$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @IsString()
  @MaxLength(254)
  ownerLogin!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  ownerPassword!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,30}[A-Za-z0-9]$/)
  branchCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  branchName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  branchAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchPhone?: string;

  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/)
  subdomain!: string;

  @IsArray()
  @ArrayMaxSize(TENANT_FEATURE_CODES.length)
  @IsString({ each: true })
  @IsIn(TENANT_FEATURE_CODES, { each: true })
  enabledFeatureCodes!: string[];
}
