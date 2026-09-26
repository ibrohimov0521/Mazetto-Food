import { hash } from "bcryptjs";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  if (process.env.BESTTEAM_OWNER_BOOTSTRAP !== "1") {
    throw new Error("BESTTEAM_OWNER_BOOTSTRAP=1 is required for this one-time owner setup.");
  }
  const email = process.env.BESTTEAM_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.BESTTEAM_OWNER_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("BESTTEAM_OWNER_EMAIL and a password of at least 12 characters are required.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const existingOwner = await prisma.user.findFirst({
      where: { email, roles: { some: { role: { code: "PLATFORM_OWNER" } } } },
      select: { id: true },
    });
    if (existingOwner) {
      console.info("BestTeam platform owner already exists; password unchanged.");
      return;
    }
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw new Error("This email belongs to another account. Use a separate owner email.");

    const passwordHash = await hash(password, 12);
    const account = await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { code: "PLATFORM_OWNER" },
        create: { code: "PLATFORM_OWNER", name: "BestTeam Platform Owner", isSystem: true, isBranchScoped: false },
        update: { isActive: true, isSystem: true, isBranchScoped: false },
      });
      const permission = await tx.permission.upsert({
        where: { code: PERMISSIONS.SYSTEM_HEALTH_VIEW },
        create: { code: PERMISSIONS.SYSTEM_HEALTH_VIEW, name: "System health view" },
        update: {},
      });
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
      const user = await tx.user.create({
        data: { email, passwordHash, displayName: process.env.BESTTEAM_OWNER_NAME?.trim() || "BestTeam Owner", isActive: true },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      return user;
    });
    console.info(JSON.stringify({
      id: account.id,
      email: account.email?.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
      roles: ["PLATFORM_OWNER"],
      active: account.isActive,
    }));
  } finally {
    await prisma.onModuleDestroy();
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
