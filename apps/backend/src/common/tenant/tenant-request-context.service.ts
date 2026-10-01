import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeTenantHostname } from "./tenant-hostname";

export type TenantRequestContext =
  | { kind: "UNREGISTERED"; hostname?: string }
  | { kind: "BLOCKED"; hostname: string }
  | { kind: "TRUSTED"; hostname: string; tenantId: string };

export function normalizeRequestHostname(rawHost?: string): string | null {
  if (!rawHost || rawHost.length > 260) return null;
  const authority = rawHost.trim();
  if (!authority || /[\s,/@\\]/.test(authority)) return null;
  const match = authority.match(/^([^:]+)(?::([0-9]{1,5}))?$/);
  if (!match || (match[2] && Number(match[2]) > 65535)) return null;
  try {
    return normalizeTenantHostname(match[1]!);
  } catch {
    return null;
  }
}

function isInternalServiceAuthority(rawHost?: string): boolean {
  if (!rawHost || rawHost.length > 260) return false;
  const match = rawHost
    .trim()
    .match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?::([0-9]{1,5}))?$/i);
  return Boolean(match && (!match[2] || Number(match[2]) <= 65535));
}

@Injectable()
export class TenantRequestContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    rawHost?: string,
    forwardedHost?: string,
  ): Promise<TenantRequestContext> {
    const hostname = normalizeRequestHostname(rawHost);
    if (hostname) return this.resolveHostname(hostname);

    // Next.js rewrites proxy /api requests to the backend's internal service
    // hostname and supplies the browser-facing host in X-Forwarded-Host.
    // Only accept that header when the direct Host is a single-label service
    // authority; public API hosts always resolve from Host itself.
    if (isInternalServiceAuthority(rawHost)) {
      const originalHostname = normalizeRequestHostname(forwardedHost);
      if (originalHostname) return this.resolveHostname(originalHostname);
    }

    return { kind: "UNREGISTERED" };
  }

  private async resolveHostname(
    hostname: string,
  ): Promise<TenantRequestContext> {
    const labels = hostname.split(".");
    const candidates = labels
      .map((_, index) => labels.slice(index).join("."))
      .filter((candidate) => candidate.split(".").length >= 2);
    const domains = await this.prisma.tenantDomain.findMany({
      where: { hostname: { in: candidates } },
      select: {
        hostname: true,
        status: true,
        tenantId: true,
        tenant: { select: { status: true } },
      },
    });
    const domainsByHostname = new Map(
      domains.map((domain) => [domain.hostname, domain]),
    );

    // A verified root domain also covers its app subdomains (www, api, pos).
    // A more-specific domain record wins and can explicitly block inheritance.
    for (const candidate of candidates) {
      const domain = domainsByHostname.get(candidate);
      if (!domain) continue;
      if (domain.status !== "VERIFIED" || domain.tenant.status !== "ACTIVE") {
        return { kind: "BLOCKED", hostname };
      }
      return { kind: "TRUSTED", hostname, tenantId: domain.tenantId };
    }
    return { kind: "UNREGISTERED", hostname };
  }
}
