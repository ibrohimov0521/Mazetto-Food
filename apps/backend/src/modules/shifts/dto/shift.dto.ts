import { CashTransactionType, ShiftType } from "@prisma/client";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class OpenShiftDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsEnum(ShiftType)
  type?: ShiftType;

  @IsNumber()
  @Min(0)
  openingBalance!: number;
}

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  closingBalance!: number;
}

export class CreateCashTransactionDto {
  @IsEnum(CashTransactionType)
  type!: CashTransactionType;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateCashTransferDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
