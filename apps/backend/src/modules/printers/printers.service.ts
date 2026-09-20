import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveBranchScope, resolveRequiredBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreatePrinterDto, UpdatePrinterDto } from "./dto/printer.dto";

@Injectable()
export class PrintersService {
  constructor(private readonly prisma: PrismaService) {}

  listPrinters(branchId: string | undefined, user: AuthenticatedUser) {
    const scopedBranchId = resolveBranchScope(user, branchId);
    return this.prisma.printer.findMany({
      where: scopedBranchId ? { branchId: scopedBranchId } : {},
      include: { branch: true },
      orderBy: [{ branchId: "asc" }, { name: "asc" }],
    });
  }

  async createPrinter(dto: CreatePrinterDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
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
        metadata: { protocol: "ESC_POS", ...metadata, printRoles } as Prisma.InputJsonObject,
      },
      include: { branch: true },
    });
  }

  async updatePrinter(id: string, dto: UpdatePrinterDto, user: AuthenticatedUser) {
    const existing = await this.assertPrinter(id, user);
    const { metadata, ...data } = dto;
    return this.prisma.printer.update({
      where: { id },
      data: {
        ...data,
        ...(metadata
          ? {
              metadata: {
                ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata) ? existing.metadata : {}),
                ...metadata,
              } as Prisma.InputJsonObject,
            }
          : {}),
      },
      include: { branch: true },
    });
  }

  async deactivatePrinter(id: string, user: AuthenticatedUser) {
    const existing = await this.assertPrinter(id, user);
    return this.prisma.$transaction(async (tx) => {
      const printer = await tx.printer.update({
        where: { id },
        data: { isActive: false, status: "OFFLINE" },
        include: { branch: true },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "PRINTER_DEACTIVATED",
        entity: "Printer",
        entityId: id,
        metadata: { branchId: existing.branchId, name: existing.name },
      });
      return printer;
    });
  }

  private async assertPrinter(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ branchId: string; name: string; metadata: unknown }> {
    const printer = await this.prisma.printer.findUnique({
      where: { id },
      select: { id: true, branchId: true, name: true, metadata: true },
    });
    if (!printer) throw new NotFoundException("Printer not found");
    resolveBranchScope(user, printer.branchId);
    return printer;
  }
}
