import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { OrderItemModifierDto } from "./order-item.dto";

export class PosCheckoutItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @IsPositive()
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  modifiers?: OrderItemModifierDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class CreatePosCheckoutDto {
  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => PosCheckoutItemDto)
  items!: PosCheckoutItemDto[];

  @IsNumber()
  @Min(0)
  cashReceived!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
