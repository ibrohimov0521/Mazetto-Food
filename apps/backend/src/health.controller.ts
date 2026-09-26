import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "./common/decorators/public.decorator";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./redis/redis.service";

type BackendHealth = {
  service: "mazetto-backend";
  status: "ok";
  database: {
    status: "ok";
  };
  redis: "connected" | "fallback";
};

@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async getHealth(): Promise<BackendHealth> {
    const database = await this.prisma.checkHealth();

    return {
      service: "mazetto-backend",
      status: "ok",
      database,
      redis: this.redis.getClient() ? "connected" : "fallback",
    };
  }
}
