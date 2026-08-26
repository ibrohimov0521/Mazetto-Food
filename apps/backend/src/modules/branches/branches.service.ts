import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BranchDayOfWeek, Prisma } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  BranchWorkingHourDto,
  CreateBranchDto,
  SetProductBranchAvailabilityDto,
  UpdateBranchDto,
} from "./dto/branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);

    const branches = await this.prisma.branch.findMany({
      where: branchId ? { id: branchId } : {},
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        _count: {
          select: {
            employees: true,
            printers: true,
            devices: true,
            products: true,
          },
        },
      },
    });

    return branches.map((branch) => this.toAdminBranch(branch));
  }

  async getBranch(id: string, user: AuthenticatedUser) {
    resolveBranchScope(user, id);

    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        _count: {
          select: {
            employees: true,
            printers: true,
            devices: true,
            products: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return this.toAdminBranch(branch);
  }

  createBranch(dto: CreateBranchDto, user: AuthenticatedUser) {
    this.assertGlobalBranchManagement(user);

    return this.prisma.branch.create({
      data: this.branchCreateData(dto),
      include: { workingHours: true },
    });
  }

  async updateBranch(
    id: string,
    dto: UpdateBranchDto,
    user: AuthenticatedUser,
  ) {
    resolveBranchScope(user, id);
    await this.assertBranch(id);

    return this.prisma.branch.update({
      where: { id },
      data: this.branchUpdateData(dto),
      include: { workingHours: { orderBy: { dayOfWeek: "asc" } } },
    });
  }

  async setWorkingHours(
    id: string,
    hours: BranchWorkingHourDto[],
    user: AuthenticatedUser,
  ) {
    resolveBranchScope(user, id);
    await this.assertBranch(id);

    return this.prisma.$transaction(async (tx) => {
      for (const hour of hours) {
        this.assertWorkingHour(hour);
        const opensAt = hour.isClosed ? null : hour.opensAt ?? null;
        const closesAt = hour.isClosed ? null : hour.closesAt ?? null;

        await tx.branchWorkingHour.upsert({
          where: {
            branchId_dayOfWeek: {
              branchId: id,
              dayOfWeek: hour.dayOfWeek,
            },
          },
          update: {
            opensAt,
            closesAt,
            isClosed: hour.isClosed,
          },
          create: {
            branchId: id,
            dayOfWeek: hour.dayOfWeek,
            opensAt,
            closesAt,
            isClosed: hour.isClosed,
          },
        });
      }

      const branch = await tx.branch.findUniqueOrThrow({
        where: { id },
        include: { workingHours: { orderBy: { dayOfWeek: "asc" } } },
      });

      return this.toAdminBranch(branch);
    });
  }

  async setProductAvailability(
    id: string,
    dto: SetProductBranchAvailabilityDto,
    user: AuthenticatedUser,
  ) {
    resolveBranchScope(user, id);
    await this.assertBranch(id);
    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        OR: [{ branchId: id }, { branchId: null }],
      },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException("Product not found for this branch");
    }

    return this.prisma.productBranchAvailability.upsert({
      where: {
        branchId_productId: {
          branchId: id,
          productId: dto.productId,
        },
      },
      update: {
        status: dto.status,
        reason: dto.reason ?? null,
      },
      create: {
        branchId: id,
        productId: dto.productId,
        status: dto.status,
        reason: dto.reason ?? null,
      },
    });
  }

  async listCustomerBranches() {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { workingHours: { orderBy: { dayOfWeek: "asc" } } },
    });

    return branches.map((branch) => this.toCustomerBranch(branch));
  }

  async assertCustomerBranchAcceptsOrder(
    branchId: string,
    type: "DELIVERY" | "PICKUP",
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
      include: { workingHours: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const customerBranch = this.toCustomerBranch(branch);

    if (!customerBranch.acceptsOrders || !customerBranch.isOpen) {
      throw new BadRequestException("Branch is not accepting orders now");
    }

    if (type === "DELIVERY" && !customerBranch.deliveryEnabled) {
      throw new BadRequestException("Delivery is not available for this branch");
    }

    if (type === "PICKUP" && !customerBranch.pickupEnabled) {
      throw new BadRequestException("Pickup is not available for this branch");
    }

    return customerBranch;
  }

  getUnavailableProductWhere(branchId?: string): Prisma.ProductWhereInput {
    if (!branchId) {
      return {};
    }

    return {
      NOT: {
        branchAvailabilities: {
          some: {
            branchId,
            status: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
          },
        },
      },
    };
  }

  private branchCreateData(dto: CreateBranchDto): Prisma.BranchCreateInput {
    return {
      code: this.normalizeCode(dto.code ?? dto.name),
      name: dto.name,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      latitude: dto.latitude === undefined ? null : new Prisma.Decimal(dto.latitude),
      longitude:
        dto.longitude === undefined ? null : new Prisma.Decimal(dto.longitude),
      timezone: dto.timezone ?? "Asia/Tashkent",
      isActive: dto.isActive,
      isTemporarilyClosed: dto.isTemporarilyClosed,
      acceptsOrders: dto.acceptsOrders,
      deliveryEnabled: dto.deliveryEnabled,
      pickupEnabled: dto.pickupEnabled,
      sortOrder: dto.sortOrder,
    };
  }

  private branchUpdateData(dto: UpdateBranchDto): Prisma.BranchUpdateInput {
    return {
      ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.latitude !== undefined
        ? { latitude: new Prisma.Decimal(dto.latitude) }
        : {}),
      ...(dto.longitude !== undefined
        ? { longitude: new Prisma.Decimal(dto.longitude) }
        : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.isTemporarilyClosed !== undefined
        ? { isTemporarilyClosed: dto.isTemporarilyClosed }
        : {}),
      ...(dto.acceptsOrders !== undefined
        ? { acceptsOrders: dto.acceptsOrders }
        : {}),
      ...(dto.deliveryEnabled !== undefined
        ? { deliveryEnabled: dto.deliveryEnabled }
        : {}),
      ...(dto.pickupEnabled !== undefined ? { pickupEnabled: dto.pickupEnabled } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
  }

  private toAdminBranch<T extends BranchWithHours>(branch: T) {
    return {
      ...branch,
      coordinates: this.coordinates(branch),
      isOpen: this.isBranchOpen(branch),
    };
  }

  private toCustomerBranch<T extends BranchWithHours>(branch: T) {
    const isOpen = this.isBranchOpen(branch);

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      coordinates: this.coordinates(branch),
      isOpen,
      acceptsOrders:
        branch.isActive &&
        branch.acceptsOrders &&
        !branch.isTemporarilyClosed &&
        isOpen,
      deliveryEnabled: branch.deliveryEnabled,
      pickupEnabled: branch.pickupEnabled,
      temporarilyClosed: branch.isTemporarilyClosed,
      workingHours: branch.workingHours.map((hour) => ({
        dayOfWeek: hour.dayOfWeek,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        isClosed: hour.isClosed,
      })),
    };
  }

  private coordinates(branch: BranchWithHours) {
    if (branch.latitude === null || branch.longitude === null) {
      return null;
    }

    return {
      latitude: Number(branch.latitude),
      longitude: Number(branch.longitude),
    };
  }

  private isBranchOpen(branch: BranchWithHours): boolean {
    if (!branch.isActive || branch.isTemporarilyClosed) {
      return false;
    }

    if (branch.workingHours.length === 0) {
      return true;
    }

    const now = new Date();
    const zoned = new Intl.DateTimeFormat("en-US", {
      timeZone: branch.timezone,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
    const weekday = zoned.find((part) => part.type === "weekday")?.value;
    const hour = zoned.find((part) => part.type === "hour")?.value ?? "00";
    const minute = zoned.find((part) => part.type === "minute")?.value ?? "00";
    const day = this.dayFromWeekday(weekday);
    const currentMinutes = this.minutes(`${hour}:${minute}`);
    const schedule = branch.workingHours.find((item) => item.dayOfWeek === day);

    if (!schedule) {
      return true;
    }

    if (schedule.isClosed) {
      return false;
    }

    if (!schedule.opensAt || !schedule.closesAt) {
      return true;
    }

    const opens = this.minutes(schedule.opensAt);
    const closes = this.minutes(schedule.closesAt);

    if (opens <= closes) {
      return currentMinutes >= opens && currentMinutes <= closes;
    }

    return currentMinutes >= opens || currentMinutes <= closes;
  }

  private dayFromWeekday(weekday?: string): BranchDayOfWeek {
    switch (weekday) {
      case "Mon":
        return BranchDayOfWeek.MONDAY;
      case "Tue":
        return BranchDayOfWeek.TUESDAY;
      case "Wed":
        return BranchDayOfWeek.WEDNESDAY;
      case "Thu":
        return BranchDayOfWeek.THURSDAY;
      case "Fri":
        return BranchDayOfWeek.FRIDAY;
      case "Sat":
        return BranchDayOfWeek.SATURDAY;
      case "Sun":
      default:
        return BranchDayOfWeek.SUNDAY;
    }
  }

  private minutes(value: string): number {
    const [hour = 0, minute = 0] = value.split(":").map(Number);
    return hour * 60 + minute;
  }

  private assertWorkingHour(hour: BranchWorkingHourDto): void {
    if (!hour.isClosed && (!hour.opensAt || !hour.closesAt)) {
      throw new BadRequestException("Opening and closing time are required");
    }
  }

  private async assertBranch(id: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private assertGlobalBranchManagement(user: AuthenticatedUser): void {
    if (!user.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Only global admins can create branches");
    }
  }

  private normalizeCode(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}

type BranchWithHours = Prisma.BranchGetPayload<{
  include: { workingHours: true };
}>;
