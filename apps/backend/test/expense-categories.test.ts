import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ExpensesService } from "../src/modules/expenses/expenses.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const actor: AuthenticatedUser = {
  id: "user-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  roles: ["BRANCH_MANAGER"],
  permissions: ["EXPENSE_CREATE"],
};

test("expense category archive preserves historical expense snapshots", async () => {
  const calls: string[] = [];
  const category = {
    id: "category-1",
    name: "Transport",
    branchId: "branch-1",
    isActive: true,
  };
  const tx = {
    expenseCategory: {
      update: async ({ data }: { data: { isActive: boolean } }) => {
        calls.push(`category:${data.isActive}`);
        return { ...category, ...data };
      },
    },
    auditLog: {
      create: async () => {
        calls.push("audit");
        return {};
      },
    },
  };
  const prisma = {
    expenseCategory: { findUnique: async () => category },
    expense: {
      updateMany: async () => {
        calls.push("expense-mutated");
        return { count: 1 };
      },
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
  } as unknown as PrismaService;

  await new ExpensesService(prisma).archiveCategory("category-1", actor);
  assert.deepEqual(calls, ["category:false", "audit"]);
});

test("archived expense category cannot be used for a new expense", async () => {
  const prisma = {
    expenseCategory: {
      findUnique: async () => ({ name: "Transport", isActive: false }),
    },
    expense: {
      create: async () => assert.fail("expense must not be created"),
    },
  } as unknown as PrismaService;

  await assert.rejects(
    new ExpensesService(prisma).createExpense(
      { category: " transport ", amount: 1000 },
      actor,
    ),
    BadRequestException,
  );
});

test("branch manager cannot rename another branch expense category", async () => {
  const prisma = {
    expenseCategory: {
      findUnique: async () => ({
        id: "category-2",
        name: "Transport",
        branchId: "branch-2",
        isActive: true,
      }),
    },
  } as unknown as PrismaService;

  await assert.rejects(
    new ExpensesService(prisma).updateCategory(
      "category-2",
      { name: "Yo'l xarajati" },
      actor,
    ),
    ForbiddenException,
  );
});
