import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type {
  CreateDeviceDto,
  EnrollDeviceDto,
  UpdateDeviceDto,
} from "./dto/device.dto";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  listDevices(branchId: string | undefined, user: AuthenticatedUser) {
    const scopedBranchId = resolveBranchScope(user, branchId);

    return this.prisma.device.findMany({
      where: scopedBranchId ? { branchId: scopedBranchId } : {},
      include: {
        branch: { select: { id: true, code: true, name: true } },
        lastEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: [{ branchId: "asc" }, { name: "asc" }],
    });
  }

  async createDevice(dto: CreateDeviceDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
    const name = this.normalizeName(dto.name);
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const enrollmentCode = createEnrollmentCode();
      const created = await tx.device.create({
        data: {
          branchId,
          name,
          type: dto.type,
          os: dto.os?.trim() || null,
          ipAddress: dto.ipAddress?.trim() || null,
          softwareVersion: dto.softwareVersion?.trim() || null,
          enrollmentCodeHash: hashEnrollmentCode(enrollmentCode),
          enrollmentExpiresAt: enrollmentExpiry(),
        },
        include: { branch: true },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "DEVICE_CREATED",
        entity: "Device",
        entityId: created.id,
        metadata: { branchId, name, type: dto.type },
      });
      return { ...created, enrollmentCode };
    });
  }

  async rotateEnrollmentCode(id: string, user: AuthenticatedUser) {
    const device = await this.assertDevice(id, user);
    const enrollmentCode = createEnrollmentCode();
    const expiresAt = enrollmentExpiry();
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        enrollmentCodeHash: hashEnrollmentCode(enrollmentCode),
        enrollmentExpiresAt: expiresAt,
        enrolledAt: null,
      },
    });
    return { deviceId: device.id, enrollmentCode, expiresAt: expiresAt.toISOString() };
  }

  async enroll(dto: EnrollDeviceDto) {
    const deviceId = dto.deviceId.trim();
    if (!deviceId) {
      throw new BadRequestException("Device identity is required");
    }

    // The desktop creates its own stable hardware ID. The one-time code chooses
    // the admin-created slot and then binds that slot to this actual computer.
    const device = await this.prisma.device.findFirst({
      where: {
        isActive: true,
        enrollmentCodeHash: hashEnrollmentCode(dto.enrollmentCode),
        enrollmentExpiresAt: { gte: new Date() },
      },
    });

    if (!device) {
      throw new BadRequestException("Enrollment code is invalid or expired");
    }

    if (device.id !== deviceId) {
      const alreadyLinked = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { id: true },
      });
      if (alreadyLinked) {
        throw new BadRequestException(
          "This computer is already linked to another device",
        );
      }
    }

    const enrolledAt = new Date();
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        id: deviceId,
        enrolledAt,
        enrollmentCodeHash: null,
        enrollmentExpiresAt: null,
        lastSeenAt: enrolledAt,
        ...(dto.softwareVersion?.trim()
          ? { softwareVersion: dto.softwareVersion.trim().slice(0, 80) }
          : {}),
      },
      select: { id: true, branchId: true, name: true, type: true, enrolledAt: true },
    });
    return updated;
  }
  async updateDevice(
    id: string,
    dto: UpdateDeviceDto,
    user: AuthenticatedUser,
  ) {
    const previous = await this.assertDevice(id, user);
    const name =
      dto.name === undefined ? undefined : this.normalizeName(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.device.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.os !== undefined ? { os: dto.os.trim() || null } : {}),
          ...(dto.ipAddress !== undefined
            ? { ipAddress: dto.ipAddress.trim() || null }
            : {}),
          ...(dto.softwareVersion !== undefined
            ? { softwareVersion: dto.softwareVersion.trim() || null }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: { branch: true },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "DEVICE_UPDATED",
        entity: "Device",
        entityId: id,
        metadata: {
          branchId: previous.branchId,
          before: {
            name: previous.name,
            type: previous.type,
            isActive: previous.isActive,
          },
          changes: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.type === undefined ? {} : { type: dto.type }),
            ...(dto.os === undefined ? {} : { os: dto.os }),
            ...(dto.ipAddress === undefined
              ? {}
              : { ipAddress: dto.ipAddress }),
            ...(dto.softwareVersion === undefined
              ? {}
              : { softwareVersion: dto.softwareVersion }),
            ...(dto.isActive === undefined
              ? {}
              : { isActive: dto.isActive }),
          },
        },
      });
      return updated;
    });
  }

  async deleteDevice(id: string, user: AuthenticatedUser) {
    const device = await this.assertDevice(id, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.device.delete({ where: { id: device.id } });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "DEVICE_DELETED",
        entity: "Device",
        entityId: device.id,
        metadata: {
          branchId: device.branchId,
          name: device.name,
          type: device.type,
        },
      });
    });

    return { id: device.id };
  }

  async heartbeat(
    deviceId: string,
    softwareVersion: string | undefined,
    user: AuthenticatedUser,
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId.trim() },
      select: { id: true, branchId: true, isActive: true },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }

    resolveBranchScope(user, device.branchId);

    if (!device.isActive) {
      throw new BadRequestException("Device is disabled");
    }

    const lastSeenAt = new Date();
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt,
        ...(user.employeeId ? { lastEmployeeId: user.employeeId } : {}),
        ...(softwareVersion?.trim()
          ? { softwareVersion: softwareVersion.trim().slice(0, 80) }
          : {}),
      },
    });

    return {
      deviceId: device.id,
      branchId: device.branchId,
      lastSeenAt: lastSeenAt.toISOString(),
    };
  }

  private async assertDevice(
    id: string,
    user: AuthenticatedUser,
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
        name: true,
        type: true,
        isActive: true,
      },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }

    resolveBranchScope(user, device.branchId);
    return device;
  }

  private normalizeName(value: string): string {
    const name = value.trim();

    if (!name) {
      throw new BadRequestException("Device name is required");
    }

    return name;
  }
}

function createEnrollmentCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

function hashEnrollmentCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function enrollmentExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
}
