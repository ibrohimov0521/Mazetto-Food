import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreateDeviceDto, UpdateDeviceDto } from "./dto/device.dto";

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
      const created = await tx.device.create({
        data: {
          branchId,
          name,
          type: dto.type,
          os: dto.os?.trim() || null,
          ipAddress: dto.ipAddress?.trim() || null,
          softwareVersion: dto.softwareVersion?.trim() || null,
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
      return created;
    });
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
