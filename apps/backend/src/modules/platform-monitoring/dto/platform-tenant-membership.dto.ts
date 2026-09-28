import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreatePlatformTenantMembershipDto {
  @IsString()
  @MaxLength(254)
  identifier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  branchId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[A-Z0-9_]{2,48}$/, { each: true })
  roleCodes!: string[];
}

export class UpdatePlatformTenantMembershipRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[A-Z0-9_]{2,48}$/, { each: true })
  roleCodes!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  branchId?: string;
}

export class UpdatePlatformTenantMembershipStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "SUSPENDED";
}
