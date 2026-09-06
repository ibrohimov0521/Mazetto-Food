import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { PERMISSIONS } from "../../common/auth/permissions";
import type { AuthenticatedCustomer } from "../../common/types/authenticated-customer";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  getCustomerJwtAccessSecret,
  getJwtAccessSecret,
} from "../../config/auth.config";
import { PrismaService } from "../../prisma/prisma.service";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://mazettofood.uz",
  "https://www.mazettofood.uz",
  "https://pos.mazettofood.uz",
];

@Injectable()
@WebSocketGateway({
  cors: {
    credentials: true,
    origin: allowedOrigins,
  },
})
export class KitchenGateway implements OnGatewayConnection {
  private readonly logger = new Logger(KitchenGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  private readonly server!: Server;

  async handleConnection(client: Socket): Promise<void> {
    const auth = await this.authenticateSocket(client);

    if (!auth) {
      client.disconnect(true);
      return;
    }

    client.data.mazettoAuth = auth;

    if (auth.kind === "customer") {
      void client.join(this.customerRoom(auth.customerId));
      return;
    }

    if (auth.branchId) {
      void client.join(this.branchRoom(auth.branchId));
    }

    if (auth.global) {
      void client.join(this.globalStaffRoom());
    }
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

  private async authenticateSocket(client: Socket): Promise<RealtimeAuth | null> {
    const token = this.extractToken(client);

    if (!token) {
      return null;
    }

    const tokenType = typeof client.handshake.auth?.tokenType === "string"
      ? client.handshake.auth.tokenType
      : undefined;

    if (tokenType === "customer") {
      return this.authenticateCustomer(token);
    }

    if (tokenType === "staff") {
      return this.authenticateStaff(token);
    }

    return (await this.authenticateStaff(token)) ?? this.authenticateCustomer(token);
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

  private async authenticateCustomer(token: string): Promise<RealtimeAuth | null> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedCustomer>(token, {
        secret: getCustomerJwtAccessSecret(),
      });

      if (payload.tokenUse !== "customer_access") {
        return null;
      }

      return { kind: "customer", customerId: payload.id };
    } catch {
      return null;
    }
  }

  private async authenticateStaff(token: string): Promise<RealtimeAuth | null> {
    let payload: AuthenticatedUser;

    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: getJwtAccessSecret(),
      });
    } catch {
      return null;
    }

    const user = await this.resolveStaffUser(payload.id);

    if (!user || !this.canReceiveOrderEvents(user)) {
      return null;
    }

    return {
      kind: "staff",
      userId: user.id,
      global: user.roles.includes("SUPER_ADMIN") || user.permissions.includes(PERMISSIONS.ALL),
      ...(user.branchId ? { branchId: user.branchId } : {}),
    };
  }

  private async resolveStaffUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        isActive: true,
        employee: {
          select: {
            id: true,
            branchId: true,
            status: true,
          },
        },
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  select: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.isActive) {
      return null;
    }

    return {
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      ...(user.employee?.status === "ACTIVE"
        ? { employeeId: user.employee.id, branchId: user.employee.branchId }
        : {}),
      roles: user.roles.map((userRole) => userRole.role.code),
      permissions: user.roles.flatMap((userRole) =>
        userRole.role.permissions.map((rolePermission) => rolePermission.permission.code),
      ),
    };
  }

  private canReceiveOrderEvents(user: AuthenticatedUser): boolean {
    return (
      user.permissions.includes(PERMISSIONS.ALL) ||
      user.permissions.includes(PERMISSIONS.KITCHEN_VIEW) ||
      user.permissions.includes(PERMISSIONS.ORDER_VIEW) ||
      user.permissions.includes(PERMISSIONS.TABLE_VIEW)
    );
  }

  private emitSafely(event: OrderRealtimeEvent, payload: unknown): void {
    void this.emitScopedOrderEvent(event, payload).catch((error: unknown) => {
      this.logger.warn(`Skipped ${event}: ${error instanceof Error ? error.message : "unknown realtime error"}`);
    });
  }

  private async emitScopedOrderEvent(event: OrderRealtimeEvent, payload: unknown): Promise<void> {
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

    this.server.to([...rooms]).emit(event, this.toRealtimePayload(payload, scope));
  }

  private async resolveEventScope(payload: unknown): Promise<OrderEventScope> {
    const fallbackBranchId = this.readString(payload, "branchId") ??
      this.readString(payload, "order.branchId") ??
      this.readString(payload, "order.branch.id") ??
      this.readString(payload, "ticket.order.branchId");
    const orderId = this.readString(payload, "order.id") ??
      this.readString(payload, "orderId") ??
      this.readString(payload, "ticket.orderId") ??
      this.readString(payload, "ticket.order.id") ??
      this.readString(payload, "id");

    if (orderId) {
      return this.resolveOrderScope(orderId, fallbackBranchId);
    }

    const ticketId = this.readString(payload, "ticket.id") ?? this.readString(payload, "id");

    if (ticketId) {
      return this.resolveTicketScope(ticketId, fallbackBranchId);
    }

    return { branchId: fallbackBranchId ?? null, customerId: null };
  }

  private async resolveOrderScope(orderId: string, fallbackBranchId?: string): Promise<OrderEventScope> {
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

  private async resolveTicketScope(ticketId: string, fallbackBranchId?: string): Promise<OrderEventScope> {
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

  private toRealtimePayload(payload: unknown, scope: OrderEventScope): OrderRealtimePayload {
    const action = this.readString(payload, "action");
    const status = this.readString(payload, "order.status") ?? this.readString(payload, "status");
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

  private branchRoom(branchId: string): string {
    return `branch:${branchId}`;
  }

  private globalStaffRoom(): string {
    return "staff:global";
  }
}

type RealtimeAuth =
  | { kind: "customer"; customerId: string }
  | { kind: "staff"; userId: string; branchId?: string; global: boolean };

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
