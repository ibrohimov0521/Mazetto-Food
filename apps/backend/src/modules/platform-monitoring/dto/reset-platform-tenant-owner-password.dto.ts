import { IsString, MaxLength, MinLength } from "class-validator";

export class ResetPlatformTenantOwnerPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  confirmation!: string;
}
