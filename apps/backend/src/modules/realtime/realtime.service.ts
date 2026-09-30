import { BadRequestException, Injectable } from "@nestjs/common";
import { resolveRestaurantScope } from "../../common/auth/tenant-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";

type EventCursor = { createdAt: string; id: string };
type BranchRevisionCursor = {
  version: 2;
  branches: Record<string, string>;
  lastBranchId?: string;
};

@Injectable()
export class RealtimeService {
  constructor(private readonly prisma: PrismaService) {}

  async catchUp(
    cursor: string | undefined,
    requestedBranchId: string | undefined,
    requestedLimit: string | undefined,
    user: AuthenticatedUser,
  ) {
    const scope = await resolveRestaurantScope(
      this.prisma,
      user,
      requestedBranchId,
    );
    const branchIds = scope.branchId
      ? [scope.branchId]
      : (
          await this.prisma.branch.findMany({
            where: { tenantId: scope.tenantId },
            select: { id: true },
          })
        ).map((branch) => branch.id);
    const revisionCursor = decodeBranchRevisionCursor(cursor);
    const limit = clampLimit(requestedLimit);
    if (revisionCursor && branchIds.length > 500) {
      throw new BadRequestException(
        "Filiallar soni realtime cursor chegarasidan oshdi; filialni tanlang.",
      );
    }
    if (revisionCursor) {
      return this.catchUpByBranchRevision(revisionCursor, branchIds, limit);
    }
    const decoded = decodeEventCursor(cursor);
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        branchId: { in: branchIds },
        ...(decoded
          ? {
              OR: [
                { createdAt: { gt: new Date(decoded.createdAt) } },
                {
                  createdAt: new Date(decoded.createdAt),
                  id: { gt: decoded.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;
    const last = page.at(-1);

    return {
      events: page.map((event) => ({
        id: event.id,
        branchId: event.branchId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAt: event.createdAt.toISOString(),
      })),
      cursor: last
        ? encodeEventCursor(last.createdAt, last.id)
        : (cursor ?? null),
      hasMore,
    };
  }
  private async catchUpByBranchRevision(
    cursor: BranchRevisionCursor,
    branchIds: string[],
    limit: number,
  ) {
    const unauthorizedBranches = [
      ...Object.keys(cursor.branches),
      ...(cursor.lastBranchId ? [cursor.lastBranchId] : []),
    ].filter((branchId) => !branchIds.includes(branchId));
    if (unauthorizedBranches.length > 0) {
      throw new BadRequestException(
        "Realtime cursor filial doirasiga mos emas.",
      );
    }

    const positions = Object.fromEntries(
      branchIds.map((branchId) => [branchId, cursor.branches[branchId] ?? "0"]),
    );
    const orderedBranchIds = [...branchIds];
    const lastIndex = orderedBranchIds.indexOf(cursor.lastBranchId ?? "");
    if (lastIndex >= 0) {
      orderedBranchIds.push(...orderedBranchIds.splice(0, lastIndex + 1));
    }
    const batches = await Promise.all(
      orderedBranchIds.map((branchId) =>
        this.prisma.outboxEvent.findMany({
          where: {
            branchId,
            branchRevision: { gt: BigInt(positions[branchId] ?? "0") },
          },
          orderBy: { branchRevision: "asc" },
          take: limit + 1,
        }),
      ),
    );

    const candidates: (typeof batches)[number][number][] = [];
    for (let offset = 0; candidates.length < limit + 1; offset += 1) {
      let foundAtOffset = false;
      for (const batch of batches) {
        const event = batch[offset];
        if (!event) continue;
        candidates.push(event);
        foundAtOffset = true;
        if (candidates.length === limit + 1) break;
      }
      if (!foundAtOffset) break;
    }

    const hasMore = candidates.length > limit;
    const page = candidates.slice(0, limit);
    let lastBranchId = cursor.lastBranchId;
    for (const event of page) {
      if (event.branchId && event.branchRevision !== null) {
        positions[event.branchId] = event.branchRevision.toString();
        lastBranchId = event.branchId;
      }
    }

    return {
      events: page.map((event) => ({
        id: event.id,
        branchId: event.branchId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAt: event.createdAt.toISOString(),
      })),
      cursor: encodeBranchRevisionCursor(positions, lastBranchId),
      hasMore,
    };
  }
}

export function encodeEventCursor(createdAt: Date, id: string): string {
  const value: EventCursor = { createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeEventCursor(
  value: string | undefined,
): EventCursor | null {
  if (!value) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<EventCursor>;
    if (
      typeof decoded.createdAt !== "string" ||
      Number.isNaN(new Date(decoded.createdAt).getTime()) ||
      typeof decoded.id !== "string" ||
      !decoded.id
    ) {
      throw new Error("invalid cursor");
    }
    return {
      createdAt: new Date(decoded.createdAt).toISOString(),
      id: decoded.id,
    };
  } catch {
    throw new BadRequestException("Realtime cursor noto'g'ri.");
  }
}

export function encodeBranchRevisionCursor(
  branches: Record<string, bigint | string>,
  lastBranchId?: string,
): string {
  const cursor: BranchRevisionCursor = {
    version: 2,
    branches: Object.fromEntries(
      Object.entries(branches)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([branchId, revision]) => [branchId, revision.toString()]),
    ),
    ...(lastBranchId ? { lastBranchId } : {}),
  };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeBranchRevisionCursor(
  value: string | undefined,
): BranchRevisionCursor | null {
  if (!value) return null;
  if (value.length > 65_536) {
    throw new BadRequestException("Realtime cursor juda katta.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { version?: unknown }).version !== 2
  ) {
    return null;
  }

  const branches = (parsed as { branches?: unknown }).branches;
  if (
    !branches ||
    typeof branches !== "object" ||
    Array.isArray(branches) ||
    Object.keys(branches).length > 500
  ) {
    throw new BadRequestException("Realtime cursor noto'g'ri.");
  }

  const normalized: Record<string, string> = {};
  const lastBranchId = (parsed as { lastBranchId?: unknown }).lastBranchId;
  if (lastBranchId !== undefined && typeof lastBranchId !== "string") {
    throw new BadRequestException("Realtime cursor noto'g'ri.");
  }
  for (const [branchId, revision] of Object.entries(branches)) {
    if (
      !branchId ||
      typeof revision !== "string" ||
      !/^\d{1,19}$/.test(revision) ||
      BigInt(revision) > 9_223_372_036_854_775_807n
    ) {
      throw new BadRequestException("Realtime cursor noto'g'ri.");
    }
    normalized[branchId] = BigInt(revision).toString();
  }
  return {
    version: 2,
    branches: normalized,
    ...(lastBranchId ? { lastBranchId } : {}),
  };
}

function clampLimit(value: string | undefined): number {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(250, Math.floor(parsed)));
}
