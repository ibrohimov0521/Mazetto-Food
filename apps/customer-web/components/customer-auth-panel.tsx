"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useCart, type CustomerSession } from "../lib/cart";
import { hapticTap } from "./motion-primitives";
import { PhoneInput, nationalPhoneValue } from "./phone-input";

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
  const [phone, setPhone] = useState(nationalPhoneValue(customer?.phone ?? ""));
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [telegramBotUrl, setTelegramBotUrl] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  /*
   * `expiresAt` server javobida BOR edi, lekin hech qayerda
   * ko'rsatilmasdi: mijoz kodning qancha amal qilishini bilmasdi va
   * "Qayta yuborish" ni cheklovsiz bosib, har bosishda yangi kod
   * yaratardi (eskisi esa bekor bo'lardi).
   */
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resendAt, setResendAt] = useState<number | null>(null);
  const codeField = useRef<HTMLInputElement | null>(null);

  async function requestCode() {
    if (requestingCode || phone.length !== 9) return;
    setRequestingCode(true);
    setMessage(null);

    try {
      const result = await apiFetch<{
        challenge: { phone: string; expiresAt: string };
        delivery: CustomerAuthDelivery;
      }>("/customer/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone: "+998" + phone }),
      });
      setPendingVerification(true);
      setCode("");
      setTelegramBotUrl(result.delivery.botUrl ?? null);
      const expiry = Date.parse(result.challenge.expiresAt);
      setExpiresAt(Number.isFinite(expiry) ? expiry : null);
      // 30 soniya — server yangi kod yaratishidan oldingi eng qisqa oraliq.
      setResendAt(Date.now() + 30_000);

      if (result.delivery.status === "TELEGRAM_LINK_REQUIRED") {
        setMessage(
          "Telefon raqamingiz Telegram botga ulanmagan. Botga o'tib /start bosing, telefon raqamingizni yuboring va shu sahifaga qayting.",
        );
        return;
      }

      if (result.delivery.status === "PENDING_INTEGRATION") {
        setPendingVerification(false);
        setMessage(
          "Telegram orqali kod yuborish hozircha sozlanmagan. Keyinroq qayta urinib ko'ring.",
        );
        return;
      }

      setMessage(
        result.delivery.message || "Tasdiqlash kodi Telegram orqali yuborildi.",
      );
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Kod yuborib bo'lmadi.";
      setMessage(text);
      showToast("Kod yuborilmadi");
    } finally {
      setRequestingCode(false);
    }
  }

  async function verifyCode() {
    if (verifyingCode || phone.length !== 9) return;
    setVerifyingCode(true);
    setMessage(null);

    try {
      const result = await apiFetch<{
        customer: Omit<
          CustomerSession,
          "accessToken" | "refreshToken" | "tokenType"
        >;
        tokens: Pick<
          CustomerSession,
          "accessToken" | "refreshToken" | "tokenType"
        >;
      }>("/customer/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ name, phone: "+998" + phone, code }),
      });
      setCustomer({ ...result.customer, ...result.tokens });
      setPendingVerification(false);
      setCode("");
      setTelegramBotUrl(null);
      setExpiresAt(null);
      setResendAt(null);
      hapticTap([14, 30, 14]);
      showToast("Telefon tasdiqlandi");
      onAuthenticated?.();
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Kodni tasdiqlab bo'lmadi.";
      setMessage(
        text.includes("expired") || text.includes("Invalid")
          ? "Kod noto'g'ri yoki muddati tugagan. Qayta kod oling."
          : text,
      );
      showToast("Kod tasdiqlanmadi");
    } finally {
      setVerifyingCode(false);
    }
  }

  /*
   * Soat FAQAT sanoq ketayotganda ishlaydi — aks holda panel har
   * soniyada bekorga qayta chizilardi.
   */
  useEffect(() => {
    if (!pendingVerification || (!expiresAt && !resendAt)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendingVerification, expiresAt, resendAt]);

  /*
   * Kod maydoniga AVTOMATIK fokus. Ilgari kod yuborilgandan keyin
   * fokus joyida qolardi va mijoz maydonni o'zi qidirishga majbur edi.
   */
  useEffect(() => {
    if (pendingVerification) codeField.current?.focus();
  }, [pendingVerification]);

  const expiresInSeconds = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 1000))
    : null;
  const resendInSeconds = resendAt
    ? Math.max(0, Math.ceil((resendAt - now) / 1000))
    : 0;

  if (customer?.accessToken) {
    return (
      <div className="mf-card-soft p-4">
        <p className="text-sm font-black text-[#17314A]">Profil ulangan</p>
        <p className="mt-1 text-sm font-semibold text-[#586B7D]">
          {customer.name} · {customer.phone}
        </p>
        <Link
          className="pressable ripple mf-button-secondary mt-4 inline-flex px-4 py-3 text-sm font-black"
          href="/orders"
        >
          Buyurtmalarim
        </Link>
      </div>
    );
  }

  return (
    /*
     * `<form>` ATAYLAB: ilgari bu oddiy `<div>` edi, shuning uchun
     * Enter bosilganda hech narsa yuborilmasdi — mijoz sichqoncha bilan
     * tugmani bosishga majbur edi va klaviatura bilan ishlash buzilgan
     * edi. `onSubmit` qaysi qadamdaligiga qarab to'g'ri amalni chaqiradi.
     */
    <form
      className="grid min-w-0 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (pendingVerification) void verifyCode();
        else void requestCode();
      }}
    >
      <div>
        <h2 className="text-2xl font-black text-[#17314A]">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#586B7D]">
          {description}
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        Ismingiz
        <input
          autoComplete="name"
          className="mf-input px-4 py-3"
          placeholder="Ismingiz"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <PhoneInput
        value={phone}
        disabled={requestingCode || verifyingCode}
        onChange={(value) => {
          setPhone(value);
          setPendingVerification(false);
          setCode("");
          setMessage(null);
          setTelegramBotUrl(null);
          setExpiresAt(null);
          setResendAt(null);
        }}
      />
      {pendingVerification ? (
        <>
          <input
            aria-label="Telegram tasdiqlash kodi"
            autoComplete="one-time-code"
            className="mf-input px-4 py-3"
            inputMode="numeric"
            maxLength={6}
            placeholder="Telegram tasdiqlash kodi"
            ref={codeField}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          {expiresInSeconds !== null ? (
            <p
              role="status"
              className="text-xs font-bold text-[#586B7D]"
            >
              {expiresInSeconds > 0
                ? `Kod ${expiresInSeconds} soniya amal qiladi`
                : "Kod muddati tugadi. Yangi kod oling."}
            </p>
          ) : null}
          <button
            className="pressable ripple mf-button-primary px-5 py-4 font-black disabled:opacity-50"
            disabled={phone.length !== 9 || !code || verifyingCode}
            type="submit"
          >
            {verifyingCode ? "Tekshirilmoqda..." : "Kodni tasdiqlash"}
          </button>
          {telegramBotUrl ? (
            <Link
              className="pressable ripple mf-button-secondary rounded-2xl px-5 py-4 text-center font-black"
              href={telegramBotUrl}
              target="_blank"
            >
              Telegram botga o'tish
            </Link>
          ) : null}
          {/*
            Qayta yuborish CHEKLANGAN: har bosish serverda yangi kod
            yaratadi va eskisini bekor qiladi, ya'ni tez-tez bosish
            mijozning o'z kodini ishlamas holga keltirardi.
          */}
          <button
            className="pressable ripple mf-button-secondary px-5 py-3 text-sm font-black disabled:opacity-50"
            disabled={
              phone.length !== 9 || requestingCode || resendInSeconds > 0
            }
            onClick={() => void requestCode()}
            type="button"
          >
            {requestingCode
              ? "Yuborilmoqda..."
              : resendInSeconds > 0
                ? `Qayta yuborish (${resendInSeconds})`
                : "Kodni qayta yuborish"}
          </button>
        </>
      ) : (
        <button
          className="pressable ripple mf-button-primary px-5 py-4 font-black disabled:opacity-50"
          disabled={phone.length !== 9 || requestingCode}
          type="submit"
        >
          {requestingCode ? "Yuborilmoqda..." : "Kod olish"}
        </button>
      )}
      {message ? (
        <p
          role="status"
          className="mf-surface-note rounded-xl px-4 py-3 text-sm font-bold"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
