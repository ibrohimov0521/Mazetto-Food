import { Module } from "@nestjs/common";
import { PlatformAgentService } from "./platform-agent.service";
import { PlatformMonitoringModule } from "./platform-monitoring.module";

@Module({
  imports: [PlatformMonitoringModule],
  providers: [PlatformAgentService],
})
export class PlatformAgentModule {}
