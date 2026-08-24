import { IngredientUnit, StockMovementType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

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
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit = 100;
}
