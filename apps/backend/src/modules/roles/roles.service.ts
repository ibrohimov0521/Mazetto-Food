import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserAuthCacheService } from "../../common/auth/user-auth-cache.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { writeAuditLog } from "../audit/audit-write";
import type {
  CreateRoleDto,
  UpdateRoleDto,
} from "./dto/role-management.dto";

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAuthCache: UserAuthCacheService,
  ) {}

  async listRoles() {
    return this.prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isBranchScoped: true,
        permissions: {
          select: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: {
            permission: {
              code: "asc",
            },
          },
        },
      },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });
  }

  async createRole(dto: CreateRoleDto, actor: AuthenticatedUser) {
    await this.assertAssignablePermissions(dto.permissionIds);
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          code: this.createCustomRoleCode(dto.name),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isSystem: false,
          isBranchScoped: dto.isBranchScoped,
        },
      });
      if (dto.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId: created.id,
            permissionId,
          })),
        });
      }
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "ROLE_CREATED",
        entity: "Role",
        entityId: created.id,
        metadata: {
          name: created.name,
          isBranchScoped: created.isBranchScoped,
          permissionIds: dto.permissionIds,
        },
      });
      return created;
    });

    return this.getRole(role.id);
  }

  async updateRole(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.findCustomRole(id);
    if (dto.permissionIds) {
      await this.assertAssignablePermissions(dto.permissionIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.description === undefined
            ? {}
            : { description: dto.description.trim() || null }),
          ...(dto.isBranchScoped === undefined
            ? {}
            : { isBranchScoped: dto.isBranchScoped }),
        },
      });
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (dto.permissionIds.length) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "ROLE_UPDATED",
        entity: "Role",
        entityId: id,
        metadata: {
          before: {
            name: role.name,
            description: role.description,
            isBranchScoped: role.isBranchScoped,
            permissionIds: role.permissions.map((item) => item.permissionId),
          },
          changes: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.description === undefined
              ? {}
              : { description: dto.description }),
            ...(dto.isBranchScoped === undefined
              ? {}
              : { isBranchScoped: dto.isBranchScoped }),
            ...(dto.permissionIds === undefined
              ? {}
              : { permissionIds: dto.permissionIds }),
          },
        },
      });
    });

    await Promise.all(
      role.users.map(({ userId }) => this.userAuthCache.invalidate(userId)),
    );
    return this.getRole(id);
  }

  async deleteRole(id: string, actor: AuthenticatedUser) {
    const role = await this.findCustomRole(id);
    if (role.users.length) {
      throw new BadRequestException(
        "Rolni arxivlashdan oldin uni barcha xodimlardan olib tashlang",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.role.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, isActive: true },
      });
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "ROLE_ARCHIVED",
        entity: "Role",
        entityId: id,
        metadata: { name: role.name },
      });
      return archived;
    });
  }

  async permanentlyDeleteRoles(ids: string[], actor: AuthenticatedUser) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) throw new BadRequestException("Role IDs are required");
    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, isSystem: true, users: { select: { userId: true } } },
    });
    if (roles.length !== uniqueIds.length) throw new NotFoundException("Role not found");
    if (roles.some((role) => role.isSystem)) throw new BadRequestException("Tizim rollarini o'chirib bo'lmaydi");
    const assigned = roles.find((role) => role.users.length);
    if (assigned) throw new BadRequestException(`Rol ${assigned.name} xodimga biriktirilgan; avval rolni olib tashlang`);
    await this.prisma.$transaction(async (tx) => {
      await tx.role.deleteMany({ where: { id: { in: uniqueIds } } });
      for (const id of uniqueIds) {
        await writeAuditLog(tx, { userId: actor.id, action: "ROLE_DELETED", entity: "Role", entityId: id });
      }
    });
    return { deletedCount: uniqueIds.length };
  }

  private async getRole(id: string) {
    return this.prisma.role.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isBranchScoped: true,
        permissions: {
          select: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });
  }

  private async findCustomRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        isBranchScoped: true,
        users: { select: { userId: true } },
        permissions: { select: { permissionId: true } },
      },
    });
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem) {
      throw new BadRequestException(
        "Tizim rolini o'zgartirib bo'lmaydi; maxsus rol yarating",
      );
    }
    return role;
  }

  private async assertAssignablePermissions(
    permissionIds: string[],
  ): Promise<void> {
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true, code: true },
    });
    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException("Noma'lum permission tanlangan");
    }
    if (permissions.some((permission) => permission.code === "*")) {
      throw new BadRequestException(
        "Barcha huquqlar jokeri faqat Super Admin tizim roliga tegishli",
      );
    }
  }

  private createCustomRoleCode(name: string): string {
    const slug = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `CUSTOM_${slug || "ROLE"}_${Date.now().toString(36).toUpperCase()}`;
  }
}
