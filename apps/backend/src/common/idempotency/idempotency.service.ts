import { ConflictException, Injectable } from "@nestjs/common";
import {
  IdempotencyRequestStatus,
  Prisma,
  type IdempotencyRequest,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type IdempotencyDb = Pick<Prisma.TransactionClient, "idempotencyRequest">;

export type StartIdempotencyInput = {
  scope: string;
  key: string;
  requestHash: string;
  correlationId: string;
  actorId?: string;
  expiresAt: Date;
};

export type IdempotencyDecision =
  | { kind: "CLAIMED"; record: IdempotencyRequest }
  | { kind: "REPLAY"; record: IdempotencyRequest };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async start(
    input: StartIdempotencyInput,
    db: IdempotencyDb = this.prisma,
  ): Promise<IdempotencyDecision> {
    try {
      const record = await db.idempotencyRequest.create({ data: input });
      return { kind: "CLAIMED", record };
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
    }

    const existing = await db.idempotencyRequest.findUnique({
      where: { scope_key: { scope: input.scope, key: input.key } },
    });

    if (!existing) {
      throw new ConflictException(
        "Idempotency request collision could not be resolved",
      );
    }
    if (existing.requestHash !== input.requestHash) {
      throw new ConflictException(
        "Idempotency key was already used with a different request",
      );
    }
    if (existing.status !== IdempotencyRequestStatus.IN_PROGRESS) {
      return { kind: "REPLAY", record: existing };
    }

    const now = new Date();
    if (existing.expiresAt <= now) {
      const reclaimed = await db.idempotencyRequest.updateMany({
        where: {
          id: existing.id,
          status: IdempotencyRequestStatus.IN_PROGRESS,
          expiresAt: { lte: now },
        },
        data: {
          correlationId: input.correlationId,
          ...(input.actorId ? { actorId: input.actorId } : {}),
          expiresAt: input.expiresAt,
        },
      });

      if (reclaimed.count === 1) {
        const record = await db.idempotencyRequest.findUniqueOrThrow({
          where: { id: existing.id },
        });
        return { kind: "CLAIMED", record };
      }
    }

    throw new ConflictException(
      "The same idempotent request is still in progress",
    );
  }

  async complete(
    id: string,
    result: {
      requestHash: string;
      responseStatus: number;
      responseBody: Prisma.InputJsonValue;
      resourceType?: string;
      resourceId?: string;
    },
    db: IdempotencyDb = this.prisma,
  ): Promise<void> {
    const updated = await db.idempotencyRequest.updateMany({
      where: {
        id,
        requestHash: result.requestHash,
        status: IdempotencyRequestStatus.IN_PROGRESS,
      },
      data: {
        status: IdempotencyRequestStatus.COMPLETED,
        responseStatus: result.responseStatus,
        responseBody: result.responseBody,
        ...(result.resourceType ? { resourceType: result.resourceType } : {}),
        ...(result.resourceId ? { resourceId: result.resourceId } : {}),
        completedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException("Idempotency request is no longer claimable");
    }
  }

  async fail(
    id: string,
    requestHash: string,
    failureCode: string,
    db: IdempotencyDb = this.prisma,
  ): Promise<void> {
    await db.idempotencyRequest.updateMany({
      where: {
        id,
        requestHash,
        status: IdempotencyRequestStatus.IN_PROGRESS,
      },
      data: {
        status: IdempotencyRequestStatus.FAILED,
        failureCode,
        completedAt: new Date(),
      },
    });
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
