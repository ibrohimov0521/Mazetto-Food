import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { PERMISSIONS } from "../../common/auth/permissions";
import { resolveSoleActiveTenantId } from "../../common/auth/tenant-scope";
import { TenantRequestContextService } from "../../common/tenant/tenant-request-context.service";
import type { AuthenticatedCustomer } from "../../common/types/authenticated-customer";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  getCustomerJwtAccessSecret,
  getJwtAccessSecret,
} from "../../config/auth.config";
import { resolveAllowedOrigins } from "../../config/cors.config";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantMembershipAuthService } from "../auth/tenant-membership-auth.service";

@Injectable()
@WebSocketGateway({
  cors: {
    credentials: true,
    origin: resolveAllowedOrigins(),
  },
})
export class KitchenGateway implements OnGatewayConnection {
  private readonly logger = new Logger(KitchenGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly tenantRequestContext: TenantRequestContextService,
    private readonly tenantMembershipAuth: TenantMembershipAuthService,
  ) {}

  @WebSocketServer()
  private readonly server!: Server;

  async handleConnection(client: Socket): Promise<void> {
    let auth = await this.authenticateSocket(client);

    if (!auth) {
      client.disconnect(true);
      return;
    }

    client.data.mazettoAuth = auth;

    if (auth.kind === "customer") {
      await client.join(this.customerSessionRoom(auth.sessionId));
      const token = this.extractToken(client);
      const revalidated = token
        ? await this.authenticateCustomer(token, this.socketHost(client))
        : null;
      if (
        !revalidated ||
        revalidated.kind !== "customer" ||
        revalidated.customerId !== auth.customerId ||
        revalidated.sessionId !== auth.sessionId ||
        client.disconnected
      ) {
        client.disconnect(true);
        return;
      }
      auth = revalidated;
      client.data.mazettoAuth = auth;
      this.disconnectAtAccessTokenExpiry(client, auth.expiresAt);
      await client.join(this.customerRoom(auth.customerId));
      return;
    }

    if (auth.kind === "staff") {
      await client.join(this.staffUserRoom(auth.userId));
      const token = this.extractToken(client);
      const revalidated = token
        ? await this.authenticateStaff(token, this.socketHost(client))
        : null;
      if (
        !revalidated ||
        revalidated.kind !== "staff" ||
        revalidated.userId !== auth.userId ||
        client.disconnected
      ) {
        client.disconnect(true);
        return;
      }
      auth = revalidated;
      client.data.mazettoAuth = auth;
    }

    this.disconnectAtAccessTokenExpiry(client, auth.expiresAt);

    if (auth.branchId) {
      void client.join(this.branchRoom(auth.branchId));
    }

    if (auth.global) {
      void client.join(this.globalStaffRoom());
    }
  }

  disconnectStaffUser(userId: string): void {
    if (!this.server) return;
    this.server.in(this.staffUserRoom(userId)).disconnectSockets(true);
  }

  disconnectCustomerSession(sessionId: string): void {
    if (!this.server) return;
    this.server.in(this.customerSessionRoom(sessionId)).disconnectSockets(true);
  }

  private disconnectAtAccessTokenExpiry(
    client: Socket,
    expiresAt: number,
  ): void {
    const timer = setTimeout(
      () => client.disconnect(true),
      Math.max(0, expiresAt - Date.now()),
    );
    timer.unref?.();
    client.once?.("disconnect", () => clearTimeout(timer));
  }

  emitOrderCreated(payload: unknown): void {
    this.emitSafely("order.created", payload);
  }

  emitOrderConfirmed(payload: unknown): void {
    this.emitSafely("order.confirmed", payload);
  }

  emitOrderSentToKitchen(payload: unknown): void {
    this.emitSafely("order.sent_to_kitchen", payload);
  }

  emitOrderStatusChanged(payload: unknown): void {
    this.emitSafely("order.status_changed", payload);
  }

  private async authenticateSocket(
    client: Socket,
  ): Promise<RealtimeAuth | null> {
    const token = this.extractToken(client);
    const rawHost = this.socketHost(client);

    if (!token) {
      return null;
    }

    const tokenType =
      typeof client.handshake.auth?.tokenType === "string"
        ? client.handshake.auth.tokenType
        : undefined;

    if (tokenType === "customer") {
      return this.authenticateCustomer(token, rawHost);
    }

    if (tokenType === "staff") {
      return this.authenticateStaff(token, rawHost);
    }

    return (
      (await this.authenticateStaff(token, rawHost)) ??
      this.authenticateCustomer(token, rawHost)
    );
  }

