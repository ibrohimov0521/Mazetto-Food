import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

export type ScopedPaymentMethod = {
  branchId: string | null;
  code: string;
  isActive: boolean;
};

/** A branch row overrides its global row, including when that override is disabled. */
export function resolveEffectiveBranchPaymentMethods<
  T extends ScopedPaymentMethod,
>(methods: readonly T[], branchId: string): T[] {
  const effective = new Map<string, T>();

  for (const method of methods) {
    if (method.branchId === branchId) {
      effective.set(method.code.trim().toUpperCase(), method);
    }
  }

  for (const method of methods) {
    const code = method.code.trim().toUpperCase();
    if (method.branchId === null && !effective.has(code)) {
      effective.set(code, method);
    }
  }

  return [...effective.values()].filter((method) => method.isActive);
}

export async function resolveBranchPaymentMethod(
  tx: Prisma.TransactionClient,
  branchId: string,
  code: string,
) {
  const normalizedCode = code.trim().toUpperCase();
  const branchOverride = await tx.paymentMethod.findFirst({
    where: { branchId, code: normalizedCode },
    select: { id: true, code: true, name: true, isActive: true },
  });

  if (branchOverride) {
    if (!branchOverride.isActive) {
      throw new BadRequestException(
        `To'lov usuli "${normalizedCode}" bu filialda mavjud emas`,
      );
    }

    return {
      id: branchOverride.id,
      code: branchOverride.code,
      name: branchOverride.name,
    };
  }

  const globalMethod = await tx.paymentMethod.findFirst({
    where: { branchId: null, code: normalizedCode, isActive: true },
    select: { id: true, code: true, name: true },
  });

  if (!globalMethod) {
    throw new BadRequestException(
      `To'lov usuli "${normalizedCode}" bu filialda mavjud emas`,
    );
  }

  return globalMethod;
}
