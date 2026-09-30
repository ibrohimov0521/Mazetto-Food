import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeBootstrapService } from "./desktop-bootstrap.service";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [PrismaModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeBootstrapService],
})
export class RealtimeModule {}