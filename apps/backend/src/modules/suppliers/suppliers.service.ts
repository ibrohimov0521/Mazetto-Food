import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  resolveRestaurantScope,
  resolveSoleActiveTenantId,
} from "../../common/auth/tenant-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(branchId: string | undefined, user: AuthenticatedUser) {
    const scope = await this.resolveSingleActiveTenantScope(user, branchId);

    return this.prisma.supplier.findMany({
      where: {
        isActive: true,
        OR: scope.branchId
          ? [{ branchId: scope.branchId }, { branchId: null }]
          : [{ branch: { tenantId: scope.tenantId } }, { branchId: null }],
      },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  async createSupplier(dto: CreateSupplierDto, user: AuthenticatedUser) {
    const scope = await this.resolveSingleActiveTenantScope(user, dto.branchId);
    const branchId = scope.branchId;
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId: scope.tenantId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException("Branch not found");
    }

    return this.prisma.supplier.create({
      data: {
        branchId: branchId ?? null,
        name: dto.name,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
      },
    });
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    user: AuthenticatedUser,
  ) {
    await this.assertSupplier(id, user);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSupplier(id: string, user: AuthenticatedUser) {
    await this.assertSupplier(id, user);

    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deleteSuppliersBulk(ids: string[], user: AuthenticatedUser) {
    const uniqueIds = [
      ...new Set(
        (ids ?? []).filter((id) => typeof id === "string" && id.trim()),
      ),
    ];
    if (!uniqueIds.length)
      throw new BadRequestException(
        "Kamida bitta yetkazib beruvchi tanlanishi kerak",
      );

    const scope = await this.resolveSingleActiveTenantScope(user);
    const where = {
      id: { in: uniqueIds },
      OR: scope.branchId
        ? [{ branchId: scope.branchId }, { branchId: null }]
        : [{ branch: { tenantId: scope.tenantId } }, { branchId: null }],
    };
    const suppliers = await this.prisma.supplier.findMany({
      where,
      select: { id: true, branchId: true },
    });
    if (suppliers.length !== uniqueIds.length) {
      throw new NotFoundException(
        "Tanlangan yetkazib beruvchilarning biri topilmadi",
      );
    }
    await this.prisma.supplier.deleteMany({ where });
    return { deleted: true, count: uniqueIds.length, ids: uniqueIds };
  }

  private async assertSupplier(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.resolveSingleActiveTenantScope(user);
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        OR: scope.branchId
          ? [{ branchId: scope.branchId }, { branchId: null }]
          : [{ branch: { tenantId: scope.tenantId } }, { branchId: null }],
      },
      select: { id: true, branchId: true },
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
  }

  private async resolveSingleActiveTenantScope(
    user: AuthenticatedUser,
    requestedBranchId?: string,
  ) {
    const scope = await resolveRestaurantScope(
      this.prisma,
      user,
      requestedBranchId,
    );
    const activeTenantId = await resolveSoleActiveTenantId(this.prisma);
    if (scope.tenantId !== activeTenantId) {
      throw new ForbiddenException(
        "Supplier scope must belong to the sole active tenant",
      );
    }
    return scope;
  }
}
