"use client";
import { useLocale, useTranslations } from "next-intl";

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
  const locale = useLocale();
  const t = useTranslations("Customer");
  const status = trackingStatus(value);
  const delivery = value.type === "DELIVERY";
  const index = steps.findIndex(step => step.status === status);
  const Icon = status === "CANCELLED" ? CircleX : status === "SERVED" && delivery ? Bike : steps[index]?.icon ?? CircleHelp;
  const descriptions: Record<string, string> = locale === "ru" ? {
    NEW: "Заказ ожидает подтверждения.",
    CONFIRMED: "Заказ принят. Скоро начнём готовить.",
    PREPARING: "Повара готовят ваш заказ.",
    READY: delivery ? "Заказ готов и ожидает передачи курьеру." : "Заказ готов. Его можно забрать в филиале.",
    SERVED: delivery ? "Курьер уже в пути с вашим заказом." : "Заказ выдан.",
    COMPLETED: "Приятного аппетита! Спасибо, что выбрали нас.",
    CANCELLED: "Этот заказ отменён.",
  } : {
    NEW: "Buyurtmangiz qabul qilinishini kutmoqda.",
    CONFIRMED: "Buyurtmangiz qabul qilindi. Tez orada tayyorlashni boshlaymiz.",
    PREPARING: "Oshpazlar buyurtmangizni tayyorlashmoqda.",
    READY: delivery ? "Buyurtmangiz tayyor. Kuryerga topshirish kutilmoqda." : "Buyurtmangiz tayyor. Uni filialdan olishingiz mumkin.",
    SERVED: delivery ? "Kuryer buyurtmangiz bilan yo'lga chiqdi." : "Buyurtmangiz topshirildi.",
    COMPLETED: "Yoqimli ishtaha! Bizni tanlaganingiz uchun rahmat.",
    CANCELLED: "Bu buyurtma bekor qilingan.",
  };
  const stepLabels: Record<string, string> = locale === "ru" ? {
    NEW: "Новый", CONFIRMED: "Принят", PREPARING: "На кухне", READY: "Готов", SERVED: "Выдан", COMPLETED: "Завершён",
  } : {};
  return (
    <section className={styles.progress} aria-label={t("buyurtma_bosqichlari_93ff8b5e")} data-order-status={status}>
      <div className={styles.current} data-cancelled={status === "CANCELLED"} role="status" aria-live="polite" aria-atomic="true">
        <span className={styles.currentIcon}><Icon size={28} aria-hidden="true" /></span>
        <div><strong>{trackingLabel(status, value.type, locale)}</strong><p>{descriptions[status] ?? t("buyurtma_holati_yangilanmoqda_b92fff76")}</p></div>
      </div>
      {index >= 0 && (
        <ol className={styles.steps}>
          {steps.map((step, position) => {
            const StepIcon = step.status === "SERVED" && delivery ? Bike : step.icon;
            const label = locale === "ru" ? step.status === "SERVED" && delivery ? "Курьер" : stepLabels[step.status] ?? step.label : step.status === "SERVED" && delivery ? "Kuryer" : step.label;
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
