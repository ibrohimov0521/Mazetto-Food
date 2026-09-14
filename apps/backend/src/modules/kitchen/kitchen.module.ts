import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { KitchenController } from "./kitchen.controller";
import { KitchenActionService } from "./kitchen-action.service";
import { KitchenGateway } from "./kitchen.gateway";
import { KitchenService } from "./kitchen.service";

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [KitchenController],
  providers: [KitchenActionService, KitchenGateway, KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
