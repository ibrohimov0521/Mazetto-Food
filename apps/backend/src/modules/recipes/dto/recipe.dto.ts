import { IngredientUnit } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsString, Min, ValidateNested } from "class-validator";

export class RecipeItemDto {
  @IsString()
  ingredientId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsEnum(IngredientUnit)
  unit!: IngredientUnit;
}

export class UpsertRecipeDto {
  @IsString()
  variantId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items!: RecipeItemDto[];
}
