import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizeCustomerPhone } from "../customers/customer-phone";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import { KitchenGateway } from "../kitchen/kitchen.gateway";
import type {
  CreatePlatformTenantMembershipDto,
  UpdatePlatformTenantMembershipRolesDto,
} from "./dto/platform-tenant-membership.dto";

const membershipSelect = {
  id: true,
  tenantId: true,
  userId: true,
  branchId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      isActive: true,
    },
  },
  branch: { select: { id: true, code: true, name: true } },
  roles: {
    select: {
      role: {
        select: { id: true, code: true, name: true, isBranchScoped: true },
      },
    },
  },
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  try {
    return normalizeCustomerPhone(trimmed);
  } catch {
    return trimmed;
  }
}

@Injectable()
export class PlatformTenantMembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  async listAssignableRoles(tenantId: string) {
    const tenant = await this.prisma.restaurantTenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");

    const roles = await this.prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, isBranchScoped: true },
    });
    return roles.filter((role) => !role.code.startsWith("PLATFORM_"));
  }

  async list(tenantId: string) {
    const tenant = await this.prisma.restaurantTenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      select: membershipSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  async create(
    tenantId: string,
    dto: CreatePlatformTenantMembershipDto,
    actor: AuthenticatedUser,
  ) {
    const tenant = await this.prisma.restaurantTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
    if (!["PROVISIONING", "ACTIVE"].includes(tenant.status)) {
      throw new ConflictException(
        "To'xtatilgan yoki arxivlangan restoranga a'zo qo'shib bo'lmaydi.",
      );
    }

    const identifier = normalizeIdentifier(dto.identifier);
    const user = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ email: identifier }, { phone: identifier }],
      },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException("Faol foydalanuvchi hisobi topilmadi.");

    const roleCodes = [...new Set(dto.roleCodes)];
    if (roleCodes.length !== dto.roleCodes.length) {
      throw new BadRequestException("Bir xil rolni takroran yubormang.");
    }
    const roles = await this.loadRestaurantRoles(roleCodes);
    const branchId = dto.branchId?.trim() || null;
    await this.assertValidBranchRole(tenantId, user.id, branchId, roles);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentTenant = await tx.restaurantTenant.findUnique({
          where: { id: tenantId },
          select: { status: true },
        });
        if (
          !currentTenant ||
          !["PROVISIONING", "ACTIVE"].includes(currentTenant.status)
        ) {
          throw new ConflictException(
            "Restoran holati o'zgargan; a'zolik qo'shilmadi.",
          );
        }
        const currentUser = await tx.user.findFirst({
          where: { id: user.id, isActive: true },
          select: { id: true },
        });
        if (!currentUser)
          throw new NotFoundException("Faol foydalanuvchi hisobi topilmadi.");

        const membership = await tx.tenantMembership.create({
          data: {
            tenantId,
            userId: user.id,
            branchId,
            status: "ACTIVE",
            roles: {
              create: roles.map((role) => ({
                roleId: role.id,
                assignedById: actor.id,
              })),
            },
          },
          select: membershipSelect,
        });
        await writeAuditLog(tx, {
          tenantId: tenantId,
          userId: actor.id,
          action: "PLATFORM_TENANT_MEMBERSHIP_CREATED",
          entity: "TENANT_MEMBERSHIP",
          entityId: membership.id,
          metadata: { tenantId, userId: user.id, branchId, roleCodes },
        });
        return membership;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Bu foydalanuvchi restoranga allaqachon biriktirilgan.",
        );
      }
      throw error;
    }
  }

  async setStatus(
    tenantId: string,
    membershipId: string,
    status: "ACTIVE" | "SUSPENDED",
    actor: AuthenticatedUser,
  ) {
    let affectedUserId: string | undefined;
    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findFirst({
        where: { id: membershipId, tenantId },
        select: { id: true, status: true, userId: true },
      });
      if (!membership)
        throw new NotFoundException("Restoran a'zoligi topilmadi.");
      if (membership.status === status) return { id: membership.id, status };

      affectedUserId = membership.userId;
      const updated = await tx.tenantMembership.update({
        where: { id: membership.id },
        data: { status },
        select: { id: true, status: true },
      });
      await writeAuditLog(tx, {
        tenantId: tenantId,
        userId: actor.id,
        action:
          status === "SUSPENDED"
            ? "PLATFORM_TENANT_MEMBERSHIP_SUSPENDED"
            : "PLATFORM_TENANT_MEMBERSHIP_ACTIVATED",
        entity: "TENANT_MEMBERSHIP",
        entityId: membership.id,
        metadata: { tenantId, userId: membership.userId, status },
      });
      return updated;
    });
    if (affectedUserId) this.kitchenGateway.disconnectStaffUser(affectedUserId);
    return result;
  }

  async replaceRoles(
    tenantId: string,
    membershipId: string,
    dto: UpdatePlatformTenantMembershipRolesDto,
    actor: AuthenticatedUser,
  ) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId },
      select: { id: true, userId: true, branchId: true },
    });
    if (!membership)
      throw new NotFoundException("Restoran a'zoligi topilmadi.");

    const roleCodes = [...new Set(dto.roleCodes)];
    if (roleCodes.length !== dto.roleCodes.length) {
      throw new BadRequestException("Bir xil rolni takroran yubormang.");
    }
    const roles = await this.loadRestaurantRoles(roleCodes);
    const branchId = dto.branchId?.trim() || membership.branchId;
    await this.assertValidBranchRole(
      tenantId,
      membership.userId,
      branchId,
      roles,
    );

    const updatedMembership = await this.prisma.$transaction(async (tx) => {
      await tx.tenantMembershipRole.deleteMany({ where: { membershipId } });
      await tx.tenantMembershipRole.createMany({
        data: roles.map((role) => ({
          membershipId,
          roleId: role.id,
          assignedById: actor.id,
        })),
      });
      const updated = await tx.tenantMembership.update({
        where: { id: membershipId },
        data: { ...(dto.branchId ? { branchId } : {}) },
        select: membershipSelect,
      });
      await writeAuditLog(tx, {
        tenantId: tenantId,
        userId: actor.id,
        action: "PLATFORM_TENANT_MEMBERSHIP_ROLES_REPLACED",
        entity: "TENANT_MEMBERSHIP",
        entityId: membershipId,
        metadata: { tenantId, userId: membership.userId, branchId, roleCodes },
      });
      return updated;
    });
    this.kitchenGateway.disconnectStaffUser(membership.userId);
    return updatedMembership;
  }

  private async loadRestaurantRoles(roleCodes: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes }, isActive: true },
      select: { id: true, code: true, isBranchScoped: true },
    });
    if (
      roles.length !== roleCodes.length ||
      roles.some((role) => role.code.startsWith("PLATFORM_"))
    ) {
      throw new BadRequestException(
        "Faqat faol restoran rollarini tanlash mumkin.",
      );
    }
    return roles;
  }

  private async assertValidBranchRole(
    tenantId: string,
    userId: string,
    branchId: string | null,
    roles: { id: string; code: string; isBranchScoped: boolean }[],
  ) {
    const requiresBranch = roles.some((role) => role.isBranchScoped);
    if (requiresBranch && !branchId) {
      throw new BadRequestException(
        "Filialga biriktirilgan rol uchun filialni tanlang.",
      );
    }
    if (!branchId) return;

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch)
      throw new BadRequestException(
        "Tanlangan filial ushbu restoranga tegishli emas.",
      );

    if (requiresBranch) {
      const employee = await this.prisma.employee.findFirst({
        where: { userId, branchId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!employee) {
        throw new ConflictException(
          "Filial roli uchun avval foydalanuvchini shu filial xodimi sifatida yarating.",
        );
      }
    }
  }
}
