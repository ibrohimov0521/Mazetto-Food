import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreateRestaurantTenantDto } from "./dto/create-platform-tenant.dto";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class PlatformTenantLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRestaurantTenantDto, actor: AuthenticatedUser) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    if (!/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/.test(code)) {
      throw new BadRequestException("Restoran kodi 2-32 ta harf yoki raqamdan iborat bo'lsin.");
    }
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException("Restoran nomi 2-120 ta belgidan iborat bo'lsin.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.restaurantTenant.create({
          data: { code, name, status: "PROVISIONING" },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await writeAuditLog(tx, {
          tenantId: tenant.id,
          userId: actor.id,
          action: "PLATFORM_TENANT_CREATED",
          entity: "RESTAURANT_TENANT",
          entityId: tenant.id,
          metadata: {
            tenantId: tenant.id,
            code: tenant.code,
            name: tenant.name,
            status: tenant.status,
          },
        });

        return tenant;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Bu restoran kodi allaqachon mavjud.");
      }
      throw error;
    }
  }
}
