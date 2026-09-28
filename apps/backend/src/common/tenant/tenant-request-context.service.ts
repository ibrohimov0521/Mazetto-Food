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

@Injectable()
export class TenantRequestContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(rawHost?: string): Promise<TenantRequestContext> {
    const hostname = normalizeRequestHostname(rawHost);
    if (!hostname) return { kind: "UNREGISTERED" };

    const domain = await this.prisma.tenantDomain.findUnique({
      where: { hostname },
      select: {
        status: true,
        tenantId: true,
        tenant: { select: { status: true } },
      },
    });

    if (!domain) return { kind: "UNREGISTERED", hostname };
    if (domain.status !== "VERIFIED" || domain.tenant.status !== "ACTIVE") {
      return { kind: "BLOCKED", hostname };
    }
    return { kind: "TRUSTED", hostname, tenantId: domain.tenantId };
  }
}
