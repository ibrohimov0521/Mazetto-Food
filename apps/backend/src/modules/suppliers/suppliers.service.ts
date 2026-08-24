import { Injectable, NotFoundException } from "@nestjs/common";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(branchId: string | undefined, user: AuthenticatedUser) {
    const scopedBranchId = resolveBranchScope(user, branchId);

    return this.prisma.supplier.findMany({
      where: {
        isActive: true,
        ...(scopedBranchId ? { OR: [{ branchId: scopedBranchId }, { branchId: null }] } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async createSupplier(dto: CreateSupplierDto, user: AuthenticatedUser) {
    const branchId = dto.branchId ? resolveBranchScope(user, dto.branchId) : resolveBranchScope(user);

    return this.prisma.supplier.create({
      data: {
        branchId: branchId ?? null,
        name: dto.name,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, user: AuthenticatedUser) {
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

  private async assertSupplier(id: string, user: AuthenticatedUser): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id }, select: { id: true, branchId: true } });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    if (supplier.branchId) {
      resolveBranchScope(user, supplier.branchId);
    }
  }
}
