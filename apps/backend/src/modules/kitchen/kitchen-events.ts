import { EventEmitter } from "node:events";
import type { KitchenStaffAction } from "./kitchen.service";

export type KitchenOrderStatusChangedEvent = {
  action: KitchenStaffAction | "refresh";
  orderId: string;
};

export const kitchenEvents = new EventEmitter();
export const kitchenOrderStatusChangedEvent = "kitchen.order_status_changed";
