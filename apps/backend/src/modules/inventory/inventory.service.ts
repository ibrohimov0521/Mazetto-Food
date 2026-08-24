import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IngredientUnit, Prisma, StockMovementType } from "@prisma/client";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateIngredientDto,
  CreateStockMovementDto,
  CreateWarehouseDto,
  InventoryQueryDto,
} from "./dto/inventory.dto";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createIngredient(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        minimumStock: new Prisma.Decimal(dto.minimumStock),
        costPerUnit: new Prisma.Decimal(dto.costPerUnit),
      },
    });
  }

  async createWarehouse(dto: CreateWarehouseDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);

    return this.prisma.warehouse.create({
      data: {
        branchId,
        name: dto.name,
      },
    });
  }

  async createMovement(dto: CreateStockMovementDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({
        where: { id: dto.ingredientId },
      });
      const warehouse = await tx.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });

      if (!ingredient) {
        throw new NotFoundException("Ingredient not found");
      }

      if (!warehouse) {
        throw new NotFoundException("Warehouse not found");
      }

      resolveBranchScope(user, warehouse.branchId);

      return this.applyStockMovement(tx, {
        ingredientId: dto.ingredientId,
        warehouseId: dto.warehouseId,
        type: dto.type,
        quantity: new Prisma.Decimal(dto.quantity),
        reason: dto.reason ?? null,
        createdById: user.id,
      });
    });
  }

  async getStock(query: InventoryQueryDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);

    const stockRows = await this.prisma.stock.findMany({
      where: {
        ...(branchId ? { warehouse: { branchId } } : {}),
        ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      },
      include: {
        ingredient: true,
        warehouse: { select: { id: true, name: true, branchId: true } },
      },
      orderBy: [
        { ingredient: { name: "asc" } },
        { warehouse: { name: "asc" } },
      ],
    });

    return stockRows.map((row) => ({
      id: row.id,
      warehouse: row.warehouse,
      ingredient: row.ingredient,
      currentQuantity: row.quantity,
      minimumQuantity: row.ingredient.minimumStock,
      status: this.getStockStatus(row.quantity, row.ingredient.minimumStock),
    }));
  }

  async getMovements(query: InventoryQueryDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    return this.prisma.stockMovement.findMany({
      where: {
        ...(branchId ? { warehouse: { branchId } } : {}),
        ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        ingredient: true,
        warehouse: { select: { id: true, name: true, branchId: true } },
        createdBy: {
          select: { id: true, displayName: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });
  }

  async getCost(query: InventoryQueryDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);

    const rows = await this.prisma.stock.findMany({
      where: {
        ...(branchId ? { warehouse: { branchId } } : {}),
        ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      },
      include: { ingredient: true },
    });

    const ingredients = rows.map((row) => {
      const value = row.quantity.mul(row.ingredient.costPerUnit);

      return {
        ingredientId: row.ingredientId,
        ingredientName: row.ingredient.name,
        quantity: row.quantity,
        costPerUnit: row.ingredient.costPerUnit,
        value,
      };
    });
    const totalInventoryValue = ingredients.reduce(
      (total, ingredient) => total.add(ingredient.value),
      new Prisma.Decimal(0),
    );

    return { totalInventoryValue, ingredients };
  }

  async applyStockMovement(
    tx: Prisma.TransactionClient,
    data: {
      ingredientId: string;
      warehouseId: string;
      type: StockMovementType;
      quantity: Prisma.Decimal;
      reason: string | null;
      createdById?: string | null;
      orderItemId?: string | null;
      sourceType?: string | null;
      sourceId?: string | null;
      sourceItemId?: string | null;
    },
  ) {
    const signedQuantity = this.toSignedQuantity(data.type, data.quantity);
    const existingMovement = await this.findExistingSourceMovement(tx, data);

    if (existingMovement) {
      return existingMovement;
    }

    const movementResult = await tx.stockMovement
      .create({
        data: {
          ingredientId: data.ingredientId,
          warehouseId: data.warehouseId,
          type: data.type,
          quantity: signedQuantity,
          reason: data.reason,
          createdById: data.createdById ?? null,
          orderItemId: data.orderItemId ?? null,
          sourceType: data.sourceType ?? null,
          sourceId: data.sourceId ?? null,
          sourceItemId: data.sourceItemId ?? null,
        },
      })
      .then((movement) => ({ movement, created: true }))
      .catch(async (error: unknown) => {
        if (this.isUniqueConstraintError(error)) {
          const movement = await this.findExistingSourceMovement(tx, data);

          if (movement) {
            return { movement, created: false };
          }
        }

        throw error;
      });

    if (!movementResult.created) {
      return movementResult.movement;
    }

    const stock = await tx.stock.upsert({
      where: {
        warehouseId_ingredientId: {
          warehouseId: data.warehouseId,
          ingredientId: data.ingredientId,
        },
      },
      create: {
        warehouseId: data.warehouseId,
        ingredientId: data.ingredientId,
        quantity: signedQuantity,
      },
      update: {
        quantity: { increment: signedQuantity },
      },
    });

    if (stock.quantity.lessThan(0)) {
      throw new BadRequestException("Stock cannot go below zero");
    }

    return movementResult.movement;
  }

  convertQuantity(
    quantity: Prisma.Decimal,
    fromUnit: IngredientUnit,
    toUnit: IngredientUnit,
  ): Prisma.Decimal {
    if (fromUnit === toUnit) {
      return quantity;
    }

    if (fromUnit === IngredientUnit.KG && toUnit === IngredientUnit.GRAM) {
      return quantity.mul(1000);
    }

    if (fromUnit === IngredientUnit.GRAM && toUnit === IngredientUnit.KG) {
      return quantity.div(1000);
    }

    throw new BadRequestException(
      `Recipe unit ${fromUnit} is incompatible with ingredient stock unit ${toUnit}`,
    );
  }

  private toSignedQuantity(
    type: StockMovementType,
    quantity: Prisma.Decimal,
  ): Prisma.Decimal {
    if (type === StockMovementType.OUT || type === StockMovementType.WASTE) {
      return quantity.negated();
    }

    return quantity;
  }

  private getStockStatus(
    quantity: Prisma.Decimal,
    minimumStock: Prisma.Decimal,
  ) {
    if (quantity.lessThanOrEqualTo(0)) {
      return "OUT_OF_STOCK";
    }

    if (quantity.lessThanOrEqualTo(minimumStock)) {
      return "LOW_STOCK";
    }

    return "NORMAL";
  }

  private async findExistingSourceMovement(
    tx: Prisma.TransactionClient,
    data: {
      ingredientId: string;
      warehouseId: string;
      sourceType?: string | null;
      sourceItemId?: string | null;
    },
  ) {
    if (!data.sourceType || !data.sourceItemId) {
      return null;
    }

    return tx.stockMovement.findFirst({
      where: {
        sourceType: data.sourceType,
        sourceItemId: data.sourceItemId,
        ingredientId: data.ingredientId,
        warehouseId: data.warehouseId,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
