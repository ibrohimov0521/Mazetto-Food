import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { MaintenanceScheduler } from "./maintenance.scheduler";

@Module({
  imports: [PrismaModule],
  providers: [MaintenanceScheduler],
})
export class MaintenanceModule {}
