"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "../lib/api";
import { useCart, type CustomerSession } from "../lib/cart";
import { hapticTap } from "./motion-primitives";

type CustomerAuthDelivery = {
  status: "SENT" | "TELEGRAM_LINK_REQUIRED" | "PENDING_INTEGRATION" | string;
  message: string;
  botUrl?: string;
};

export function CustomerAuthPanel({
  description = "Telefon raqamingizni kiriting, keyin MAZETTO Telegram boti yuborgan kodni tasdiqlang.",
  onAuthenticated,
  title = "Telefon orqali kirish",
}: {
  description?: string;
  onAuthenticated?: () => void;
  title?: string;
}) {
  const { customer, setCustomer, showToast } = useCart();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [telegramBotUrl, setTelegramBotUrl] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  async function requestCode() {
    setRequestingCode(true);
    setMessage(null);

    try {
      const result = await apiFetch<{ challenge: { phone: string; expiresAt: string }; delivery: CustomerAuthDelivery }>("/customer/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setPendingVerification(true);
      setCode("");
      setTelegramBotUrl(result.delivery.botUrl ?? null);

      if (result.delivery.status === "TELEGRAM_LINK_REQUIRED") {
        setMessage("Telefon raqamingiz Telegram botga ulanmagan. Botga o'tib /start bosing, telefon raqamingizni yuboring va shu sahifaga qayting.");
        return;
      }

      if (result.delivery.status === "PENDING_INTEGRATION") {
        setMessage("Telegram orqali kod yuborish hozircha sozlanmagan. Keyinroq qayta urinib ko'ring.");
        return;
      }

      setMessage(result.delivery.message || "Tasdiqlash kodi Telegram orqali yuborildi.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Kod yuborib bo'lmadi.";
      setMessage(text);
      showToast("Kod yuborilmadi");
    } finally {
      setRequestingCode(false);
    }
  }

  async function verifyCode() {
    setVerifyingCode(true);
    setMessage(null);

    try {
      const result = await apiFetch<{ customer: Omit<CustomerSession, "accessToken" | "refreshToken" | "tokenType">; tokens: Pick<CustomerSession, "accessToken" | "refreshToken" | "tokenType"> }>("/customer/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ name, phone, code }),
      });
      setCustomer({ ...result.customer, ...result.tokens });
      setPendingVerification(false);
      setCode("");
      setTelegramBotUrl(null);
      hapticTap([14, 30, 14]);
      showToast("Telefon tasdiqlandi");
      onAuthenticated?.();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Kodni tasdiqlab bo'lmadi.";
      setMessage(text.includes("expired") || text.includes("Invalid") ? "Kod noto'g'ri yoki muddati tugagan. Qayta kod oling." : text);
      showToast("Kod tasdiqlanmadi");
    } finally {
      setVerifyingCode(false);
    }
  }

  if (customer?.accessToken) {
    return (
      <div className="mf-card-soft p-4">
        <p className="text-sm font-black text-[#17314A]">Profil ulangan</p>
        <p className="mt-1 text-sm font-semibold text-[#17314A]/62">{customer.name} · {customer.phone}</p>
        <Link className="pressable ripple mf-button-secondary mt-4 inline-flex px-4 py-3 text-sm font-black" href="/orders">
          Buyurtmalarim
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div>
        <h2 className="text-2xl font-black text-[#17314A]">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#17314A]/64">{description}</p>
      </div>
      <input className="mf-input px-4 py-3" placeholder="Ismingiz" value={name} onChange={(event) => setName(event.target.value)} />
      <input className="mf-input px-4 py-3" inputMode="tel" placeholder="+998 telefon raqam" value={phone} onChange={(event) => setPhone(event.target.value)} />
      {pendingVerification ? (
        <>
          <input className="mf-input px-4 py-3" inputMode="numeric" maxLength={6} placeholder="Telegram tasdiqlash kodi" value={code} onChange={(event) => setCode(event.target.value)} />
          <button className="pressable ripple mf-button-primary px-5 py-4 font-black disabled:opacity-50" disabled={!phone || !code || verifyingCode} onClick={() => void verifyCode()} type="button">
            {verifyingCode ? "Tekshirilmoqda..." : "Kodni tasdiqlash"}
          </button>
          {telegramBotUrl ? (
            <Link className="pressable ripple mf-button-secondary rounded-2xl px-5 py-4 text-center font-black" href={telegramBotUrl} target="_blank">
              Telegram botga o'tish
            </Link>
          ) : null}
          <button className="pressable ripple mf-button-secondary px-5 py-3 text-sm font-black disabled:opacity-50" disabled={!phone || requestingCode} onClick={() => void requestCode()} type="button">
            {requestingCode ? "Yuborilmoqda..." : "Kodni qayta yuborish"}
          </button>
        </>
      ) : (
        <button className="pressable ripple mf-button-primary px-5 py-4 font-black disabled:opacity-50" disabled={!phone || requestingCode} onClick={() => void requestCode()} type="button">
          {requestingCode ? "Yuborilmoqda..." : "Kod olish"}
        </button>
      )}
      {message ? <p className="mf-surface-note rounded-2xl px-4 py-3 text-sm font-bold">{message}</p> : null}
    </div>
  );
}
