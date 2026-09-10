import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

type MemoryEntry = { value: string; expiresAt: number };

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis: Redis | null = null;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL?.trim();

    if (!url) {
      return;
    }

    const redis = new Redis(url, {
      connectTimeout: 500,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    redis.on("error", (error) => {
      this.logger.warn(`Redis cache error: ${error.message}`);
    });

    try {
      await redis.connect();
      this.redis = redis;
      this.logger.log("Redis cache connected");
    } catch (error) {
      redis.disconnect();
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Redis cache unavailable, using in-memory fallback: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis?.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      await this.delete(key);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlMs);
  }

  async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        this.logFallback(error);
      }
    }

    this.memory.delete(key);
  }

  private async get(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        this.logFallback(error);
      }
    }

    const entry = this.memory.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }

    return entry.value;
  }

  private async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(key, value, "PX", ttlMs);
        return;
      } catch (error) {
        this.logFallback(error);
      }
    }

    this.memory.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.sweepExpiredMemoryEntries();
  }

  private sweepExpiredMemoryEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.memory.entries()) {
      if (entry.expiresAt <= now) {
        this.memory.delete(key);
      }
    }
  }

  private logFallback(error: unknown): void {
    const message = error instanceof Error ? error.message : "unknown error";
    this.logger.warn(`Redis cache command failed, using fallback: ${message}`);
  }
}
