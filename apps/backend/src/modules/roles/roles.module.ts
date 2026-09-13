import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { UserAuthCacheService } from "../../common/auth/user-auth-cache.service";

@Module({
  imports: [PrismaModule],
  controllers: [RolesController],
  providers: [RolesService, UserAuthCacheService],
})
export class RolesModule {}
