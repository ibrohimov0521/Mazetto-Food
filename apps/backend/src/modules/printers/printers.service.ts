import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveRequiredBranchScope } from "../../common/auth/access-scope";
import {
  assertBranchBelongsToActor,
  resolveRestaurantScope,
} from "../../common/auth/tenant-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreatePrinterDto, UpdatePrinterDto } from "./dto/printer.dto";
import { lockPrinterPrintQueue } from "../receipts/receipt-writer";

@Injectable()
export class PrintersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPrinters(branchId: string | undefined, user: AuthenticatedUser) {
    const scope = await resolveRestaurantScope(this.prisma, user, branchId);
    return this.prisma.printer.findMany({
      where: scope.branchId
        ? { branchId: scope.branchId }
        : { branch: { tenantId: scope.tenantId } },
      include: { branch: true },
      orderBy: [{ branchId: "asc" }, { name: "asc" }],
    });
  }

  async createPrinter(dto: CreatePrinterDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
    await assertBranchBelongsToActor(this.prisma, user, branchId);
    const metadata = dto.metadata ?? {};
    const printRoles = Array.isArray(metadata.printRoles)
      ? metadata.printRoles
      : dto.type === "THERMAL" || dto.type === "RECEIPT"
        ? ["RECEIPT", "CANCELLATION"]
        : [];
    return this.prisma.printer.create({
      data: {
        branchId,
        name: dto.name,
        type: dto.type,
        status: dto.status ?? "ONLINE",
        metadata: {
          protocol: "ESC_POS",
          ...metadata,
          printRoles,
        } as Prisma.InputJsonObject,
      },
      include: { branch: true },
    });
  }

  async updatePrinter(
    id: string,
    dto: UpdatePrinterDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.assertPrinter(id, user);
    const { metadata, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      await lockPrinterPrintQueue(tx, id);
      const current = await tx.printer.findFirst({
        where: {
          id,
          branchId: existing.branchId,
          branch: { tenantId: existing.tenantId },
        },
        select: { id: true, metadata: true },
      });
      if (!current) throw new NotFoundException("Printer not found");
      if (dto.type !== undefined || metadata !== undefined) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "print_jobs" WHERE "printerId" = ${id} FOR UPDATE
        `;
        const unresolvedJobs = await tx.printJob.findMany({
          where: {
            printerId: id,
            status: { notIn: ["PRINTED", "CANCELLED"] },
          },
          select: { id: true },
          take: 1,
        });
        if (unresolvedJobs.length > 0) {
          throw new ConflictException(
            "Printer turi yoki yo'naltirish sozlamalarini tugallanmagan chop ishlari bor paytda o'zgartirib bo'lmaydi. Avval chopni yakunlang yoki ishlarni bekor qiling.",
          );
        }
      }
      return tx.printer.update({
        where: {
          id,
          branchId: existing.branchId,
          branch: { tenantId: existing.tenantId },
        },
        data: {
          ...data,
          ...(metadata
            ? {
                metadata: {
                  ...(typeof current.metadata === "object" &&
                  current.metadata &&
                  !Array.isArray(current.metadata)
                    ? current.metadata
                    : {}),
                  ...metadata,
                } as Prisma.InputJsonObject,
              }
            : {}),
        },
        include: { branch: true },
      });
    });
  }

  async deactivatePrinter(id: string, user: AuthenticatedUser) {
    const existing = await this.assertPrinter(id, user);
    return this.prisma.$transaction(async (tx) => {
      await lockPrinterPrintQueue(tx, id);
      const printer = await tx.printer.update({
        where: {
          id,
          branchId: existing.branchId,
          branch: { tenantId: existing.tenantId },
        },
        data: { isActive: false, status: "OFFLINE" },
        include: { branch: true },
      });
      await writeAuditLog(tx, {
        tenantId: existing.tenantId,
        userId: user.id,
        action: "PRINTER_DEACTIVATED",
        entity: "Printer",
        entityId: id,
        metadata: { branchId: existing.branchId, name: existing.name },
      });
      return printer;
    });
  }

  async deletePrinters(ids: string[], user: AuthenticatedUser) {
    const uniqueIds = [
      ...new Set(
        (ids ?? []).filter((id) => typeof id === "string" && id.trim()),
      ),
    ];
    if (!uniqueIds.length)
      throw new NotFoundException("Kamida bitta printer tanlanishi kerak");
    const printers = await Promise.all(
      uniqueIds.map(async (id) => ({
        id,
        ...(await this.assertPrinter(id, user)),
      })),
    );
    await this.prisma.$transaction(async (tx) => {
      for (const id of [...uniqueIds].sort())
        await lockPrinterPrintQueue(tx, id);
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "print_jobs"
        WHERE "printerId" IN (${Prisma.join(uniqueIds)})
        FOR UPDATE
      `;
      const unresolvedJobs = await tx.printJob.findMany({
        where: {
          printerId: { in: uniqueIds },
          status: { notIn: ["PRINTED", "CANCELLED"] },
        },
        select: { printerId: true },
      });
      if (unresolvedJobs.length > 0) {
        throw new ConflictException(
          "Printerga biriktirilgan tugallanmagan chop ishlari bor. Avval ularni hal qiling yoki printerni ishdan chiqaring.",
        );
      }
      for (const printer of printers) {
        const deleted = await tx.printer.deleteMany({
          where: {
            id: printer.id,
            branchId: printer.branchId,
            branch: { tenantId: printer.tenantId },
          },
        });
        if (deleted.count !== 1)
          throw new NotFoundException("Printer not found");
        await writeAuditLog(tx, {
          tenantId: printer.tenantId,
          userId: user.id,
          action: "PRINTER_DELETED",
          entity: "Printer",
          entityId: printer.id,
          metadata: { branchId: printer.branchId, name: printer.name },
        });
      }
    });
    return { deleted: true, count: uniqueIds.length, ids: uniqueIds };
  }

  private async assertPrinter(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{
    branchId: string;
    name: string;
    metadata: unknown;
    tenantId: string;
  }> {
    const scope = await resolveRestaurantScope(this.prisma, user);
    const printer = await this.prisma.printer.findFirst({
      where: {
        id,
        ...(scope.branchId
          ? { branchId: scope.branchId }
          : { branch: { tenantId: scope.tenantId } }),
      },
      select: { id: true, branchId: true, name: true, metadata: true },
    });
    if (!printer) throw new NotFoundException("Printer not found");
    return { ...printer, tenantId: scope.tenantId };
  }
}
