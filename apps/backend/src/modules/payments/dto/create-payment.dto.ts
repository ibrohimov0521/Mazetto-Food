import { PaymentStatus } from "@prisma/client";
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
  ValidateIf,
} from "class-validator";

export class CreatePaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @ValidateIf((dto: CreatePaymentDto) => !dto.paymentMethodCode)
  @IsString()
  paymentMethodId?: string;

  @ValidateIf((dto: CreatePaymentDto) => !dto.paymentMethodId)
  @IsString()
  paymentMethodCode?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionId?: string;
}

export class PaymentTenderDto {
  @ValidateIf((dto: PaymentTenderDto) => !dto.paymentMethodCode)
  @IsString()
  paymentMethodId?: string;

  @ValidateIf((dto: PaymentTenderDto) => !dto.paymentMethodId)
  @IsString()
  paymentMethodCode?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionId?: string;
}

export class ProcessOrderPaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentTenderDto)
  payments!: PaymentTenderDto[];
}
