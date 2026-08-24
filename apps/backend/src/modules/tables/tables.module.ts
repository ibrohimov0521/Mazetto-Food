import { Module } from "@nestjs/common";
import { KitchenModule } from "../kitchen/kitchen.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TablesController } from "./tables.controller";
import { TablesService } from "./tables.service";

@Module({
  imports: [PrismaModule, KitchenModule],
  controllers: [TablesController],
  providers: [TablesService],
})
export class TablesModule {}
