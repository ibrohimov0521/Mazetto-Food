import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { normalizeTenantHostname } from "../../common/tenant/tenant-hostname";
import { isTenantFeatureCode, TENANT_FEATURES, type TenantFeatureCode } from "../../common/tenant/tenant-feature-catalog";
import { normalizeCustomerPhone } from "../customers/customer-phone";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreatePlatformTenantOnboardingDto } from "./dto/create-platform-tenant-onboarding.dto";

const domainRecordPrefix = "bestteam-domain-verification=";

function normalizeOwnerLogin(login: string): { email?: string; phone?: string } {
  const value = login.trim();
  if (value.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException("Owner uchun to‘g‘ri email yoki telefon kiriting.");
    return { email: value.toLowerCase() };
  }
  try { return { phone: normalizeCustomerPhone(value) }; }
  catch { throw new BadRequestException("Owner uchun to‘g‘ri email yoki telefon kiriting."); }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

@Injectable()
export class PlatformTenantProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async provision(dto: CreatePlatformTenantOnboardingDto, actor: AuthenticatedUser) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const ownerName = dto.ownerName.trim();
    const login = normalizeOwnerLogin(dto.ownerLogin);
    const branchCode = dto.branchCode.trim().toUpperCase();
    const branchName = dto.branchName.trim();
    const subdomain = dto.subdomain.trim().toLowerCase();
    const hostname = normalizeTenantHostname(subdomain + ".mazetto.uz");
    const enabledCodes = [...new Set(dto.enabledFeatureCodes)];

    if (!/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/.test(code)) throw new BadRequestException("Restoran kodi 2-32 ta harf yoki raqamdan iborat bo‘lsin.");
    if (name.length < 2 || name.length > 120) throw new BadRequestException("Restoran nomi 2-120 ta belgidan iborat bo‘lsin.");
    if (ownerName.length < 2 || ownerName.length > 120) throw new BadRequestException("Owner ismi 2-120 ta belgidan iborat bo‘lsin.");
    if (dto.ownerPassword.length < 12) throw new BadRequestException("Owner paroli kamida 12 ta belgidan iborat bo‘lsin.");
    if (!/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/.test(branchCode)) throw new BadRequestException("Filial kodi 2-32 ta harf yoki raqamdan iborat bo‘lsin.");
    if (branchName.length < 2 || branchName.length > 120) throw new BadRequestException("Filial nomi 2-120 ta belgidan iborat bo‘lsin.");
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/.test(subdomain)) throw new BadRequestException("Subdomen faqat kichik lotin harfi, raqam va tire ishlatsin.");
    if (new Set(["admin", "api", "www", "pos", "mail", "ftp", "cdn", "static", "status"]).has(subdomain)) throw new BadRequestException("Bu subdomen tizim uchun band.");
    if (enabledCodes.some((feature) => !isTenantFeatureCode(feature))) throw new BadRequestException("Noma’lum restoran funksiyasi tanlandi.");
    if (enabledCodes.length !== dto.enabledFeatureCodes.length) throw new BadRequestException("Bir xil funksiyani takroran yubormang.");
    const featureSet = new Set(enabledCodes as TenantFeatureCode[]);
    if (featureSet.has("WEB_ORDERS") && !featureSet.has("CUSTOMER_WEB")) throw new BadRequestException("Saytdan buyurtma uchun mijozlar sayti ham yoqilgan bo‘lishi kerak.");
    if (featureSet.has("TV_DISPLAY") && !featureSet.has("KITCHEN_DISPLAY")) throw new BadRequestException("Televizor rejimi uchun oshxona paneli ham yoqilgan bo‘lishi kerak.");
    const requestedFeatures = new Set<TenantFeatureCode>(enabledCodes as TenantFeatureCode[]);

    const passwordHash = await hash(dto.ownerPassword, 12);
    const domainToken = randomBytes(32).toString("base64url");
    const verificationTokenHash = createHash("sha256").update(domainToken).digest("hex");

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [duplicateOwner, ownerRole] = await Promise.all([
          tx.user.findFirst({
            where: { OR: [...(login.email ? [{ email: login.email }] : []), ...(login.phone ? [{ phone: login.phone }] : [])] },
            select: { id: true },
          }),
          tx.role.findUnique({ where: { code: "SUPER_ADMIN" }, select: { id: true, isActive: true, isBranchScoped: true } }),
        ]);
        if (duplicateOwner) throw new ConflictException("Bu owner emaili yoki telefoni allaqachon ro‘yxatdan o‘tgan.");
        if (!ownerRole?.isActive || ownerRole.isBranchScoped) throw new ServiceUnavailableException("Restoran SUPER_ADMIN roli sozlanmagan; yangi restoran ochilmadi.");

        const tenant = await tx.restaurantTenant.create({
          data: {
            code, name, phone: dto.phone?.trim() || null, email: dto.email?.trim().toLowerCase() || null,
            address: dto.address?.trim() || null, legalName: dto.legalName?.trim() || null,
            taxId: dto.taxId?.trim() || null, status: "PROVISIONING",
          },
          select: { id: true, code: true, name: true, phone: true, email: true, address: true, legalName: true, taxId: true, status: true, createdAt: true, updatedAt: true },
        });
        const owner = await tx.user.create({
          data: { ...login, displayName: ownerName, passwordHash, isActive: true },
          select: { id: true, displayName: true, email: true, phone: true },
        });
        const branch = await tx.branch.create({
          data: {
            tenantId: tenant.id, code: branchCode, name: branchName,
            address: dto.branchAddress?.trim() || dto.address?.trim() || null,
            phone: dto.branchPhone?.trim() || dto.phone?.trim() || null,
            isActive: false, acceptsOrders: false, deliveryEnabled: false, pickupEnabled: false,
          },
          select: { id: true, code: true, name: true, address: true, phone: true, isActive: true, acceptsOrders: true },
        });
        const membership = await tx.tenantMembership.create({
          data: {
            tenantId: tenant.id, userId: owner.id, status: "ACTIVE",
            roles: { create: { roleId: ownerRole.id, assignedById: actor.id } },
          },
          select: { id: true },
        });
        await tx.tenantFeature.createMany({
          data: TENANT_FEATURES.map((feature) => ({
            tenantId: tenant.id, code: feature.code, isEnabled: requestedFeatures.has(feature.code),
          })),
        });
        const domain = await tx.tenantDomain.create({
          data: { hostname, tenantId: tenant.id, verificationTokenHash },
          select: { id: true, hostname: true, status: true, verifiedAt: true },
        });
        await writeAuditLog(tx, {
          tenantId: tenant.id, userId: actor.id, action: "PLATFORM_TENANT_ONBOARDED",
          entity: "RESTAURANT_TENANT", entityId: tenant.id,
          metadata: { tenantId: tenant.id, ownerUserId: owner.id, membershipId: membership.id, branchId: branch.id, hostname, enabledFeatureCodes: [...requestedFeatures], status: tenant.status },
        });
        return {
          tenant, owner, branch, domain,
          dnsRecord: {
            type: "TXT" as const,
            name: "_bestteam-verify." + hostname,
            value: domainRecordPrefix + domainToken,
          },
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("Restoran kodi, filial kodi, owner login yoki domen allaqachon band.");
      throw error;
    }
  }
}
