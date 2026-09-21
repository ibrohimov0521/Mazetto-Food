import { Type } from "class-transformer";
import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListExpensesDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  /** Smenaga bog'lansa, xarajat kassa hisob-kitobiga kiradi. */
  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  expenseDate?: string;
}

export class CreateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
}

export class UpdateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
}
