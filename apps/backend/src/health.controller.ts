import { Controller, Get } from "@nestjs/common";
import type { ServiceHealth } from "@mazetto/types";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): ServiceHealth {
    return {
      success: true,
      service: "mazetto-backend",
      status: "ok",
    };
  }
}
