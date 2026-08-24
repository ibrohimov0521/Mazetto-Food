import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ShiftsModule } from "../shifts/shifts.module";
import { CashRegisterController } from "./cash-register.controller";
import { CashRegisterService } from "./cash-register.service";

@Module({
  imports: [PrismaModule, ShiftsModule],
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
})
export class CashRegisterModule {}
