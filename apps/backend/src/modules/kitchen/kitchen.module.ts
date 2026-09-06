import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { KitchenController } from "./kitchen.controller";
import { KitchenGateway } from "./kitchen.gateway";
import { KitchenService } from "./kitchen.service";

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [KitchenController],
  providers: [KitchenGateway, KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
