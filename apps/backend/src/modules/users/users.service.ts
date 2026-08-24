import { Injectable } from "@nestjs/common";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);

    return this.prisma.user.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            branchId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }
}
