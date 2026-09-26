import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { KitchenTicketStatus, OrderStatus } from "@prisma/client";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { writeAuditLog } from "../audit/audit-write";
import { readBackupEvidence } from "../system-health/backup-evidence";
import type {
  CreatePlatformSiteDto,
  PlatformHeartbeatDto,
  UpdatePlatformSiteDto,
} from "./dto/platform-monitoring.dto";
import {
  heartbeatGraceMs,
  heartbeatTransitionEvents,
  probeTransitionEvents,
} from "./platform-monitoring-events";
import { normalizePublicHttpsUrl, probePublicHttpsUrl } from "./public-https-probe";

const onlineDeviceWindowMs = 5 * 60 * 1000;
const activeOrderStatuses = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];
const activeKitchenStatuses = [
  KitchenTicketStatus.NEW,
  KitchenTicketStatus.ACCEPTED,
  KitchenTicketStatus.COOKING,
  KitchenTicketStatus.READY,
];

const actionablePlatformEvents = new Set([
  "WEBSITE_OFFLINE",
  "API_OFFLINE",
  "AGENT_DISCONNECTED",
  "SERVICE_DEGRADED",
  "PRINTER_FAILED",
  "DEVICE_DISCONNECTED",
]);

function digestToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

function sameToken(token: string, expectedHash: string): boolean {
  const actual = digestToken(token);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function newAgentToken(): string {
  return randomBytes(32).toString("base64url");
}

function publicMonitorUrl(value: string): string {
  try {
    return normalizePublicHttpsUrl(value);
  } catch {
    throw new BadRequestException("Faqat ommaviy domenning HTTPS manzili qabul qilinadi.");
  }
}

function siteResponse(site: {
  id: string;
  siteKey: string;
  name: string;
  productCode: string;
  websiteUrl: string;
  apiHealthUrl: string;
  isActive: boolean;
  lastHeartbeatAt: Date | null;
  lastHeartbeatStatus: string | null;
  lastHeartbeatData: Prisma.JsonValue | null;
  websiteStatus: string;
  websiteStatusCode: number | null;
  websiteLatencyMs: number | null;
  websiteCheckedAt: Date | null;
  websiteError: string | null;
  apiStatus: string;
  apiStatusCode: number | null;
  apiLatencyMs: number | null;
  apiCheckedAt: Date | null;
  apiError: string | null;
  createdAt: Date;
  updatedAt: Date;
}, now = Date.now()) {
  const agentStatus = !site.isActive
    ? "DISABLED"
    : !site.lastHeartbeatAt
      ? now - site.createdAt.getTime() > heartbeatGraceMs ? "OFFLINE" : "WAITING"
      : now - site.lastHeartbeatAt.getTime() > heartbeatGraceMs
        ? "OFFLINE"
        : site.lastHeartbeatStatus === "healthy"
          ? "ONLINE"
          : "DEGRADED";

  return {
    id: site.id,
    siteKey: site.siteKey,
    name: site.name,
    productCode: site.productCode,
    websiteUrl: site.websiteUrl,
    apiHealthUrl: site.apiHealthUrl,
    isActive: site.isActive,
    agentStatus,
    lastHeartbeatAt: site.lastHeartbeatAt?.toISOString() ?? null,
    lastHeartbeatStatus: site.lastHeartbeatStatus,
    heartbeat: site.lastHeartbeatData,
    website: {
      status: site.websiteStatus,
      statusCode: site.websiteStatusCode,
      latencyMs: site.websiteLatencyMs,
      checkedAt: site.websiteCheckedAt?.toISOString() ?? null,
      error: site.websiteError,
    },
    api: {
      status: site.apiStatus,
      statusCode: site.apiStatusCode,
      latencyMs: site.apiLatencyMs,
      checkedAt: site.apiCheckedAt?.toISOString() ?? null,
      error: site.apiError,
    },
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

@Injectable()
export class PlatformMonitoringService {
  private readonly logger = new Logger(PlatformMonitoringService.name);
  private probeInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listSites() {
    const sites = await this.prisma.platformSite.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return sites.map((site) => siteResponse(site));
  }

  async createSite(dto: CreatePlatformSiteDto, actor: AuthenticatedUser) {
    if (!dto.name.trim()) throw new BadRequestException("Restoran nomi kiritilishi shart.");
    const websiteUrl = publicMonitorUrl(dto.websiteUrl);
    const apiHealthUrl = publicMonitorUrl(dto.apiHealthUrl);
    const token = newAgentToken();
    const siteKey = `bt_${randomBytes(9).toString("hex")}`;

    try {
      const site = await this.prisma.$transaction(async (tx) => {
        const created = await tx.platformSite.create({
          data: {
            siteKey,
            name: dto.name.trim(),
            productCode: this.normalizeProductCode(dto.productCode),
            websiteUrl,
            apiHealthUrl,
            tokenHash: digestToken(token).toString("hex"),
          },
        });
        await writeAuditLog(tx, {
          userId: actor.id,
          action: "PLATFORM_SITE_CREATED",
          entity: "PLATFORM_SITE",
          entityId: created.id,
          metadata: {
            name: created.name,
            productCode: created.productCode,
            websiteUrl: created.websiteUrl,
          },
        });
        return created;
      });
      return { site: siteResponse(site), agentToken: token };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Bu sayt yoki domen allaqachon monitoringga qo'shilgan.");
      }
      throw error;
    }
  }

  async updateSite(id: string, dto: UpdatePlatformSiteDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.platformSite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Monitoring sayti topilmadi.");
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException("Restoran nomi bo'sh bo'lmasligi kerak.");
    }

    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
      ...(dto.productCode === undefined
        ? {}
        : { productCode: this.normalizeProductCode(dto.productCode) }),
      ...(dto.websiteUrl === undefined
        ? {}
        : { websiteUrl: publicMonitorUrl(dto.websiteUrl) }),
      ...(dto.apiHealthUrl === undefined
        ? {}
        : { apiHealthUrl: publicMonitorUrl(dto.apiHealthUrl) }),
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
    };

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.platformSite.update({ where: { id }, data });
        await writeAuditLog(tx, {
          userId: actor.id,
          action: "PLATFORM_SITE_UPDATED",
          entity: "PLATFORM_SITE",
          entityId: id,
          metadata: {
            siteName: result.name,
            changedFields: Object.keys(data),
            previousWebsiteUrl: existing.websiteUrl,
          },
        });
        return result;
      });
      return siteResponse(updated);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Bu sayt yoki domen boshqa yozuvga biriktirilgan.");
      }
      throw error;
    }
  }

  async rotateAgentToken(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.platformSite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Monitoring sayti topilmadi.");
    const token = newAgentToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.platformSite.update({
        where: { id },
        data: { tokenHash: digestToken(token).toString("hex"), lastHeartbeatAt: null },
      });
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "PLATFORM_SITE_TOKEN_ROTATED",
        entity: "PLATFORM_SITE",
        entityId: id,
        metadata: { siteKey: existing.siteKey, siteName: existing.name },
      });
    });
    return { siteKey: existing.siteKey, agentToken: token };
  }

  async listEvents(id: string, limit = 50, branchId?: string) {
    if (branchId !== undefined && typeof branchId !== "string") {
      throw new BadRequestException("Oshxona identifikatori noto'g'ri.");
    }
    const normalizedBranchId = branchId?.trim();
    if (branchId !== undefined && (!normalizedBranchId || normalizedBranchId.length > 80)) {
      throw new BadRequestException("Oshxona identifikatori noto'g'ri.");
    }
    const site = await this.prisma.platformSite.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!site) throw new NotFoundException("Monitoring sayti topilmadi.");
    return this.prisma.platformSiteEvent.findMany({
      where: { siteId: id, ...(normalizedBranchId ? { branchId: normalizedBranchId } : {}) },
      orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        siteId: true,
        externalId: true,
        code: true,
        branchId: true,
        branchName: true,
        occurredAt: true,
        receivedAt: true,
        acknowledgedAt: true,
        acknowledgedById: true,
      },
    });
  }

  async listDiagnostics(limit = 100, siteId?: string, severity?: string) {
    const normalizedSiteId = siteId?.trim();
    if (siteId !== undefined && (!normalizedSiteId || normalizedSiteId.length > 80)) {
      throw new BadRequestException("Restoran identifikatori noto'g'ri.");
    }
    if (severity !== undefined && severity !== "warning" && severity !== "error") {
      throw new BadRequestException("Diagnostika darajasi noto'g'ri.");
    }
    return this.prisma.platformSiteDiagnostic.findMany({
      where: {
        ...(normalizedSiteId ? { siteId: normalizedSiteId } : {}),
        ...(severity ? { severity } : {}),
        occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true, siteId: true, externalId: true, service: true, code: true,
        severity: true, occurredAt: true, receivedAt: true,
        site: { select: { name: true, productCode: true } },
      },
    });
  }

  async listRecentEvents(limit = 50, siteId?: string, state = "all") {
    const normalizedSiteId = siteId?.trim();
    if (siteId !== undefined && (!normalizedSiteId || normalizedSiteId.length > 80)) {
      throw new BadRequestException("Restoran identifikatori noto'g'ri.");
    }
    if (state !== "all" && state !== "open" && state !== "acknowledged") {
      throw new BadRequestException("Hodisa holati noto'g'ri.");
    }
    const where: Prisma.PlatformSiteEventWhereInput = {
      ...(normalizedSiteId ? { siteId: normalizedSiteId } : {}),
      ...(state === "open" ? { acknowledgedAt: null, code: { in: [...actionablePlatformEvents] } } : {}),
      ...(state === "acknowledged" ? { acknowledgedAt: { not: null } } : {}),
    };
    return this.prisma.platformSiteEvent.findMany({
      ...(Object.keys(where).length ? { where } : {}),
      orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        siteId: true,
        code: true,
        branchId: true,
        branchName: true,
        occurredAt: true,
        receivedAt: true,
        acknowledgedAt: true,
        acknowledgedById: true,
        acknowledgedBy: { select: { displayName: true, email: true, phone: true } },
        site: { select: { name: true, productCode: true } },
      },
    });
  }

  async listPlatformAudit(limit = 50, offset = 0, query?: string) {
    const normalizedQuery = query?.trim().slice(0, 100);
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const where: Prisma.AuditLogWhereInput = {
      action: { startsWith: "PLATFORM_" },
      entity: { in: ["PLATFORM_SITE", "PLATFORM_SITE_EVENT"] },
      ...(normalizedQuery
        ? {
            OR: [
              { action: { contains: normalizedQuery, mode: "insensitive" } },
              { entityId: { contains: normalizedQuery, mode: "insensitive" } },
              {
                user: {
                  is: {
                    OR: [
                      { displayName: { contains: normalizedQuery, mode: "insensitive" } },
                      { email: { contains: normalizedQuery, mode: "insensitive" } },
                      { phone: { contains: normalizedQuery, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const entries = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: Math.min(Math.max(offset, 0), 1_000_000),
      take: pageSize + 1,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, email: true, phone: true } },
      },
    });
    return { entries: entries.slice(0, pageSize), hasNext: entries.length > pageSize };
  }

  async listPlatformReports(days = 14, siteId?: string) {
    if (days !== 7 && days !== 14) throw new BadRequestException("Hisobot davri 7 yoki 14 kun bo'lishi kerak.");
    const normalizedSiteId = siteId?.trim();
    if (siteId !== undefined && (!normalizedSiteId || normalizedSiteId.length > 80)) {
      throw new BadRequestException("Restoran identifikatori noto'g'ri.");
    }
    const sites = await this.prisma.platformSite.findMany({
      where: { isActive: true, ...(normalizedSiteId ? { id: normalizedSiteId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, productCode: true, lastHeartbeatAt: true, lastHeartbeatData: true },
    });
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
    const fromDay = cutoff.toISOString().slice(0, 10);
    const now = Date.now();
    const dayTotals = new Map<string, { completedOrders: number; cancelledOrders: number; completedOrderTotal: number }>();
    const siteReports = sites.map((site) => {
      const snapshot = site.lastHeartbeatData && typeof site.lastHeartbeatData === "object" && !Array.isArray(site.lastHeartbeatData)
        ? site.lastHeartbeatData as Record<string, unknown>
        : {};
      const rawReports = Array.isArray(snapshot.dailyReports) ? snapshot.dailyReports : [];
      const reports = rawReports.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as Record<string, unknown>;
        if (typeof item.day !== "string" || item.day < fromDay || !/^\d{4}-\d{2}-\d{2}$/.test(item.day)) return [];
        if (!Number.isInteger(item.completedOrders) || !Number.isInteger(item.cancelledOrders)) return [];
        const amount = typeof item.completedOrderTotal === "string" ? Number(item.completedOrderTotal) : Number.NaN;
        if (!Number.isFinite(amount) || amount < 0) return [];
        return [{ day: item.day, completedOrders: item.completedOrders as number, cancelledOrders: item.cancelledOrders as number, completedOrderTotal: amount }];
      });
      for (const report of reports) {
        const total = dayTotals.get(report.day) ?? { completedOrders: 0, cancelledOrders: 0, completedOrderTotal: 0 };
        total.completedOrders += report.completedOrders;
        total.cancelledOrders += report.cancelledOrders;
        total.completedOrderTotal += report.completedOrderTotal;
        dayTotals.set(report.day, total);
      }
      return {
        siteId: site.id,
        name: site.name,
        productCode: site.productCode,
        lastHeartbeatAt: site.lastHeartbeatAt?.toISOString() ?? null,
        stale: !site.lastHeartbeatAt || now - site.lastHeartbeatAt.getTime() > heartbeatGraceMs,
        reports,
      };
    });
    const daysList = Array.from({ length: days }, (_, index) => {
      const date = new Date(cutoff);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const daily = daysList.map((day) => ({
      day,
      ...(dayTotals.get(day) ?? { completedOrders: 0, cancelledOrders: 0, completedOrderTotal: 0 }),
    }));
    return {
      days,
      timezone: "UTC",
      daily,
      sites: siteReports,
      generatedAt: new Date(now).toISOString(),
    };
  }

  async acknowledgeEvent(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.platformSiteEvent.findUnique({
        where: { id },
        select: {
          id: true, siteId: true, code: true, acknowledgedAt: true, acknowledgedById: true,
          acknowledgedBy: { select: { displayName: true, email: true, phone: true } },
          site: { select: { name: true } },
        },
      });
      if (!event) throw new NotFoundException("Hodisa topilmadi.");
      if (!actionablePlatformEvents.has(event.code)) {
        throw new BadRequestException("Faqat hal qilinishi kerak bo'lgan nosozlikni tasdiqlash mumkin.");
      }
      if (event.acknowledgedAt) {
        return {
          id: event.id,
          acknowledgedAt: event.acknowledgedAt.toISOString(),
          acknowledgedById: event.acknowledgedById,
          acknowledgedBy: event.acknowledgedBy,
        };
      }

      const acknowledgedAt = new Date();
      const changed = await tx.platformSiteEvent.updateMany({
        where: { id, acknowledgedAt: null },
        data: { acknowledgedAt, acknowledgedById: actor.id },
      });
      if (!changed.count) {
        const latest = await tx.platformSiteEvent.findUniqueOrThrow({
          where: { id },
          select: {
            id: true, acknowledgedAt: true, acknowledgedById: true,
            acknowledgedBy: { select: { displayName: true, email: true, phone: true } },
          },
        });
        return {
          id: latest.id,
          acknowledgedAt: latest.acknowledgedAt?.toISOString() ?? null,
          acknowledgedById: latest.acknowledgedById,
          acknowledgedBy: latest.acknowledgedBy,
        };
      }

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "PLATFORM_EVENT_ACKNOWLEDGED",
        entity: "PLATFORM_SITE_EVENT",
        entityId: id,
        metadata: { siteId: event.siteId, siteName: event.site.name, code: event.code },
      });
      return {
        id,
        acknowledgedAt: acknowledgedAt.toISOString(),
        acknowledgedById: actor.id,
        acknowledgedBy: { displayName: null, email: actor.email ?? null, phone: actor.phone ?? null },
      };
    });
  }

  async receiveHeartbeat(siteKey: string, token: string | undefined, heartbeat: PlatformHeartbeatDto) {
    if (!token || token.length < 32 || token.length > 200) {
      throw new UnauthorizedException("Monitoring token noto'g'ri.");
    }
    const site = await this.prisma.platformSite.findUnique({ where: { siteKey } });
    if (!site || !site.isActive || !sameToken(token, site.tokenHash)) {
      throw new UnauthorizedException("Monitoring token noto'g'ri yoki bekor qilingan.");
    }

    const receivedAt = new Date();
    const snapshot = {
      version: heartbeat.version,
      status: heartbeat.status,
      services: heartbeat.services,
      totals: heartbeat.totals,
      lastActivityAt: heartbeat.lastActivityAt,
      kitchens: heartbeat.kitchens,
      dailyReports: heartbeat.dailyReports ?? [],
      backup: heartbeat.backup ?? null,
    };
    const payload = JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.platformSite.updateMany({
        where: { id: site.id, isActive: true, tokenHash: site.tokenHash },
        data: {
          lastHeartbeatAt: receivedAt,
          lastHeartbeatStatus: heartbeat.status,
          lastHeartbeatData: payload,
        },
      });
      if (!updated.count) {
        throw new UnauthorizedException("Monitoring token noto'g'ri yoki bekor qilingan.");
      }

      const events = heartbeat.events.map((event) => ({
        siteId: site.id,
        externalId: event.id,
        code: event.code,
        branchId: event.branchId?.trim() || null,
        branchName: event.branchName?.trim() || null,
        occurredAt: new Date(event.occurredAt),
      }));
      if (events.length) {
        await tx.platformSiteEvent.createMany({ data: events, skipDuplicates: true });
      }

      const diagnostics = (heartbeat.diagnostics ?? []).map((diagnostic) => ({
        siteId: site.id,
        externalId: diagnostic.id,
        service: diagnostic.service,
        code: diagnostic.code,
        severity: diagnostic.severity,
        occurredAt: new Date(diagnostic.occurredAt),
      }));
      if (diagnostics.length) {
        await tx.platformSiteDiagnostic.createMany({ data: diagnostics, skipDuplicates: true });
      }

      const systemEvents = heartbeatTransitionEvents(site, heartbeat.status, receivedAt);
      if (systemEvents.length) {
        await tx.platformSiteEvent.createMany({ data: systemEvents, skipDuplicates: true });
      }
    });
    return { received: true, receivedAt: receivedAt.toISOString() };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredDiagnostics(): Promise<void> {
    await this.prisma.platformSiteDiagnostic.deleteMany({
      where: { occurredAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async probeRegisteredSites(): Promise<void> {
    if (this.probeInProgress) return;
    this.probeInProgress = true;
    try {
      const sites = await this.prisma.platformSite.findMany({
        where: { isActive: true },
        select: {
          id: true,
          websiteUrl: true,
          apiHealthUrl: true,
          websiteStatus: true,
          websiteCheckedAt: true,
          apiStatus: true,
          apiCheckedAt: true,
          createdAt: true,
          lastHeartbeatAt: true,
          lastHeartbeatStatus: true,
        },
      });
      for (let start = 0; start < sites.length; start += 8) {
        await Promise.all(
          sites.slice(start, start + 8).map(async (site) => {
            try {
              const [website, api] = await Promise.all([
                probePublicHttpsUrl(site.websiteUrl),
                probePublicHttpsUrl(site.apiHealthUrl),
              ]);
              const checkedAt = new Date();
              await this.prisma.$transaction(async (tx) => {
                const updated = await tx.platformSite.updateMany({
                  where: {
                    id: site.id,
                    isActive: true,
                    websiteUrl: site.websiteUrl,
                    apiHealthUrl: site.apiHealthUrl,
                    websiteStatus: site.websiteStatus,
                    apiStatus: site.apiStatus,
                    lastHeartbeatAt: site.lastHeartbeatAt,
                  },
                  data: {
                    websiteStatus: website.status,
                    websiteStatusCode: website.statusCode,
                    websiteLatencyMs: website.latencyMs,
                    websiteCheckedAt: checkedAt,
                    websiteError: website.error,
                    apiStatus: api.status,
                    apiStatusCode: api.statusCode,
                    apiLatencyMs: api.latencyMs,
                    apiCheckedAt: checkedAt,
                    apiError: api.error,
                  },
                });
                if (!updated.count) return;
                const events = probeTransitionEvents(site, website.status, api.status, checkedAt);
                if (events.length) {
                  await tx.platformSiteEvent.createMany({ data: events, skipDuplicates: true });
                }
              });
            } catch (error) {
              this.logger.warn(`Monitoring probe failed for site ${site.id}: ${error instanceof Error ? error.message : "unknown error"}`);
            }
          }),
        );
      }
    } finally {
      this.probeInProgress = false;
    }
  }

  async buildLocalHeartbeat(): Promise<PlatformHeartbeatDto> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - onlineDeviceWindowMs);
    let database: "ok" | "error" = "ok";
    try {
      await this.prisma.checkHealth();
    } catch {
      database = "error";
    }

    let kitchens: PlatformHeartbeatDto["kitchens"] = [];
    let totals: PlatformHeartbeatDto["totals"] = {
      branchCount: 0,
      openOrders: 0,
      kitchenQueue: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      deadPrintJobs: 0,
    };
    let events: PlatformHeartbeatDto["events"] = [];
    let dailyReports: NonNullable<PlatformHeartbeatDto["dailyReports"]> = [];
    const backup = await readBackupEvidence(process.env.MAZETTO_BACKUP_STATUS_FILE);

    if (database === "ok") {
      try {
        const reportStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));
        const reportRows = await this.prisma.$queryRaw<Array<{
          day: string;
          completedOrders: number;
          cancelledOrders: number;
          completedOrderTotal: string;
        }>>(Prisma.sql`
          SELECT TO_CHAR(report_day, 'YYYY-MM-DD') AS day,
            SUM(completed_orders)::int AS "completedOrders",
            SUM(cancelled_orders)::int AS "cancelledOrders",
            SUM(completed_total)::text AS "completedOrderTotal"
          FROM (
            SELECT "closedAt"::date AS report_day, COUNT(*) AS completed_orders, 0::bigint AS cancelled_orders,
              COALESCE(SUM("total"), 0) AS completed_total
            FROM "orders"
            WHERE "status" = 'COMPLETED' AND "closedAt" >= ${reportStart}
            GROUP BY "closedAt"::date
            UNION ALL
            SELECT "cancelledAt"::date AS report_day, 0::bigint AS completed_orders, COUNT(*) AS cancelled_orders,
              0::numeric AS completed_total
            FROM "orders"
            WHERE "status" = 'CANCELLED' AND "cancelledAt" >= ${reportStart}
            GROUP BY "cancelledAt"::date
          ) AS daily_order_totals
          GROUP BY report_day
          ORDER BY report_day
        `);
        dailyReports = reportRows.map((row) => ({
          day: row.day,
          completedOrders: Number(row.completedOrders),
          cancelledOrders: Number(row.cancelledOrders),
          completedOrderTotal: row.completedOrderTotal,
        }));
        const [branches, activeOrders, activeTickets, devices, orderActivity, ticketEvents, recentOrderEvents, deadPrintJobs] =
          await Promise.all([
            this.prisma.branch.findMany({
              where: { isActive: true },
              select: { id: true, name: true, isTemporarilyClosed: true, acceptsOrders: true },
              orderBy: { name: "asc" },
            }),
            this.prisma.order.groupBy({
              by: ["branchId"],
              where: { status: { in: [...activeOrderStatuses] } },
              _count: { _all: true },
            }),
            this.prisma.kitchenTicket.findMany({
              where: { status: { in: [...activeKitchenStatuses] } },
              select: {
                status: true,
                updatedAt: true,
                order: { select: { branchId: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 5000,
            }),
            this.prisma.device.findMany({
              where: { isActive: true },
              select: { branchId: true, lastSeenAt: true },
            }),
            this.prisma.order.groupBy({
              by: ["branchId"],
              _max: { updatedAt: true },
            }),
            this.prisma.kitchenTicketEvent.findMany({
              orderBy: { createdAt: "desc" },
              take: 30,
              select: {
                ticketId: true,
                eventType: true,
                version: true,
                createdAt: true,
                ticket: { select: { order: { select: { branch: { select: { id: true, name: true } } } } } },
              },
            }),
            this.prisma.orderStatusHistory.findMany({
              orderBy: { createdAt: "desc" },
              take: 30,
              select: {
                id: true,
                createdAt: true,
                order: { select: { branch: { select: { id: true, name: true } } } },
              },
            }),
            this.prisma.printJob.count({ where: { status: "DEAD_LETTER" } }),
          ]);

        const orderCountByBranch = new Map(
          activeOrders.map((row) => [row.branchId, row._count._all]),
        );
        const ticketCountByBranch = new Map<string, number>();
        const lastTicketActivityByBranch = new Map<string, Date>();
        for (const ticket of activeTickets) {
          const branchId = ticket.order.branchId;
          ticketCountByBranch.set(branchId, (ticketCountByBranch.get(branchId) ?? 0) + 1);
          if (!lastTicketActivityByBranch.has(branchId)) {
            lastTicketActivityByBranch.set(branchId, ticket.updatedAt);
          }
        }
        const deviceCounts = new Map<string, { online: number; offline: number; latest: Date | null }>();
        for (const device of devices) {
          const counts = deviceCounts.get(device.branchId) ?? { online: 0, offline: 0, latest: null };
          const online = device.lastSeenAt !== null && device.lastSeenAt >= staleBefore;
          if (online) counts.online += 1;
          else counts.offline += 1;
          if (device.lastSeenAt && (!counts.latest || device.lastSeenAt > counts.latest)) {
            counts.latest = device.lastSeenAt;
          }
          deviceCounts.set(device.branchId, counts);
        }
        const lastOrderActivity = new Map(orderActivity.map((row) => [row.branchId, row._max.updatedAt]));

        kitchens = branches.map((branch) => {
          const device = deviceCounts.get(branch.id) ?? { online: 0, offline: 0, latest: null };
          const orderAt = lastOrderActivity.get(branch.id) ?? null;
          const ticketAt = lastTicketActivityByBranch.get(branch.id) ?? null;
          const lastActivity = [orderAt, ticketAt].filter((date): date is Date => Boolean(date))
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
          return {
            branchId: branch.id,
            name: branch.name,
            status: branch.acceptsOrders && !branch.isTemporarilyClosed ? "OPEN" : "CLOSED",
            openOrders: orderCountByBranch.get(branch.id) ?? 0,
            kitchenQueue: ticketCountByBranch.get(branch.id) ?? 0,
            onlineDevices: device.online,
            offlineDevices: device.offline,
            lastActivityAt: lastActivity?.toISOString() ?? null,
          };
        });

        const recent = [
          ...recentOrderEvents.map((event) => ({
            id: `order:${event.id}`,
            code: "ORDER_STATUS_CHANGED" as const,
            branchId: event.order.branch.id,
            branchName: event.order.branch.name,
            occurredAt: event.createdAt.toISOString(),
          })),
          ...ticketEvents.map((event) => ({
            id: `kitchen:${event.ticketId}:${event.version}`,
            code: "KITCHEN_TICKET_CHANGED" as const,
            branchId: event.ticket.order.branch.id,
            branchName: event.ticket.order.branch.name,
            occurredAt: event.createdAt.toISOString(),
          })),
        ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 50);
        events = recent;
        totals = {
          branchCount: branches.length,
          openOrders: kitchens.reduce((sum, branch) => sum + branch.openOrders, 0),
          kitchenQueue: kitchens.reduce((sum, branch) => sum + branch.kitchenQueue, 0),
          onlineDevices: kitchens.reduce((sum, branch) => sum + branch.onlineDevices, 0),
          offlineDevices: kitchens.reduce((sum, branch) => sum + branch.offlineDevices, 0),
          deadPrintJobs,
        };
      } catch {
        database = "error";
        kitchens = [];
        events = [];
        dailyReports = [];
      }
    }

    const redisClient = this.redis.getClient();
    const redis: "ok" | "degraded" = redisClient?.status === "ready" ? "ok" : "degraded";
    return {
      version: "0.1.0",
      status: database === "ok" && redis === "ok" ? "healthy" : "degraded",
      services: { backend: "ok", database, redis },
      totals,
      lastActivityAt: kitchens
        .map((branch) => branch.lastActivityAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
      kitchens,
      events,
      dailyReports,
      backup,
    };
  }

  private normalizeProductCode(value: string): string {
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
    if (normalized.length < 2 || normalized.length > 32) {
      throw new ConflictException("Loyiha kodi 2–32 belgidan iborat bo'lishi kerak.");
    }
    return normalized;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
