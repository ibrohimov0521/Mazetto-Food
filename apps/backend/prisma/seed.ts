import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { seedMenu } from "./seeds/menu";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the Prisma seed");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const roleDefinitions = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Full system access across all branches and finance.",
    permissions: [PERMISSIONS.ALL],
  },
  {
    code: "BRANCH_MANAGER",
    name: "Branch Manager",
    description:
      "Manage assigned branch operations, employees, inventory, and orders.",
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.BRANCH_VIEW,
      PERMISSIONS.BRANCH_EDIT,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.PERMISSION_VIEW,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_UPDATE,
      PERMISSIONS.STAFF_PASSWORD_RESET,
      PERMISSIONS.STAFF_STATUS_CHANGE,
      PERMISSIONS.STAFF_ROLE_ASSIGN,
      PERMISSIONS.MENU_VIEW,
      PERMISSIONS.MENU_CREATE,
      PERMISSIONS.MENU_EDIT,
      PERMISSIONS.MENU_DELETE,
      PERMISSIONS.HOMEPAGE_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_EDIT,
      PERMISSIONS.RECIPE_MANAGE,
      PERMISSIONS.TABLE_VIEW,
      PERMISSIONS.TABLE_CREATE,
      PERMISSIONS.TABLE_EDIT,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.ORDER_SEND_KITCHEN,
      PERMISSIONS.KITCHEN_VIEW,
      PERMISSIONS.KITCHEN_ACCEPT,
      PERMISSIONS.KITCHEN_STATUS_UPDATE,
      PERMISSIONS.POS_USE,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.RECEIPT_VIEW,
      PERMISSIONS.RECEIPT_PRINT,
      PERMISSIONS.SHIFT_VIEW_OWN,
      PERMISSIONS.SHIFT_VIEW_BRANCH,
      PERMISSIONS.SHIFT_OPEN,
      PERMISSIONS.SHIFT_CLOSE,
      PERMISSIONS.CASH_TRANSACTION_CREATE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.ONLINE_ORDER_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_PRODUCTS_VIEW,
      PERMISSIONS.REPORT_EMPLOYEES_VIEW,
      PERMISSIONS.REPORT_EXPENSES_VIEW,
    ],
  },
  {
    code: "ADMIN",
    name: "Admin",
    description:
      "Business administration, catalog management, branch operations, staff, and reports.",
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.BRANCH_VIEW,
      PERMISSIONS.BRANCH_EDIT,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.PERMISSION_VIEW,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_UPDATE,
      PERMISSIONS.STAFF_PASSWORD_RESET,
      PERMISSIONS.STAFF_STATUS_CHANGE,
      PERMISSIONS.STAFF_ROLE_ASSIGN,
      PERMISSIONS.MENU_VIEW,
      PERMISSIONS.MENU_CREATE,
      PERMISSIONS.MENU_EDIT,
      PERMISSIONS.MENU_DELETE,
      PERMISSIONS.HOMEPAGE_MANAGE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.ONLINE_ORDER_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_PRODUCTS_VIEW,
      PERMISSIONS.REPORT_EMPLOYEES_VIEW,
      PERMISSIONS.REPORT_EXPENSES_VIEW,
    ],
  },
  {
    code: "CASHIER",
    name: "Cashier",
    description: "POS access, order creation, payments, and receipts.",
    permissions: [
      PERMISSIONS.MENU_VIEW,
      PERMISSIONS.POS_USE,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.RECEIPT_VIEW,
      PERMISSIONS.RECEIPT_PRINT,
      PERMISSIONS.SHIFT_VIEW_OWN,
      PERMISSIONS.SHIFT_OPEN,
      PERMISSIONS.SHIFT_CLOSE,
      PERMISSIONS.CASH_TRANSACTION_CREATE,
    ],
  },
  {
    code: "WAITER",
    name: "Waiter",
    description: "Table management and customer order flow.",
    permissions: [
      PERMISSIONS.MENU_VIEW,
      PERMISSIONS.TABLE_VIEW,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.ORDER_SEND_KITCHEN,
    ],
  },
  {
    code: "KITCHEN",
    name: "Kitchen",
    description: "Kitchen display access and preparation status updates.",
    permissions: [
      PERMISSIONS.KITCHEN_VIEW,
      PERMISSIONS.KITCHEN_ACCEPT,
      PERMISSIONS.KITCHEN_STATUS_UPDATE,
    ],
  },
  {
    code: "ACCOUNTANT",
    name: "Accountant",
    description: "Finance, payments, expenses, reports, and exports.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.ONLINE_ORDER_VIEW,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.RECEIPT_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_PRODUCTS_VIEW,
      PERMISSIONS.REPORT_EMPLOYEES_VIEW,
      PERMISSIONS.REPORT_EXPENSES_VIEW,
    ],
  },
] as const;

