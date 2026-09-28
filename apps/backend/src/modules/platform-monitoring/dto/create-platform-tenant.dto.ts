import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateRestaurantTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,30}[A-Za-z0-9]$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
