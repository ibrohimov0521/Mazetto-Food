import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { UpsertRecipeDto } from "./dto/recipe.dto";
import { RecipesService } from "./recipes.service";

@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  listRecipes() {
    return this.recipesService.listRecipes();
  }

  @Get("variants/:variantId")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  getRecipeByVariant(@Param("variantId") variantId: string) {
    return this.recipesService.getRecipeByVariant(variantId);
  }

  @Put()
  @Permissions(PERMISSIONS.RECIPE_MANAGE)
  upsertRecipe(@Body() dto: UpsertRecipeDto) {
    return this.recipesService.upsertRecipe(dto);
  }
}
