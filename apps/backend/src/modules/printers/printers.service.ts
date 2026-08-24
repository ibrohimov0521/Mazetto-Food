import { Injectable, NotFoundException } from "@nestjs/common";
import { resolveBranchScope, resolveRequiredBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
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

  createPrinter(dto: CreatePrinterDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);

    return this.prisma.printer.create({
      data: {
        branchId,
        name: dto.name,
        type: dto.type,
        status: dto.status ?? "ONLINE",
        metadata: {
          protocol: "ESC_POS",
          ready: dto.type === "THERMAL" || dto.type === "RECEIPT",
        },
      },
      include: { branch: true },
    });
  }

  async updatePrinter(id: string, dto: UpdatePrinterDto, user: AuthenticatedUser) {
    await this.assertPrinter(id, user);

    return this.prisma.printer.update({
      where: { id },
      data: dto,
      include: { branch: true },
    });
  }

  private async assertPrinter(id: string, user: AuthenticatedUser): Promise<void> {
    const printer = await this.prisma.printer.findUnique({ where: { id }, select: { id: true, branchId: true } });

    if (!printer) {
      throw new NotFoundException("Printer not found");
    }

    resolveBranchScope(user, printer.branchId);
  }
}
