import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [PrismaModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
})
export class RealtimeModule {}