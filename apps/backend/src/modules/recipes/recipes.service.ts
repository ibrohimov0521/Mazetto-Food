import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpsertRecipeDto } from "./dto/recipe.dto";

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecipes() {
    return this.prisma.recipe.findMany({
      include: this.recipeInclude(),
      orderBy: { updatedAt: "desc" },
    });
  }

  async getRecipeByVariant(variantId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { variantId },
      include: this.recipeInclude(),
    });

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    return recipe;
  }

  async upsertRecipe(dto: UpsertRecipeDto) {
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: dto.variantId },
        select: { id: true },
      });

      if (!variant) {
        throw new NotFoundException("Product variant not found");
      }

      const recipe = await tx.recipe.upsert({
        where: { variantId: dto.variantId },
        update: {},
        create: { variantId: dto.variantId },
      });

      await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
      await tx.recipeItem.createMany({
        data: dto.items.map((item) => ({
          recipeId: recipe.id,
          ingredientId: item.ingredientId,
          quantity: new Prisma.Decimal(item.quantity),
          unit: item.unit,
        })),
      });

      return tx.recipe.findUnique({
        where: { id: recipe.id },
        include: this.recipeInclude(),
      });
    });
  }

  private recipeInclude() {
    return {
      variant: {
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true },
          },
        },
      },
      items: {
        include: { ingredient: true },
        orderBy: { createdAt: "asc" },
      },
    } satisfies Prisma.RecipeInclude;
  }
}
