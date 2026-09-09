import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "./common/decorators/public.decorator";
import { PrismaService } from "./prisma/prisma.service";

type BackendHealth = {
  success: true;
  service: "mazetto-backend";
  status: "ok";
  database: {
    status: "ok";
  };
};

@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<BackendHealth> {
    const database = await this.prisma.checkHealth();

    return {
      success: true,
      service: "mazetto-backend",
      status: "ok",
      database,
    };
  }
}
