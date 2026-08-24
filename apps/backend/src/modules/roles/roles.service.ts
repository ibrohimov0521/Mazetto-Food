import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
