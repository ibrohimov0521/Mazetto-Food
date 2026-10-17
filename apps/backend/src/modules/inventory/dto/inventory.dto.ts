import { IngredientUnit, StockMovementType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateIngredientDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(IngredientUnit)
  unit!: IngredientUnit;

  @IsNumber()
  @Min(0)
  minimumStock!: number;

  @IsNumber()
  @Min(0)
  costPerUnit!: number;
}

export class CreateWarehouseDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;
}

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;
}

export class UpdateWarehouseDto {
  @IsString()
  @MaxLength(100)
  name!: string;
}

export class CreateStockMovementDto {
  @IsString()
  ingredientId!: string;

  @IsString()
  warehouseId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  ingredientId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;
}
