import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrintersController } from "./printers.controller";
import { PrintersService } from "./printers.service";

@Module({
  imports: [PrismaModule],
  controllers: [PrintersController],
  providers: [PrintersService],
})
export class PrintersModule {}
