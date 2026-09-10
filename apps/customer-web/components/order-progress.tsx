"use client";

import { Bike, ChefHat, CircleCheck, ClipboardCheck, PackageCheck, ReceiptText, ShoppingBag, CircleHelp, CircleX } from "lucide-react";
import { trackingLabel, trackingStatus, type TrackedOrder } from "../lib/order-tracking";
import styles from "./order-progress.module.css";

const steps = [
  { status: "NEW", label: "Yangi", icon: ReceiptText },
  { status: "CONFIRMED", label: "Qabul qilindi", icon: ClipboardCheck },
  { status: "PREPARING", label: "Oshxonada", icon: ChefHat },
  { status: "READY", label: "Tayyor", icon: PackageCheck },
  { status: "SERVED", label: "Topshirildi", icon: ShoppingBag },
  { status: "COMPLETED", label: "Yakun", icon: CircleCheck },
];

export function OrderProgress({ value }: { value: TrackedOrder }) {
  const status = trackingStatus(value);
  const delivery = value.type === "DELIVERY";
  const index = steps.findIndex(step => step.status === status);
  const Icon = status === "CANCELLED" ? CircleX : status === "SERVED" && delivery ? Bike : steps[index]?.icon ?? CircleHelp;
  const descriptions: Record<string, string> = {
    NEW: "Buyurtmangiz qabul qilinishini kutmoqda.",
    CONFIRMED: "Buyurtmangiz qabul qilindi. Tez orada tayyorlashni boshlaymiz.",
    PREPARING: "Oshpazlar buyurtmangizni tayyorlashmoqda.",
    READY: delivery ? "Buyurtmangiz tayyor. Kuryerga topshirish kutilmoqda." : "Buyurtmangiz tayyor. Uni filialdan olishingiz mumkin.",
    SERVED: delivery ? "Kuryer buyurtmangiz bilan yo'lga chiqdi." : "Buyurtmangiz topshirildi.",
    COMPLETED: "Yoqimli ishtaha! Bizni tanlaganingiz uchun rahmat.",
    CANCELLED: "Bu buyurtma bekor qilingan.",
  };
  return (
    <section className={styles.progress} aria-label="Buyurtma bosqichlari" data-order-status={status}>
      <div className={styles.current} data-cancelled={status === "CANCELLED"} role="status" aria-live="polite" aria-atomic="true">
        <span className={styles.currentIcon}><Icon size={28} aria-hidden="true" /></span>
        <div><strong>{trackingLabel(status, value.type)}</strong><p>{descriptions[status] ?? "Buyurtma holati yangilanmoqda."}</p></div>
      </div>
      {index >= 0 && (
        <ol className={styles.steps}>
          {steps.map((step, position) => {
            const StepIcon = step.status === "SERVED" && delivery ? Bike : step.icon;
            const label = step.status === "SERVED" && delivery ? "Kuryer" : step.label;
            return (
              <li key={step.status} aria-current={position === index ? "step" : undefined} data-complete={position < index}>
                <span className={styles.symbol}><StepIcon size={19} aria-hidden="true" /></span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
