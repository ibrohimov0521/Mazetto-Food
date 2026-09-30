import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreatePlatformTenantBranchDto } from "./dto/create-platform-tenant-branch.dto";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class PlatformTenantBranchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: CreatePlatformTenantBranchDto,
    actor: AuthenticatedUser,
  ) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const address = dto.address?.trim() || null;
    const phone = dto.phone?.trim() || null;

    if (!/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/.test(code)) {
      throw new BadRequestException("Filial kodi 2-32 ta harf yoki raqamdan iborat bo'lsin.");
    }
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException("Filial nomi 2-120 ta belgidan iborat bo'lsin.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.restaurantTenant.findUnique({
          where: { id: tenantId },
          select: { id: true, status: true },
        });

        if (!tenant) {
          throw new NotFoundException("Restoran topilmadi.");
        }
        if (tenant.status !== "PROVISIONING") {
          throw new ConflictException(
            "Filialni faqat tayyorlanayotgan restoranga qo'shish mumkin.",
          );
        }

        const branch = await tx.branch.create({
          data: {
            tenantId: tenant.id,
            code,
            name,
            address,
            phone,
            isActive: false,
            acceptsOrders: false,
            deliveryEnabled: false,
            pickupEnabled: false,
          },
          select: {
            id: true,
            tenantId: true,
            code: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
          },
        });

        await writeAuditLog(tx, {
          tenantId: tenant.id,
          userId: actor.id,
          action: "PLATFORM_TENANT_BRANCH_CREATED",
          entity: "BRANCH",
          entityId: branch.id,
          metadata: {
            tenantId: tenant.id,
            branchId: branch.id,
            code: branch.code,
            name: branch.name,
          },
        });

        return branch;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Bu filial kodi allaqachon mavjud.");
      }
      throw error;
    }
  }
}
