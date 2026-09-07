import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  IsDefined,
} from "class-validator";

export class DeliveryLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  house!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @IsIn(["gps", "map"])
  source!: "gps" | "map";

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracyMeters?: number;
}

export class SaveCustomerAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => DeliveryLocationDto)
  location!: DeliveryLocationDto;
}
