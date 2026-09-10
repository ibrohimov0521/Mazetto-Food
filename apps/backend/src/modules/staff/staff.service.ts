import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EmployeeStatus, Prisma } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { randomInt } from "node:crypto";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { UserAuthCacheService } from "../../common/auth/user-auth-cache.service";
import { normalizeCustomerPhone } from "../customers/customer-phone";
import type {
  ChangeOwnPasswordDto,
  CreateStaffDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
  UpdateStaffRoleDto,
  UpdateStaffStatusDto,
} from "./dto/staff.dto";
import {
  branchScopedStaffRoles,
  type StaffRoleCode,
} from "./staff-role-codes";

type StaffRecord = Prisma.UserGetPayload<{
  select: typeof staffSelect;
}>;

type BootstrapOwnerInput = {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  activate: boolean;
  branchCodeOrId?: string;
};

type NormalizedStaffLogin = {
  email: string | null;
  phone: string | null;
};

const staffSelect = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      branchId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      status: true,
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
        },
      },
    },
  },
  roles: {
    select: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      },
    },
    orderBy: {
      role: {
        name: "asc",
      },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAuthCache: UserAuthCacheService,
  ) {}

  async listStaff(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);
    const staff = await this.prisma.user.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: this.staffSelect(),
    });

    return staff.map((record) => this.toStaffDto(record));
  }

  async getStaff(id: string, user: AuthenticatedUser) {
    const staff = await this.findStaffOrThrow(id);
    this.assertCanManageStaffRecord(user, staff);

    return this.toStaffDto(staff);
  }

  async createStaff(dto: CreateStaffDto, actor: AuthenticatedUser) {
    const normalized = this.normalizeLogin(dto.email, dto.phone);
    this.assertHasLogin(normalized);
    const roleCodes = this.resolveRequestedRoleCodes(dto);
    this.assertCanAssignRoles(actor, roleCodes);

    const branchId = await this.resolveBranchForRoles(actor, roleCodes, dto.branchId);
    const passwordHash = await hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      await this.assertUniqueLogin(tx, normalized);
      const roles = await this.findActiveRoles(tx, roleCodes);
      const created = await tx.user.create({
        data: {
          displayName: dto.name.trim(),
          email: normalized.email,
          phone: normalized.phone,
          passwordHash,
          isActive: dto.isActive,
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: created.id,
          roleId: role.id,
          assignedById: actor.id,
        })),
      });
      await this.syncEmployee(tx, created.id, branchId, dto.name, dto.isActive);
      await this.createAuditLog(tx, actor.id, "STAFF_CREATED", created.id, {
        roleCodes,
        branchId,
        isActive: dto.isActive,
      });

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: this.staffSelect(),
      });
    });

    return this.toStaffDto(user);
  }

  async updateStaff(id: string, dto: UpdateStaffDto, actor: AuthenticatedUser) {
    const existing = await this.findStaffOrThrow(id);
    this.assertCanManageStaffRecord(actor, existing);

    const normalized = this.normalizeLogin(dto.email, dto.phone);
    const nextEmail = dto.email !== undefined ? normalized.email : existing.email;
    const nextPhone = dto.phone !== undefined ? normalized.phone : existing.phone;

    this.assertHasLogin({ email: nextEmail, phone: nextPhone });

    const currentRoleCodes = this.roleCodesFromStaff(existing);
    const nextBranchId =
      dto.branchId === undefined
        ? existing.employee?.branchId ?? null
        : await this.resolveBranchForRoles(actor, currentRoleCodes, dto.branchId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertUniqueLogin(tx, { email: nextEmail, phone: nextPhone }, id);

      await tx.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { displayName: dto.name.trim() } : {}),
          ...(dto.email !== undefined ? { email: nextEmail } : {}),
          ...(dto.phone !== undefined ? { phone: nextPhone } : {}),
        },
      });

      if (dto.name !== undefined || dto.branchId !== undefined) {
        await this.syncEmployee(
          tx,
          id,
          nextBranchId,
          dto.name ?? existing.displayName ?? nextEmail ?? nextPhone ?? "Staff",
          existing.isActive,
        );
      }

      await this.createAuditLog(tx, actor.id, "STAFF_UPDATED", id, {
        branchId: nextBranchId,
        emailChanged: dto.email !== undefined,
        phoneChanged: dto.phone !== undefined,
        nameChanged: dto.name !== undefined,
      });

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: this.staffSelect(),
      });
    });


    /*
     * Ruxsat keshini darhol bekor qilamiz (PHASE 6 H8).
     *
     * Bo'lmasa o'zgarish 30 soniyagacha kechikardi. Bu XAVFSIZLIK sharti
     * emas — TTL baribir eskirtiradi — lekin bloklangan xodim yarim
     * daqiqa ishlashda davom etishi operatsion jihatdan yomon.
     */
    await this.userAuthCache.invalidate(id);
    return this.toStaffDto(updated);
  }

  async updateRole(id: string, dto: UpdateStaffRoleDto, actor: AuthenticatedUser) {
    const existing = await this.findStaffOrThrow(id);
    this.assertCanManageStaffRecord(actor, existing);
    const roleCodes = this.resolveRequestedRoleCodes(dto);
    this.assertCanAssignRoles(actor, roleCodes);
    await this.assertCanRemoveCurrentSuperAdmin(existing, !roleCodes.includes("SUPER_ADMIN"));

    const branchId = await this.resolveBranchForRoles(
      actor,
      roleCodes,
      dto.branchId ?? existing.employee?.branchId ?? null,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const roles = await this.findActiveRoles(tx, roleCodes);

      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: id,
          roleId: role.id,
          assignedById: actor.id,
        })),
      });
      await this.syncEmployee(
        tx,
        id,
        branchId,
        existing.displayName ?? existing.email ?? existing.phone ?? "Staff",
        existing.isActive,
      );
      await this.revokeUserSessions(tx, id);
      await this.createAuditLog(tx, actor.id, "STAFF_ROLE_CHANGED", id, {
        roleCodes,
        branchId,
      });

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: this.staffSelect(),
      });
    });


    // Rol va holat o'zgarishi eng muhim ikki holat: bloklangan yoki roli
    // tushirilgan xodim kesh eskirguncha ishlashda davom etardi.
    await this.userAuthCache.invalidate(id);
    return this.toStaffDto(updated);
  }

  async updateStatus(id: string, dto: UpdateStaffStatusDto, actor: AuthenticatedUser) {
    const existing = await this.findStaffOrThrow(id);
    this.assertCanManageStaffRecord(actor, existing);

    if (!dto.isActive) {
      await this.assertCanRemoveCurrentSuperAdmin(existing, true);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { isActive: dto.isActive },
      });

      if (existing.employee) {
        await tx.employee.update({
          where: { id: existing.employee.id },
          data: {
            status: dto.isActive ? EmployeeStatus.ACTIVE : EmployeeStatus.SUSPENDED,
            terminatedAt: dto.isActive ? null : new Date(),
          },
        });
      }

      if (!dto.isActive) {
        await this.revokeUserSessions(tx, id);
      }

      await this.createAuditLog(tx, actor.id, dto.isActive ? "STAFF_ACTIVATED" : "STAFF_BLOCKED", id, {
        isActive: dto.isActive,
      });

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: this.staffSelect(),
      });
    });


    // Rol va holat o'zgarishi eng muhim ikki holat: bloklangan yoki roli
    // tushirilgan xodim kesh eskirguncha ishlashda davom etardi.
    await this.userAuthCache.invalidate(id);
    return this.toStaffDto(updated);
  }

  async resetPassword(id: string, dto: ResetStaffPasswordDto, actor: AuthenticatedUser) {
    const existing = await this.findStaffOrThrow(id);
    this.assertCanManageStaffRecord(actor, existing);

    if (this.hasRole(existing, "SUPER_ADMIN") && !actor.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Only SUPER_ADMIN can reset a SUPER_ADMIN password");
    }

    const passwordHash = await hash(dto.newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash },
      });
      await this.revokeUserSessions(tx, id);
      await this.createAuditLog(tx, actor.id, "STAFF_PASSWORD_RESET", id, {});
    });


    /*
     * Ruxsat keshini darhol bekor qilamiz (PHASE 6 H8).
     *
     * Bo'lmasa o'zgarish 30 soniyagacha kechikardi. Bu XAVFSIZLIK sharti
     * emas — TTL baribir eskirtiradi — lekin bloklangan xodim yarim
     * daqiqa ishlashda davom etishi operatsion jihatdan yomon.
     */
    await this.userAuthCache.invalidate(id);
    return { changed: true };
  }

  async changeOwnPassword(dto: ChangeOwnPasswordDto, user: AuthenticatedUser) {
    if (dto.newPassword !== dto.confirmation) {
      throw new BadRequestException("Password confirmation does not match");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!existing?.isActive || !existing.passwordHash) {
      throw new UnauthorizedException("User is not active");
    }

    const currentMatches = await compare(dto.currentPassword, existing.passwordHash);

    if (!currentMatches) {
      throw new UnauthorizedException("Current password is invalid");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(dto.newPassword, 12) },
      });
      await this.revokeUserSessions(tx, user.id);
      await this.createAuditLog(tx, user.id, "STAFF_OWN_PASSWORD_CHANGED", user.id, {});
    });


    /*
     * Ruxsat keshini darhol bekor qilamiz (PHASE 6 H8).
     *
     * Bo'lmasa o'zgarish 30 soniyagacha kechikardi. Bu XAVFSIZLIK sharti
     * emas — TTL baribir eskirtiradi — lekin bloklangan xodim yarim
     * daqiqa ishlashda davom etishi operatsion jihatdan yomon.
     */
    await this.userAuthCache.invalidate(user.id);
    return { changed: true };
  }

  async bootstrapSuperAdmin(input: BootstrapOwnerInput) {
    const normalized = this.normalizeLogin(input.email, input.phone);
    this.assertHasLogin(normalized);
    const passwordHash = await hash(input.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const role = await this.findActiveRole(tx, "SUPER_ADMIN");
      const branchId = input.branchCodeOrId
        ? await this.resolveBootstrapBranch(tx, input.branchCodeOrId)
        : null;
      const existing = await tx.user.findFirst({
        where: {
          OR: this.loginWhere(normalized),
        },
        select: this.staffSelect(),
      });

      if (existing) {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            displayName: input.name.trim(),
            ...(normalized.email ? { email: normalized.email } : {}),
            ...(normalized.phone ? { phone: normalized.phone } : {}),
            passwordHash,
            ...(input.activate ? { isActive: true } : {}),
          },
        });
        await tx.userRole.deleteMany({ where: { userId: existing.id } });
        await tx.userRole.create({
          data: {
            userId: existing.id,
            roleId: role.id,
          },
        });
        await this.syncEmployee(
          tx,
          existing.id,
          branchId,
          input.name,
          input.activate ? true : existing.isActive,
        );
        await this.revokeUserSessions(tx, existing.id);
        await this.createAuditLog(tx, existing.id, "STAFF_BOOTSTRAP_SUPER_ADMIN_RESET", existing.id, {
          branchId,
          activated: input.activate,
        });

        return tx.user.findUniqueOrThrow({
          where: { id: existing.id },
          select: this.staffSelect(),
        });
      }

      await this.assertUniqueLogin(tx, normalized);
      const created = await tx.user.create({
        data: {
          displayName: input.name.trim(),
          email: normalized.email,
          phone: normalized.phone,
          passwordHash,
          isActive: true,
        },
      });
      await tx.userRole.create({
        data: {
          userId: created.id,
          roleId: role.id,
        },
      });
      await this.syncEmployee(tx, created.id, branchId, input.name, true);
      await this.createAuditLog(tx, created.id, "STAFF_BOOTSTRAP_SUPER_ADMIN_CREATED", created.id, {
        branchId,
      });

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: this.staffSelect(),
      });
    });

    return this.toStaffDto(user);
  }

  private staffSelect() {
    return staffSelect;
  }

  private toStaffDto(staff: StaffRecord) {
    return {
      id: staff.id,
      email: staff.email,
      phone: staff.phone,
      displayName: staff.displayName,
      avatarUrl: staff.avatarUrl,
      isActive: staff.isActive,
      lastLoginAt: staff.lastLoginAt,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
      employee: staff.employee,
      roles: staff.roles.map((userRole) => userRole.role),
    };
  }

  private async findStaffOrThrow(id: string): Promise<StaffRecord> {
    const staff = await this.prisma.user.findUnique({
      where: { id },
      select: this.staffSelect(),
    });

    if (!staff) {
      throw new NotFoundException("Staff user not found");
    }

    return staff;
  }

  private normalizeLogin(email?: string | null, phone?: string | null): NormalizedStaffLogin {
    const normalizedEmail = email === undefined ? null : this.normalizeEmail(email);
    const normalizedPhone = phone === undefined ? null : this.normalizePhone(phone);

    return {
      email: normalizedEmail,
      phone: normalizedPhone,
    };
  }

  private normalizeEmail(email?: string | null): string | null {
    const value = email?.trim().toLowerCase();
    return value ? value : null;
  }

  private normalizePhone(phone?: string | null): string | null {
    const value = phone?.trim();
    return value ? normalizeCustomerPhone(value) : null;
  }

  private assertHasLogin(login: NormalizedStaffLogin): void {
    if (!login.email && !login.phone) {
      throw new BadRequestException("Email or phone is required");
    }
  }

  private async assertUniqueLogin(
    tx: Prisma.TransactionClient,
    login: NormalizedStaffLogin,
    exceptUserId?: string,
  ): Promise<void> {
    const where = this.loginWhere(login);

    if (where.length === 0) {
      return;
    }

    const duplicate = await tx.user.findFirst({
      where: {
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
        OR: where,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException("Email or phone is already used by another staff account");
    }
  }

  private loginWhere(login: NormalizedStaffLogin) {
    return [
      ...(login.email ? [{ email: login.email }] : []),
      ...(login.phone ? [{ phone: login.phone }] : []),
    ];
  }

  private async findActiveRole(tx: Prisma.TransactionClient, code: StaffRoleCode) {
    const roles = await this.findActiveRoles(tx, [code]);
    const role = roles[0];

    if (!role) {
      throw new NotFoundException(`Role ${code} is not available`);
    }

    return role;
  }

  private async findActiveRoles(tx: Prisma.TransactionClient, codes: StaffRoleCode[]) {
    const roles = await tx.role.findMany({
      where: { code: { in: codes }, isActive: true },
      select: { id: true, code: true },
    });

    const found = new Set(roles.map((role) => role.code));
    const missing = codes.filter((code) => !found.has(code));

    if (missing.length) {
      throw new NotFoundException(`Role ${missing.join(", ")} is not available`);
    }

    return codes.map((code) => roles.find((role) => role.code === code)!);
  }

  private assertCanAssignRole(actor: AuthenticatedUser, roleCode: StaffRoleCode): void {
    this.assertCanAssignRoles(actor, [roleCode]);
  }

  private assertCanAssignRoles(actor: AuthenticatedUser, roleCodes: StaffRoleCode[]): void {
    if (roleCodes.includes("SUPER_ADMIN") && !actor.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Only SUPER_ADMIN can assign SUPER_ADMIN");
    }

    const hasGlobalRole = roleCodes.some((roleCode) => !branchScopedStaffRoles.has(roleCode));

    if (!actor.roles.includes("SUPER_ADMIN") && hasGlobalRole) {
      throw new ForbiddenException("Only SUPER_ADMIN can assign global staff roles");
    }
  }

  private async resolveBranchForRole(
    actor: AuthenticatedUser,
    roleCode: StaffRoleCode,
    requestedBranchId?: string | null,
  ): Promise<string | null> {
    return this.resolveBranchForRoles(actor, [roleCode], requestedBranchId);
  }

  private async resolveBranchForRoles(
    actor: AuthenticatedUser,
    roleCodes: StaffRoleCode[],
    requestedBranchId?: string | null,
  ): Promise<string | null> {
    const branchId = requestedBranchId?.trim() || null;

    if (roleCodes.some((roleCode) => branchScopedStaffRoles.has(roleCode))) {
      const resolvedBranchId = resolveBranchScope(actor, branchId ?? undefined);

      if (!resolvedBranchId) {
        throw new BadRequestException("Branch-scoped staff roles require an assigned branch");
      }

      await this.assertBranchExists(resolvedBranchId);
      return resolvedBranchId;
    }

    if (!branchId) {
      return null;
    }

    resolveBranchScope(actor, branchId);
    await this.assertBranchExists(branchId);
    return branchId;
  }

  private async resolveBootstrapBranch(tx: Prisma.TransactionClient, branchCodeOrId: string): Promise<string> {
    const branch = await tx.branch.findFirst({
      where: {
        OR: [{ id: branchCodeOrId }, { code: branchCodeOrId.trim().toUpperCase() }],
      },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException("Bootstrap branch was not found");
    }

    return branch.id;
  }

  private async assertBranchExists(branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private assertCanManageStaffRecord(actor: AuthenticatedUser, staff: StaffRecord): void {
    if (actor.roles.includes("SUPER_ADMIN")) {
      return;
    }

    if (this.hasRole(staff, "SUPER_ADMIN")) {
      throw new ForbiddenException("Only SUPER_ADMIN can manage SUPER_ADMIN accounts");
    }

    if (!staff.employee?.branchId) {
      throw new ForbiddenException("Cannot manage global staff from a branch-scoped account");
    }

    resolveBranchScope(actor, staff.employee.branchId);
  }

  private async assertCanRemoveCurrentSuperAdmin(
    staff: StaffRecord,
    wouldRemoveActiveSuperAdmin: boolean,
  ): Promise<void> {
    if (!wouldRemoveActiveSuperAdmin || !staff.isActive || !this.hasRole(staff, "SUPER_ADMIN")) {
      return;
    }

    const activeSuperAdmins = await this.prisma.user.count({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              code: "SUPER_ADMIN",
              isActive: true,
            },
          },
        },
      },
    });

    if (activeSuperAdmins <= 1) {
      throw new BadRequestException("At least one active SUPER_ADMIN account must remain");
    }
  }

  private hasRole(staff: StaffRecord, roleCode: StaffRoleCode): boolean {
    return staff.roles.some((userRole) => userRole.role.code === roleCode);
  }

  private primaryRoleCode(staff: StaffRecord): StaffRoleCode {
    const roleCode = this.roleCodesFromStaff(staff)[0];

    if (!roleCode || !this.isStaffRoleCode(roleCode)) {
      throw new BadRequestException("Staff user does not have a manageable role");
    }

    return roleCode;
  }

  private roleCodesFromStaff(staff: StaffRecord): StaffRoleCode[] {
    return staff.roles
      .map((userRole) => userRole.role.code)
      .filter((roleCode): roleCode is StaffRoleCode => this.isStaffRoleCode(roleCode));
  }

  private resolveRequestedRoleCodes(dto: { roleCode?: StaffRoleCode; roleCodes?: StaffRoleCode[] }): StaffRoleCode[] {
    const requested = dto.roleCodes?.length ? dto.roleCodes : dto.roleCode ? [dto.roleCode] : [];
    const unique = [...new Set(requested)];

    if (!unique.length) {
      throw new BadRequestException("At least one staff role is required");
    }

    return unique;
  }

  private isStaffRoleCode(value: string): value is StaffRoleCode {
    return [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "CASHIER",
      "WAITER",
      "KITCHEN",
      "ACCOUNTANT",
    ].includes(value);
  }

  private async syncEmployee(
    tx: Prisma.TransactionClient,
    userId: string,
    branchId: string | null,
    displayName: string,
    isActive: boolean,
  ): Promise<void> {
    const existing = await tx.employee.findUnique({
      where: { userId },
      select: { id: true, employeeCode: true },
    });

    if (!branchId) {
      if (existing) {
        await tx.employee.update({
          where: { id: existing.id },
          data: {
            userId: null,
            status: EmployeeStatus.INACTIVE,
            terminatedAt: new Date(),
          },
        });
      }

      return;
    }

    const name = this.splitDisplayName(displayName);

    if (existing) {
      await tx.employee.update({
        where: { id: existing.id },
        data: {
          branchId,
          firstName: name.firstName,
          lastName: name.lastName,
          status: isActive ? EmployeeStatus.ACTIVE : EmployeeStatus.SUSPENDED,
          terminatedAt: isActive ? null : new Date(),
        },
      });
      return;
    }

    await tx.employee.create({
      data: {
        branchId,
        userId,
        employeeCode: this.createEmployeeCode(),
        firstName: name.firstName,
        lastName: name.lastName,
        status: isActive ? EmployeeStatus.ACTIVE : EmployeeStatus.SUSPENDED,
        hiredAt: new Date(),
        terminatedAt: isActive ? null : new Date(),
      },
    });
  }

  private splitDisplayName(displayName: string) {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] ?? "Staff",
      lastName: parts.slice(1).join(" ") || null,
    };
  }

  private createEmployeeCode(): string {
    return `STF-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 10000)}`;
  }

  private revokeUserSessions(tx: Prisma.TransactionClient, userId: string) {
    return tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private createAuditLog(
    tx: Prisma.TransactionClient,
    userId: string | null,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        userId,
        action,
        entity: "User",
        entityId,
        metadata,
      },
    });
  }
}
