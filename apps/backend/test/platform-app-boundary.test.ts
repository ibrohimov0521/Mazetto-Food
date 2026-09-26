import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { AppModule } from "../src/app.module";
import { AuthModule } from "../src/modules/auth/auth.module";
import { OrdersModule } from "../src/modules/orders/orders.module";
import { PlatformAgentModule } from "../src/modules/platform-monitoring/platform-agent.module";
import { PlatformAgentService } from "../src/modules/platform-monitoring/platform-agent.service";
import { PlatformMonitoringModule } from "../src/modules/platform-monitoring/platform-monitoring.module";
import { PlatformMonitoringService } from "../src/modules/platform-monitoring/platform-monitoring.service";
import { PlatformAuditController, PlatformDiagnosticsController, PlatformEventsController, PlatformHeartbeatController, PlatformMonitoringController, PlatformReportsController } from "../src/modules/platform-monitoring/platform-monitoring.controller";

test("owner console routes live in the same API module graph and database as restaurant workflows", () => {
  const appImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
  assert.ok(appImports.includes(AuthModule));
  assert.ok(appImports.includes(OrdersModule));
  assert.ok(appImports.includes(PlatformAgentModule));

  const agentImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, PlatformAgentModule) as unknown[];
  const agentProviders = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PlatformAgentModule) as unknown[];
  const monitoringImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, PlatformMonitoringModule) as unknown[];
  const monitoringProviders = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PlatformMonitoringModule) as unknown[];
  const monitoringControllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PlatformMonitoringModule) as unknown[];

  assert.ok(agentImports.includes(PlatformMonitoringModule));
  assert.ok(monitoringImports.length > 0);
  assert.ok(monitoringProviders.includes(PlatformMonitoringService));
  assert.ok(agentProviders.includes(PlatformAgentService));
  assert.ok(!agentProviders.includes(PlatformMonitoringService));
  assert.ok(monitoringControllers.includes(PlatformMonitoringController));
  assert.ok(monitoringControllers.includes(PlatformEventsController));
  assert.ok(monitoringControllers.includes(PlatformDiagnosticsController));
  assert.ok(monitoringControllers.includes(PlatformAuditController));
  assert.ok(monitoringControllers.includes(PlatformReportsController));
  assert.ok(monitoringControllers.includes(PlatformHeartbeatController));
});
