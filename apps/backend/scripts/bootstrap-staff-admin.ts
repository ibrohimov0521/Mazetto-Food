import { StaffService } from "../src/modules/staff/staff.service";
import { UserAuthCacheService } from "../src/common/auth/user-auth-cache.service";
import { RedisCacheService } from "../src/cache/redis-cache.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { loadEnvironmentFile } from "../src/config/env";

// Skriptlar `tsx` ostida ishlaydi va `.env` ni o'zi yuklamaydi — Nest
// bootstrap'i bu yerda ishtirok etmaydi (7-bosqich Q3.1).
loadEnvironmentFile();

async function main(): Promise<void> {
  const password = process.env.MAZETTO_BOOTSTRAP_ADMIN_PASSWORD;
  const email = process.env.MAZETTO_BOOTSTRAP_ADMIN_EMAIL;
  const phone = process.env.MAZETTO_BOOTSTRAP_ADMIN_PHONE;
  const name = process.env.MAZETTO_BOOTSTRAP_ADMIN_NAME ?? "MAZETTO Owner";
  const branchCodeOrId = process.env.MAZETTO_BOOTSTRAP_ADMIN_BRANCH;
  const activate = process.env.MAZETTO_BOOTSTRAP_ADMIN_ACTIVATE === "1";

  if (!password) {
    throw new Error("MAZETTO_BOOTSTRAP_ADMIN_PASSWORD is required");
  }

  if (!email && !phone) {
    throw new Error("MAZETTO_BOOTSTRAP_ADMIN_EMAIL or MAZETTO_BOOTSTRAP_ADMIN_PHONE is required");
  }

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const staffService = new StaffService(prisma, new UserAuthCacheService(new RedisCacheService()));
    const account = await staffService.bootstrapSuperAdmin({
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      password,
      activate,
      ...(branchCodeOrId ? { branchCodeOrId } : {}),
    });

    console.info(
      JSON.stringify(
        {
          id: account.id,
          email: maskEmail(account.email),
          phone: maskPhone(account.phone),
          roles: account.roles.map((role) => role.code),
          isActive: account.isActive,
          branchScope: account.employee?.branch?.code ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

function maskEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }

  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone?: string | null): string | null {
  if (!phone) {
    return null;
  }

  return `${phone.slice(0, 5)}***${phone.slice(-2)}`;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
