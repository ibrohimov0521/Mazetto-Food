import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { CashRegisterModule } from "./modules/cash-register/cash-register.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { KitchenModule } from "./modules/kitchen/kitchen.module";
import { MenuModule } from "./modules/menu/menu.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PrintersModule } from "./modules/printers/printers.module";
import { ProductsModule } from "./modules/products/products.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { ShiftsModule } from "./modules/shifts/shifts.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { TablesModule } from "./modules/tables/tables.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    EmployeesModule,
    BranchesModule,
    CashRegisterModule,
    CustomersModule,
    MenuModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    ReceiptsModule,
    PrintersModule,
    ShiftsModule,
    DashboardModule,
    ReportsModule,
    InventoryModule,
    KitchenModule,
    RecipesModule,
    SuppliersModule,
    TablesModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
