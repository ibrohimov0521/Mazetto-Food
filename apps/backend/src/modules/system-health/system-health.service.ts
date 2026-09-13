import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { readBackupEvidence } from "./backup-evidence";

@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async snapshot() {
    const [database, backup] = await Promise.all([
      this.prisma.checkHealth().then(
        () => "ok" as const,
        () => "error" as const,
      ),
      readBackupEvidence(process.env.MAZETTO_BACKUP_STATUS_FILE),
    ]);
    const redis = this.redis.getClient() ? "ready" : "degraded";

    return {
      status:
        database === "ok" && redis === "ready" && backup.status === "verified"
          ? ("ok" as const)
          : ("attention" as const),
      checkedAt: new Date().toISOString(),
      database: { status: database },
      redis: { status: redis },
      backup,
    };
  }
}
