import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { readBackupEvidence } from "./backup-evidence";
import { GeocodingService } from "../geocoding/geocoding.service";
import { MinioService } from "../uploads/minio.service";

@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geocoding: GeocodingService,
    private readonly media: MinioService,
  ) {}

  async snapshot() {
    const [database, backup, geocoding, media] = await Promise.all([
      this.prisma.checkHealth().then(
        () => "ok" as const,
        () => "error" as const,
      ),
      readBackupEvidence(process.env.MAZETTO_BACKUP_STATUS_FILE),
      this.geocoding.readiness(),
      this.media.readiness(),
    ]);
    const redis = this.redis.getClient() ? "ready" : "degraded";

    return {
      status:
        database === "ok" &&
        redis === "ready" &&
        backup.status === "verified" &&
        geocoding === "ready" &&
        media === "ready"
          ? ("ok" as const)
          : ("attention" as const),
      checkedAt: new Date().toISOString(),
      database: { status: database },
      redis: { status: redis },
      dependencies: {
        geocoding: { status: geocoding },
        media: { status: media },
      },
      backup,
    };
  }
}
