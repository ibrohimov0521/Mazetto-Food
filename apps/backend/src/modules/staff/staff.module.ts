import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { KitchenModule } from "../kitchen/kitchen.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { UserAuthCacheService } from "../../common/auth/user-auth-cache.service";

@Module({
  imports: [PrismaModule, KitchenModule],
  controllers: [StaffController],
  providers: [StaffService, UserAuthCacheService],
  exports: [StaffService],
})
export class StaffModule {}
