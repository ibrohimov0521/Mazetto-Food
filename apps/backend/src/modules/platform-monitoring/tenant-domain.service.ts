import { resolveTxt } from "node:dns/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreateTenantDomainDto } from "./dto/platform-monitoring.dto";

const recordPrefix = "bestteam-domain-verification=";

export function normalizeTenantHostname(input: string): string {
  const value = input.trim().replace(/\.$/, "");
  const hostname = domainToASCII(value).toLowerCase();
  const labels = hostname.split(".");
  if (
    !hostname || hostname.length > 230 || isIP(hostname) || labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new BadRequestException("Ommaviy va yaroqli domen nomini kiriting.");
  }
  return hostname;
}

function challengeName(hostname: string): string {
  return `_bestteam-verify.${hostname}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function matchesTokenHash(token: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isMissingTxt(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["ENODATA", "ENOTFOUND", "NXDOMAIN"].includes(String((error as { code: unknown }).code));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

@Injectable()
export class NodeDnsTxtResolver {
  resolve(hostname: string): Promise<string[][]> {
    return resolveTxt(hostname);
  }
}

@Injectable()
export class TenantDomainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dns: NodeDnsTxtResolver,
  ) {}

  async create(tenantId: string, dto: CreateTenantDomainDto, actor: AuthenticatedUser) {
    const hostname = normalizeTenantHostname(dto.hostname);
    const token = randomBytes(32).toString("base64url");

    try {
      const domain = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.restaurantTenant.findUnique({ where: { id: tenantId }, select: { id: true } });
        if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
        const created = await tx.tenantDomain.create({
          data: { hostname, tenantId, verificationTokenHash: hashToken(token) },
          select: { id: true, hostname: true, status: true, verifiedAt: true, createdAt: true },
        });
        await writeAuditLog(tx, {
          userId: actor.id,
          action: "PLATFORM_TENANT_DOMAIN_CREATED",
          entity: "TENANT_DOMAIN",
          entityId: created.id,
          metadata: { tenantId, hostname },
        });
        return created;
      });
      return {
        domain,
        dnsRecord: {
          type: "TXT" as const,
          name: challengeName(hostname),
          value: `${recordPrefix}${token}`,
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("Bu domen allaqachon ro'yxatdan o'tgan.");
      throw error;
    }
  }

  async verify(tenantId: string, domainId: string, actor: AuthenticatedUser) {
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
      select: { id: true, hostname: true, status: true, verifiedAt: true, verificationTokenHash: true },
    });
    if (!domain) throw new NotFoundException("Tenant domeni topilmadi.");
    if (domain.status === "VERIFIED") return { verified: true, status: domain.status, verifiedAt: domain.verifiedAt };
    if (domain.status !== "PENDING" || !domain.verificationTokenHash) {
      throw new ConflictException("Domen uchun faol tasdiqlash yozuvi yo'q.");
    }

    let records: string[][];
    try {
      records = await this.dns.resolve(challengeName(domain.hostname));
    } catch (error) {
      if (isMissingTxt(error)) return { verified: false, status: "PENDING" as const, verifiedAt: null };
      throw new ServiceUnavailableException("DNS TXT yozuvini hozir tekshirib bo'lmadi.");
    }
    const verified = records.some((chunks) => {
      const value = chunks.join("");
      return value.startsWith(recordPrefix) && matchesTokenHash(value.slice(recordPrefix.length), domain.verificationTokenHash!);
    });
    if (!verified) return { verified: false, status: "PENDING" as const, verifiedAt: null };

    const verifiedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantDomain.updateMany({
        where: { id: domain.id, tenantId, status: "PENDING", verificationTokenHash: domain.verificationTokenHash },
        data: { status: "VERIFIED", verifiedAt, verificationTokenHash: null },
      });
      if (updated.count !== 1) throw new ConflictException("Domen holati o'zgargan; sahifani yangilab qayta tekshiring.");
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "PLATFORM_TENANT_DOMAIN_VERIFIED",
        entity: "TENANT_DOMAIN",
        entityId: domain.id,
        metadata: { tenantId, hostname: domain.hostname },
      });
      return { verified: true, status: "VERIFIED" as const, verifiedAt };
    });
  }

  async rotateChallenge(tenantId: string, domainId: string, actor: AuthenticatedUser) {
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
      select: { id: true, hostname: true, status: true },
    });
    if (!domain) throw new NotFoundException("Tenant domeni topilmadi.");
    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantDomain.updateMany({
        where: { id: domain.id, tenantId, status: domain.status },
        data: { status: "PENDING", verifiedAt: null, verificationTokenHash: hashToken(token) },
      });
      if (updated.count !== 1) throw new ConflictException("Domen holati o'zgargan; sahifani yangilab qayta urinib ko'ring.");
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "PLATFORM_TENANT_DOMAIN_CHALLENGE_ROTATED",
        entity: "TENANT_DOMAIN",
        entityId: domain.id,
        metadata: { tenantId, hostname: domain.hostname },
      });
    });
    return {
      dnsRecord: { type: "TXT" as const, name: challengeName(domain.hostname), value: `${recordPrefix}${token}` },
    };
  }

  async disable(tenantId: string, domainId: string, actor: AuthenticatedUser) {
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
      select: { id: true, hostname: true, status: true },
    });
    if (!domain) throw new NotFoundException("Tenant domeni topilmadi.");
    if (domain.status === "DISABLED") return { id: domain.id, status: domain.status };
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantDomain.updateMany({
        where: { id: domain.id, tenantId, status: domain.status },
        data: { status: "DISABLED", verifiedAt: null, verificationTokenHash: null },
      });
      if (updated.count !== 1) throw new ConflictException("Domen holati o'zgargan; sahifani yangilab qayta urinib ko'ring.");
      await writeAuditLog(tx, {
        userId: actor.id,
        action: "PLATFORM_TENANT_DOMAIN_DISABLED",
        entity: "TENANT_DOMAIN",
        entityId: domain.id,
        metadata: { tenantId, hostname: domain.hostname },
      });
    });
    return { id: domain.id, status: "DISABLED" as const };
  }
}
