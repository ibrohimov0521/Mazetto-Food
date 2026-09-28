import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantRequestContextService } from "../../common/tenant/tenant-request-context.service";
import { TenantMembershipAuthService } from "./tenant-membership-auth.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginThrottleService } from "./login-throttle.service";

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, LoginThrottleService, TenantRequestContextService, TenantMembershipAuthService],
  exports: [JwtModule, TenantRequestContextService, TenantMembershipAuthService],
})
export class AuthModule {}
