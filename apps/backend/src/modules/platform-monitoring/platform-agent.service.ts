import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PlatformMonitoringService } from "./platform-monitoring.service";

@Injectable()
export class PlatformAgentService {
  private readonly logger = new Logger(PlatformAgentService.name);
  private sending = false;
  private deliveryWarningShown = false;
  private diagnostics: NonNullable<Awaited<ReturnType<PlatformMonitoringService["buildLocalHeartbeat"]>>["diagnostics"]> = [];

  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reportToBestTeam(): Promise<void> {
    const baseUrl = process.env.BESTTEAM_MONITOR_URL?.trim().replace(/\/+$/, "");
    const siteKey = process.env.BESTTEAM_INSTANCE_KEY?.trim();
    const token = process.env.BESTTEAM_INSTANCE_TOKEN?.trim();
    if (!baseUrl || !siteKey || !token || this.sending) return;

    this.sending = true;
    try {
      let heartbeat: Awaited<ReturnType<PlatformMonitoringService["buildLocalHeartbeat"]>>;
      try {
        heartbeat = await this.monitoring.buildLocalHeartbeat();
      } catch {
        this.enqueueDiagnostic("backend", "LOCAL_HEARTBEAT_BUILD_FAILED", "error");
        return;
      }
      const sentDiagnosticIds = this.diagnostics.map((item) => item.id);
      heartbeat.diagnostics = [...this.diagnostics];
      const response = await fetch(`${baseUrl}/${encodeURIComponent(siteKey)}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bestteam-agent-token": token,
        },
        body: JSON.stringify(heartbeat),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        this.enqueueDiagnostic("control_plane", "CONTROL_PLANE_REJECTED_HEARTBEAT", "warning");
        if (!this.deliveryWarningShown) {
          this.logger.warn(`BestTeam monitoring heartbeat rejected (${response.status}).`);
          this.deliveryWarningShown = true;
        }
      } else {
        this.deliveryWarningShown = false;
        this.diagnostics = this.diagnostics.filter((item) => !sentDiagnosticIds.includes(item.id));
      }
    } catch {
      this.enqueueDiagnostic("control_plane", "CONTROL_PLANE_UNREACHABLE", "error");
      if (!this.deliveryWarningShown) {
        this.logger.warn("BestTeam monitoring heartbeat could not be delivered.");
        this.deliveryWarningShown = true;
      }
    } finally {
      this.sending = false;
    }
  }

  private enqueueDiagnostic(
    service: "backend" | "database" | "redis" | "control_plane",
    code: "LOCAL_HEARTBEAT_BUILD_FAILED" | "CONTROL_PLANE_REJECTED_HEARTBEAT" | "CONTROL_PLANE_UNREACHABLE",
    severity: "warning" | "error",
  ) {
    this.diagnostics.push({ id: randomUUID(), service, code, severity, occurredAt: new Date().toISOString() });
    if (this.diagnostics.length > 20) this.diagnostics.splice(0, this.diagnostics.length - 20);
  }
}
