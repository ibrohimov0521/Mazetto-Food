import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveBranchScope } from "./access-scope";

export type TenantScopeDatabase = Pick<
  PrismaService,
  "branch" | "restaurantTenant"
>;

export async function resolveSoleActiveTenantId(
  database: TenantScopeDatabase,
): Promise<string> {
  const tenants = await database.restaurantTenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    take: 2,
  });
  const [tenant] = tenants;
  if (tenants.length !== 1 || !tenant) {
    throw new ForbiddenException(
      "Tenant context is required; exactly one active restaurant must be available",
    );
  }
  return tenant.id;
}

export async function resolveRestaurantTenantId(
  database: TenantScopeDatabase,
  actor: AuthenticatedUser,
): Promise<string> {
  if (Boolean(actor.tenantId) !== Boolean(actor.membershipId)) {
    throw new ForbiddenException("Tenant membership context is incomplete");
  }

  if (actor.tenantId) {
    const tenant = await database.restaurantTenant.findFirst({
      where: { id: actor.tenantId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!tenant) {
      throw new ForbiddenException("Authenticated tenant is not active");
    }
    if (actor.branchId) {
      const branch = await database.branch.findFirst({
        where: { id: actor.branchId, tenantId: tenant.id },
        select: { id: true },
      });
      if (!branch) {
        throw new ForbiddenException("Actor branch does not belong to the authenticated tenant");
      }
    }
    resolveBranchScope(actor);
    return tenant.id;
  }

  if (actor.branchId) {
    const branch = await database.branch.findUnique({
      where: { id: actor.branchId },
      select: { tenantId: true },
    });
    if (!branch) {
      throw new ForbiddenException(
        "Actor branch is not available; tenant context cannot be established",
      );
    }
    return branch.tenantId;
  }

  resolveBranchScope(actor);
  return resolveSoleActiveTenantId(database);
}

export async function assertBranchBelongsToActor(
  database: TenantScopeDatabase,
  actor: AuthenticatedUser,
  branchId: string,
): Promise<string> {
  const tenantId = await resolveRestaurantTenantId(database, actor);
  resolveBranchScope(actor, branchId);
  const branch = await database.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { id: true },
  });
  if (!branch) {
    throw new NotFoundException("Branch not found");
  }
  return tenantId;
}

export async function resolveRestaurantScope(
  database: TenantScopeDatabase,
  actor: AuthenticatedUser,
  requestedBranchId?: string,
) {
  const tenantId = await resolveRestaurantTenantId(database, actor);
  const branchId = resolveBranchScope(actor, requestedBranchId);

  if (requestedBranchId) {
    const branch = await database.branch.findFirst({
      where: { id: requestedBranchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  return { tenantId, branchId };
}