const permissionNames: Record<string, string> = {
  [PERMISSIONS.ALL]: "Full access",
  [PERMISSIONS.ADMIN_ACCESS]: "Access admin workspace",
  [PERMISSIONS.DASHBOARD_VIEW]: "View dashboard",
  [PERMISSIONS.BRANCH_VIEW]: "View branches",
  [PERMISSIONS.BRANCH_CREATE]: "Create branches",
  [PERMISSIONS.BRANCH_EDIT]: "Edit branch operational settings",
  [PERMISSIONS.USER_VIEW]: "View users",
  [PERMISSIONS.ROLE_VIEW]: "View roles",
  [PERMISSIONS.PERMISSION_VIEW]: "View permissions",
  [PERMISSIONS.STAFF_VIEW]: "View staff accounts",
  [PERMISSIONS.STAFF_CREATE]: "Create staff accounts",
  [PERMISSIONS.STAFF_UPDATE]: "Update staff accounts",
  [PERMISSIONS.STAFF_PASSWORD_RESET]: "Reset staff passwords",
  [PERMISSIONS.STAFF_STATUS_CHANGE]: "Activate or block staff accounts",
  [PERMISSIONS.STAFF_ROLE_ASSIGN]: "Assign staff roles",
  [PERMISSIONS.MENU_VIEW]: "View menu management",
  [PERMISSIONS.MENU_CREATE]: "Create menu records",
  [PERMISSIONS.MENU_EDIT]: "Edit menu records",
  [PERMISSIONS.MENU_DELETE]: "Delete menu records",
  [PERMISSIONS.HOMEPAGE_MANAGE]: "Manage customer homepage and promotions",
  [PERMISSIONS.INVENTORY_VIEW]: "View inventory",
  [PERMISSIONS.INVENTORY_CREATE]: "Create inventory records",
  [PERMISSIONS.INVENTORY_EDIT]: "Edit inventory and stock",
  [PERMISSIONS.RECIPE_MANAGE]: "Manage recipes",
  [PERMISSIONS.TABLE_VIEW]: "View halls and tables",
  [PERMISSIONS.TABLE_CREATE]: "Create halls and tables",
  [PERMISSIONS.TABLE_EDIT]: "Edit table status and layout",
  [PERMISSIONS.ORDER_VIEW]: "View orders",
  [PERMISSIONS.ORDER_CREATE]: "Create orders",
  [PERMISSIONS.ORDER_UPDATE]: "Update orders",
  [PERMISSIONS.ORDER_SEND_KITCHEN]: "Send orders to kitchen",
  [PERMISSIONS.KITCHEN_VIEW]: "View kitchen display",
  [PERMISSIONS.KITCHEN_ACCEPT]: "Accept kitchen tickets",
  [PERMISSIONS.KITCHEN_STATUS_UPDATE]: "Update kitchen ticket status",
  [PERMISSIONS.POS_USE]: "Use POS workspace",
  [PERMISSIONS.PAYMENT_CREATE]: "Create order payments",
  [PERMISSIONS.PAYMENT_VIEW]: "View payment history",
  [PERMISSIONS.RECEIPT_VIEW]: "View receipts",
  [PERMISSIONS.RECEIPT_PRINT]: "Print receipts",
  [PERMISSIONS.SHIFT_VIEW_OWN]: "View own cashier shift",
  [PERMISSIONS.SHIFT_VIEW_BRANCH]: "View all shifts in branch",
  [PERMISSIONS.SHIFT_OPEN]: "Open cashier shifts",
  [PERMISSIONS.SHIFT_CLOSE]: "Close cashier shifts",
  [PERMISSIONS.CASH_TRANSACTION_CREATE]: "Create cash drawer transactions",
  [PERMISSIONS.CUSTOMER_VIEW]: "View customers",
  [PERMISSIONS.ONLINE_ORDER_VIEW]: "View online orders",
  [PERMISSIONS.REPORT_SALES_VIEW]: "View sales reports",
  [PERMISSIONS.REPORT_PRODUCTS_VIEW]: "View product reports",
  [PERMISSIONS.REPORT_EMPLOYEES_VIEW]: "View employee reports",
  [PERMISSIONS.REPORT_EXPENSES_VIEW]: "View expense reports",
};

const paymentMethodDefinitions = [
  { code: "CASH", name: "Cash", sortOrder: 10 },
  { code: "CARD", name: "Card", sortOrder: 20 },
  { code: "UZCARD", name: "Uzcard", sortOrder: 30 },
  { code: "HUMO", name: "Humo", sortOrder: 40 },
  { code: "CLICK", name: "Click", sortOrder: 50 },
  { code: "PAYME", name: "Payme", sortOrder: 60 },
  { code: "ONLINE", name: "Online", sortOrder: 70 },
] as const;

async function main(): Promise<void> {
  const permissionCodes = [...new Set(Object.keys(permissionNames))];

  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {
        name: permissionNames[code] ?? code,
      },
      create: {
        code,
        name: permissionNames[code] ?? code,
      },
    });
  }

  for (const roleDefinition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: roleDefinition.code },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
        isActive: true,
      },
      create: {
        code: roleDefinition.code,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
        isActive: true,
      },
    });

    for (const permissionCode of roleDefinition.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
        select: { id: true },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: {
          code: {
            notIn: [...roleDefinition.permissions],
          },
        },
      },
    });
  }

  for (const paymentMethodDefinition of paymentMethodDefinitions) {
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        branchId: null,
        code: paymentMethodDefinition.code,
      },
    });

    if (existingPaymentMethod) {
      await prisma.paymentMethod.update({
        where: { id: existingPaymentMethod.id },
        data: {
          name: paymentMethodDefinition.name,
          sortOrder: paymentMethodDefinition.sortOrder,
          isActive: true,
        },
      });
    } else {
      await prisma.paymentMethod.create({
        data: {
          code: paymentMethodDefinition.code,
          name: paymentMethodDefinition.name,
          sortOrder: paymentMethodDefinition.sortOrder,
          isActive: true,
        },
      });
    }
  }

  const menuResult = await seedMenu(prisma);

  console.info(
    `MAZETTO FOOD system roles, permissions, and menu are ready. Imported ${menuResult.products} products, including ${menuResult.combos} combo sets. No demo users were created.`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
