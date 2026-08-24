import { Injectable } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

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
export class KitchenGateway {
  @WebSocketServer()
  private readonly server!: Server;

  emitOrderCreated(payload: unknown): void {
    this.server.emit("order.created", payload);
  }

  emitOrderConfirmed(payload: unknown): void {
    this.server.emit("order.confirmed", payload);
  }

  emitOrderSentToKitchen(payload: unknown): void {
    this.server.emit("order.sent_to_kitchen", payload);
  }

  emitOrderStatusChanged(payload: unknown): void {
    this.server.emit("order.status_changed", payload);
  }
}