  private socketHost(client: Socket): string | undefined {
    const host = client.handshake.headers.host;
    return typeof host === "string" ? host : undefined;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization !== "string") {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return null;
    }

    return token;
  }

  private async authenticateCustomer(
    token: string,
    rawHost?: string,
  ): Promise<RealtimeAuth | null> {
    try {
      const tenantContext = await this.tenantRequestContext
        .resolve(rawHost)
        .catch(() => null);
      if (!tenantContext || tenantContext.kind === "BLOCKED") return null;

      const payload = await this.jwtService.verifyAsync<
        AuthenticatedCustomer & { exp?: number }
      >(token, {
        secret: getCustomerJwtAccessSecret(),
      });

      if (
        payload.tokenUse !== "customer_access" ||
        typeof payload.sessionId !== "string" ||
        typeof payload.exp !== "number"
      ) {
        return null;
      }

      await resolveSoleActiveTenantId(this.prisma);
      const session = await this.prisma.customerSession.findFirst({
        where: {
          id: payload.sessionId,
          customerId: payload.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!session) return null;

      return {
        kind: "customer",
        customerId: payload.id,
        sessionId: payload.sessionId,
        expiresAt: payload.exp * 1000,
      };
    } catch {
      return null;
    }
  }

  private async authenticateStaff(
    token: string,
    rawHost?: string,
  ): Promise<RealtimeAuth | null> {
    const tenantContext = await this.tenantRequestContext
      .resolve(rawHost)
      .catch(() => null);
    if (!tenantContext || tenantContext.kind !== "TRUSTED") return null;

    let payload: AuthenticatedUser & { exp?: number };
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: getJwtAccessSecret(),
      });
    } catch {
      return null;
    }

    if (typeof payload.exp !== "number") return null;
    if (
      !payload.tenantId ||
      !payload.membershipId ||
      tenantContext.tenantId !== payload.tenantId
    ) {
      return null;
    }

    let user: AuthenticatedUser | null;
    try {
      user = await this.tenantMembershipAuth.resolve(
        payload.id,
        payload.tenantId,
        payload.membershipId,
      );
    } catch {
      return null;
    }

    if (
      !user ||
      (payload.credentialVersion ?? 0) !== (user.credentialVersion ?? 0) ||
      !this.canReceiveOrderEvents(user)
    ) {
      return null;
    }

    const global = Boolean(user.isGlobalScope);

    if (global) {
      try {
        await resolveSoleActiveTenantId(this.prisma);
      } catch {
        return null;
      }
    }

    return {
      kind: "staff",
      userId: user.id,
      global,
      expiresAt: payload.exp * 1000,
      ...(user.branchId ? { branchId: user.branchId } : {}),
    };
  }

  private canReceiveOrderEvents(user: AuthenticatedUser): boolean {
    if (!user.roles.some((role) => !role.startsWith("PLATFORM_"))) {
      return false;
    }

    return (
      user.permissions.includes(PERMISSIONS.ALL) ||
      user.permissions.includes(PERMISSIONS.KITCHEN_VIEW) ||
      user.permissions.includes(PERMISSIONS.ORDER_VIEW) ||
      user.permissions.includes(PERMISSIONS.TABLE_VIEW)
    );
  }

  private emitSafely(event: OrderRealtimeEvent, payload: unknown): void {
    void this.emitScopedOrderEvent(event, payload).catch((error: unknown) => {
      this.logger.warn(
        `Skipped ${event}: ${error instanceof Error ? error.message : "unknown realtime error"}`,
      );
    });
  }

  private async emitScopedOrderEvent(
    event: OrderRealtimeEvent,
    payload: unknown,
  ): Promise<void> {
    const scope = await this.resolveEventScope(payload);

    if (!scope.branchId && !scope.customerId) {
      this.logger.warn(`Skipped ${event}: order scope could not be resolved`);
      return;
    }

    const rooms = new Set<string>();

    if (scope.branchId) {
      rooms.add(this.branchRoom(scope.branchId));
      rooms.add(this.globalStaffRoom());
    }

    if (scope.customerId) {
      rooms.add(this.customerRoom(scope.customerId));
    }

    this.server
      .to([...rooms])
      .emit(event, this.toRealtimePayload(payload, scope));
  }

  private async resolveEventScope(payload: unknown): Promise<OrderEventScope> {
    const fallbackBranchId =
      this.readString(payload, "branchId") ??
      this.readString(payload, "order.branchId") ??
      this.readString(payload, "order.branch.id") ??
      this.readString(payload, "ticket.order.branchId");
    const orderId =
      this.readString(payload, "order.id") ??
      this.readString(payload, "orderId") ??
      this.readString(payload, "ticket.orderId") ??
      this.readString(payload, "ticket.order.id") ??
      this.readString(payload, "id");

    if (orderId) {
      return this.resolveOrderScope(orderId, fallbackBranchId);
    }

    const ticketId =
      this.readString(payload, "ticket.id") ?? this.readString(payload, "id");

    if (ticketId) {
      return this.resolveTicketScope(ticketId, fallbackBranchId);
    }

    return { branchId: fallbackBranchId ?? null, customerId: null };
  }

  private async resolveOrderScope(
    orderId: string,
    fallbackBranchId?: string,
  ): Promise<OrderEventScope> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        branchId: true,
        customerOrder: { select: { customerId: true } },
      },
    });

    return {
      orderId,
      branchId: order?.branchId ?? fallbackBranchId ?? null,
      customerId: order?.customerOrder?.customerId ?? null,
    };
  }

  private async resolveTicketScope(
    ticketId: string,
    fallbackBranchId?: string,
  ): Promise<OrderEventScope> {
    const ticket = await this.prisma.kitchenTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        orderId: true,
        order: {
          select: {
            branchId: true,
            customerOrder: { select: { customerId: true } },
          },
        },
      },
    });

    return {
      ticketId,
      branchId: ticket?.order.branchId ?? fallbackBranchId ?? null,
      customerId: ticket?.order.customerOrder?.customerId ?? null,
      ...(ticket?.orderId ? { orderId: ticket.orderId } : {}),
    };
  }

  private toRealtimePayload(
    payload: unknown,
    scope: OrderEventScope,
  ): OrderRealtimePayload {
    const action = this.readString(payload, "action");
    const status =
      this.readString(payload, "order.status") ??
      this.readString(payload, "status");
    const ticketStatus = this.readString(payload, "ticket.status");

    return {
      ...(scope.orderId ? { orderId: scope.orderId } : {}),
      ...(scope.ticketId ? { ticketId: scope.ticketId } : {}),
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(scope.customerId ? { customerScoped: true } : {}),
      ...(action ? { action } : {}),
      ...(status ? { status } : {}),
      ...(ticketStatus ? { ticketStatus } : {}),
    };
  }

  private readString(value: unknown, path: string): string | undefined {
    let current: unknown = value;

    for (const key of path.split(".")) {
      if (!this.isRecord(current)) {
        return undefined;
      }

      current = current[key];
    }

    return typeof current === "string" && current.trim() ? current : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private customerRoom(customerId: string): string {
    return `customer:${customerId}`;
  }

  private customerSessionRoom(sessionId: string): string {
    return `customer-session:${sessionId}`;
  }

  private branchRoom(branchId: string): string {
    return `branch:${branchId}`;
  }

  private staffUserRoom(userId: string): string {
    return `staff-user:${userId}`;
  }

  private globalStaffRoom(): string {
    return "staff:global";
  }
}

type RealtimeAuth =
  | {
      kind: "customer";
      customerId: string;
      sessionId: string;
      expiresAt: number;
    }
  | {
      kind: "staff";
      userId: string;
      branchId?: string;
      global: boolean;
      expiresAt: number;
    };

type OrderRealtimeEvent =
  | "order.created"
  | "order.confirmed"
  | "order.sent_to_kitchen"
  | "order.status_changed";

type OrderEventScope = {
  orderId?: string;
  ticketId?: string;
  branchId: string | null;
  customerId: string | null;
};

type OrderRealtimePayload = {
  orderId?: string;
  ticketId?: string;
  branchId?: string;
  customerScoped?: boolean;
  action?: string;
  status?: string;
  ticketStatus?: string;
};
