import { BadRequestException, Injectable } from "@nestjs/common";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";

type EventCursor = { createdAt: string; id: string };

@Injectable()
export class RealtimeService {
  constructor(private readonly prisma: PrismaService) {}

  async catchUp(
    cursor: string | undefined,
    requestedBranchId: string | undefined,
    requestedLimit: string | undefined,
    user: AuthenticatedUser,
  ) {
    const branchId = resolveBranchScope(user, requestedBranchId);
    const decoded = decodeEventCursor(cursor);
    const limit = clampLimit(requestedLimit);
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
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
      cursor: last ? encodeEventCursor(last.createdAt, last.id) : cursor ?? null,
      hasMore,
    };
  }
}

export function encodeEventCursor(createdAt: Date, id: string): string {
  const value: EventCursor = { createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeEventCursor(value: string | undefined): EventCursor | null {
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
    return { createdAt: new Date(decoded.createdAt).toISOString(), id: decoded.id };
  } catch {
    throw new BadRequestException("Realtime cursor noto'g'ri.");
  }
}

function clampLimit(value: string | undefined): number {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(250, Math.floor(parsed)));
}