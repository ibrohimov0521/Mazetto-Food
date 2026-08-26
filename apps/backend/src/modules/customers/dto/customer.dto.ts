import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export enum OnlineOrderTypeDto {
  DELIVERY = "DELIVERY",
  PICKUP = "PICKUP",
}

export enum OnlinePaymentMethodDto {
  CASH = "CASH",
  CLICK = "CLICK",
  PAYME = "PAYME",
  CARD = "CARD",
}

export class CustomerRequestCodeDto {
  @IsString()
  @MaxLength(40)
  phone!: string;
}

export class CustomerVerifyCodeDto {
  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsString()
  @MaxLength(12)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class CustomerRefreshDto {
  @IsString()
  refreshToken!: string;
}

export class CustomerLogoutDto {
  @IsString()
  refreshToken!: string;
}

export class OnlineOrderModifierDto {
  @IsString()
  modifierId!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity = 1;
}

export class OnlineOrderItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnlineOrderModifierDto)
  modifiers?: OnlineOrderModifierDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateOnlineOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsEnum(OnlineOrderTypeDto)
  type!: OnlineOrderTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsEnum(OnlinePaymentMethodDto)
  paymentMethod!: OnlinePaymentMethodDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnlineOrderItemDto)
  items!: OnlineOrderItemDto[];
}
