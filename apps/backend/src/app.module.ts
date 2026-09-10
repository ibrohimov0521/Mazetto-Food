import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserAuthCacheService } from "./common/auth/user-auth-cache.service";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { MazettoThrottlerGuard } from "./common/guards/mazetto-throttler.guard";
import { RedisThrottlerStorage } from "./common/throttler/redis-throttler.storage";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { CacheModule } from "./cache/cache.module";
import { HealthController } from "./health.controller";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { CashRegisterModule } from "./modules/cash-register/cash-register.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { HomepageModule } from "./modules/homepage/homepage.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { KitchenModule } from "./modules/kitchen/kitchen.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { MenuModule } from "./modules/menu/menu.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PrintersModule } from "./modules/printers/printers.module";
import { ProductsModule } from "./modules/products/products.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ShiftsModule } from "./modules/shifts/shifts.module";
import { StaffModule } from "./modules/staff/staff.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { TablesModule } from "./modules/tables/tables.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { RedisService } from "./redis/redis.service";

@Module({
  imports: [
    // Rejalashtirilgan tozalash ishlari uchun. Ilgari backendda birorta ham
    // davriy ish yo'q edi.
    ScheduleModule.forRoot(),
    CacheModule,
    RedisModule,
    SettingsModule,
    /*
     * Global rate limit.
     *
     * Hisoblagichlar REDIS'da: jarayon xotirasidagi buketlar har deploy'da
     * nolga tushardi va instance boshiga alohida sanalardi, ya'ni haqiqiy
     * chegara instance soniga ko'payib ketardi.
     *
     * ⚠ CHEGARA QIYMATI O'LCHOVGA ASOSLANMAGAN. U IP bo'yicha hisoblanadi,
     * bitta filialdagi bir necha planshet esa BITTA NAT IP ni bo'lishadi —
     * ya'ni chegara qurilma emas, butun filial uchun amal qiladi. 300 ataylab
     * baland: maqsad suiiste'molni to'xtatish, xizmat ko'rsatish paytida
     * xodimni bloklash emas. Haqiqiy qiymat ishlab chiqarish trafigidan
     * o'lchanishi kerak.
     */
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: "default", ttl: 60_000, limit: 300 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    PrismaModule,
    AuthModule,
    AuditModule,
    UsersModule,
    RolesModule,
    EmployeesModule,
    ExpensesModule,
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
    HomepageModule,
    DashboardModule,
    ReportsModule,
    StaffModule,
    InventoryModule,
    KitchenModule,
    RecipesModule,
    SuppliersModule,
    TablesModule,
    TelegramModule,
    MaintenanceModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    UserAuthCacheService,
    // Tartib muhim: chegara autentifikatsiyadan OLDIN qo'llanadi, aks holda
    // tekshirilmagan so'rovlar oqimi baribir bazaga urilaverardi.
    {
      provide: APP_GUARD,
      useClass: MazettoThrottlerGuard,
    },
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
