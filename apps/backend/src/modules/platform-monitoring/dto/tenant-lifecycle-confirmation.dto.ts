import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class TenantLifecycleConfirmationDto {
  @IsString()
  @Matches(/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/)
  confirmationCode!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
