import { IsOptional, IsString, Matches } from "class-validator";

export class UpdatePlatformTenantTelegramDto {
  @IsOptional()
  @IsString()
  @Matches(/^-?[0-9]{5,20}$/)
  staffChatId?: string | null;
}
