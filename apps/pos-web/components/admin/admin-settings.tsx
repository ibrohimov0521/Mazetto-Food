"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  FormField,
  Icon,
  Modal,
  Skeleton,
  TextInput,
  Toggle,
  useToast,
} from "../admin-ui";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { paymentMethodLabel } from "./people-branch-labels";

/*
 * Biznes sozlamalari ekrani.
 *
 * Boshqaruv elementi QOIDADAN chiziladi, kalit nomidan emas. Backend har
 * sozlama bilan birga uning turini qaytaradi (`rule`), shuning uchun bu ekran
 * qaysi kalitlar borligini BILMAYDI — reestrga yangi sozlama qo'shilsa u
 * shu yerda o'z-o'zidan paydo bo'ladi.
 *
 * ENG MUHIM TUZATISH: MIJOZGA OCHIQ SOZLAMA TASDIQLASHDAN O'TADI.
 *
 * Ilgari mantiqiy sozlama BITTA TEGISHDA saqlanardi. Ular orasida
 * `customer_delivery_enabled` bor — yetkazib berishning kill switch'i. Ya'ni
 * sichqonchani beparvo bosish butun mijoz oqimini o'sha zahoti o'chirib
 * qo'yishi mumkin edi, hech qanday "rostdanmi?" savolisiz va orqaga qaytarish
 * imkoniyati faqat yana bir tegish bo'lardi (bu vaqtda mijozlar checkout'da
 * yetkazishni yo'q deb ko'rardi).
 *
 * Endi qoida: `isPublic` sozlama — mijoz oqimiga darhol ta'sir qiladi, demak
 * u TASDIQLASH oynasidan o'tadi va oyna aynan nima o'zgarayotganini eski va
 * yangi qiymat bilan ko'rsatadi. Ichki cheklovlar (kod muddati, login
 * chegarasi) avvalgidek darhol saqlanadi — ular mijozga ko'rinmaydi.
 */

type SettingRule =
  | { kind: "int"; min: number; max: number; fallback: number }
  | { kind: "bool"; fallback: boolean }
  | { kind: "csv-enum"; values: string[]; fallback: string }
  | { kind: "string"; fallback: string };

type SettingRow = {
  key: string;
  value: string;
  isStored: boolean;
  isPublic: boolean;
  affectsCustomer: boolean;
  rule: SettingRule;
  fallback: string;
};

/*
 * Kalit nomlari — texnik. Ular admin uchun o'zbekcha tavsif bilan
 * ko'rsatiladi; tavsifi yo'q kalit kalitning o'zi bilan chiqadi, ya'ni
 * reestrga qo'shilgan yangi sozlama bu ro'yxat yangilanmaguncha ham
 * ishlayveradi.
 *
 * `impact` — mijozga ochiq sozlamada tasdiqlash oynasida ko'rsatiladigan
 * oqibat. Faqat `isPublic` kalitlar uchun kerak.
 */
const SETTING_LABELS: Record<
  string,
  {
    title: string;
    hint: string;
    impact?: string;
    group?: "cashier-payments" | "kitchen-orders" | "order-numbering";
  }
> = {
  customer_code_ttl_minutes: {
    title: "Tasdiqlash kodi muddati",
    hint: "SMS/Telegram kodi necha daqiqa amal qiladi",
  },
  customer_code_attempt_limit: {
    title: "Kod urinishlari chegarasi",
    hint: "Bitta kod uchun noto'g'ri urinishlar soni",
  },
  customer_code_request_limit: {
    title: "Kod so'rovlari chegarasi",
    hint: "Bir oynada nechta kod so'ralishi mumkin",
  },
  customer_code_request_window_seconds: {
    title: "Kod so'rovi oynasi",
    hint: "Yuqoridagi chegara qaysi oraliqda hisoblanadi (soniya)",
  },
  login_throttle_address_failures: {
    title: "Manzil bo'yicha login chegarasi",
    hint: "Bitta manzil va login uchun nechta xato urinishga ruxsat beriladi",
  },
  login_throttle_identifier_failures: {
    title: "Akkaunt bo'yicha login chegarasi",
    hint: "Bitta akkaunt uchun nechta muvaffaqiyatsiz urinish",
  },
  login_throttle_window_minutes: {
    title: "Login cheklovi oynasi",
    hint: "Urinishlar qaysi oraliqda hisoblanadi (daqiqa)",
  },
  customer_order_attempt_ttl_hours: {
    title: "Checkout urinishi muddati",
    hint: "Tugallanmagan checkout qancha vaqt saqlanadi (soat)",
  },
  telegram_checkout_session_ttl_minutes: {
    title: "Telegram checkout muddati",
    hint: "Telegram'dagi savat sessiyasi qancha yashaydi (daqiqa)",
  },
  telegram_menu_page_size: {
    title: "Telegram menyu sahifasi",
    hint: "Bitta ekranda nechta mahsulot ko'rsatiladi",
  },
  customer_payment_methods: {
    title: "Mijoz checkout to'lovi",
    hint: "Mijoz buyurtmalarida faqat naqd pul qabul qilinadi",
    impact:
      "Mijoz sayti va Telegram buyurtmalarida faqat naqd to'lov mavjud.",
  },
  cashier_payment_methods: {
    title: "Kassada qabul qilinadigan to'lovlar",
    hint: "Hozir faqat naqd pul qabul qilinadi. Naqd usul o'chirilsa, kassa savdosi vaqtincha to'xtaydi.",
    group: "cashier-payments",
  },
  kitchen_pos_orders_enabled: {
    title: "Ichki buyurtmalarni oshxonada ko'rsatish",
    hint: "O'chirilsa, kassa va ofitsiant panelida yaratilgan buyurtmalar oshxona navbati va tarixida ko'rinmaydi. Sayt va Telegram buyurtmalari qoladi. Chop etish sozlamasi o'zgarmaydi: oshxona uchun belgilangan mahsulotlar printerga yuboriladi.",
    group: "kitchen-orders",
  },
  order_display_number_start: {
    title: "Buyurtma raqamining boshlanishi",
    hint: "Har bir buyurtma manbasi va Toshkent kunidagi boshlang'ich raqam. Shu kuni kattaroq raqam ishlatilgan bo'lsa, dublikat bo'lmasligi uchun navbat davom etadi.",
    group: "order-numbering",
  },
  customer_delivery_enabled: {
    title: "Yetkazib berish",
    hint: "Mijoz checkout'da yetkazishni tanlay oladimi",
    impact:
      "O'chirilsa hech bir mijoz yetkazib berishni tanlay olmaydi — faqat olib ketish qoladi. Yoqilsa yetkazish barcha filiallarda darhol ochiladi.",
  },
  customer_delivery_fee: {
    title: "Yetkazish narxi",
    hint: "So'mda. Har qanday buyurtma uchun bir xil. Olib ketishda olinmaydi",
    impact:
      "Yangi narx mijoz savatida darhol ko'rinadi va keyingi buyurtmalarga qo'llanadi.",
  },
  customer_free_delivery_radius_meters: {
    title: "Tekin yetkazish radiusi",
    hint: "Metrda. Shu masofa ichida yetkazish tekin. 0 — tekin zona yo'q",
    impact:
      "Radius ichidagi mijozlar yetkazish narxini to'lamaydi. O'zgarish savatda darhol hisoblanadi.",
  },
};

function settingTitle(key: string): string {
  return SETTING_LABELS[key]?.title ?? key;
}

/**
 * Qiymatni o'qiladigan holga keltiradi — tasdiqlash oynasi va "default"
 * belgisi uchun. Xom `false` yoki `CASH,CARD` admin uchun ma'no tashimaydi.
 */
function describeValue(rule: SettingRule, value: string): string {
  if (rule.kind === "bool") {
    return value === "true" ? "Yoqilgan" : "O'chirilgan";
  }

  if (rule.kind === "csv-enum") {
    const entries = value.split(",").filter(Boolean);

    return entries.length > 0
      ? entries.map(paymentMethodLabel).join(", ")
      : "Bo'sh";
  }

  return value;
}

type PendingChange = {
  key: string;
  value: string;
  title: string;
  before: string;
  after: string;
  impact: string;
};

export function AdminSettings() {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingChange | null>(null);
  const { showToast } = useToast();

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource<SettingRow[]>(
    async () => {
      const rows = await apiFetch<SettingRow[]>("/settings");
      /*
       * Qoralamalar server qiymati bilan qayta moslanadi: saqlashdan keyin
       * server qiymatni NORMALLASHTIRADI ("TRUE" → "true", takrorlangan
       * to'lov usullari olib tashlanadi) va qoralama eskirgan bo'lib qolardi.
       */
      setDrafts(Object.fromEntries(rows.map((row) => [row.key, row.value])));
      return rows;
    },
    [],
    "Sozlamalarni yuklab bo'lmadi.",
  );

  const rows = data ?? [];

  const save = useCallback(
    async (key: string, value: string) => {
      setSavingKey(key);

      try {
        await apiFetch(`/settings/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ value }),
        });
        showToast("Sozlama saqlandi.", "success");
        setPending(null);
        load();
      } catch (caught) {
        if (caught instanceof SessionExpiredError) {
          return;
        }

        // Backend rad etish sababini aniq aytadi (chegara, noma'lum qiymat) —
        // uni o'z matnimiz bilan almashtirmaymiz.
        showToast(
          caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
          "danger",
        );
        setPending(null);
        load();
      } finally {
        setSavingKey(null);
      }
    },
    [load, showToast],
  );

  /**
   * Mijozga ochiq sozlamalar va kassa usulini o'chirish tasdiqlanadi.
   */
  const requestSave = useCallback(
    (row: SettingRow, value: string) => {
      const nextCashierMethods = new Set(
        value.split(",").map((method) => method.trim().toUpperCase()),
      );
      const cashierPaymentOptions =
        row.key === "cashier_payment_methods" && row.rule.kind === "csv-enum"
          ? row.rule.values
          : [];
      const disabledCashierMethods =
        row.key === "cashier_payment_methods" && row.rule.kind === "csv-enum"
          ? row.value
              .split(",")
              .map((method) => method.trim().toUpperCase())
              .filter(
                (method) =>
                  method &&
                  cashierPaymentOptions.includes(method) &&
                  !nextCashierMethods.has(method),
              )
          : [];
      const disablesOfflinePaymentMethod = disabledCashierMethods.length > 0;

      if (!row.affectsCustomer && !disablesOfflinePaymentMethod) {
        void save(row.key, value);
        return;
      }

      setPending({
        key: row.key,
        value,
        title: settingTitle(row.key),
        before: describeValue(row.rule, row.value),
        after: describeValue(row.rule, value),
        impact: disablesOfflinePaymentMethod
          ? `O'chiriladigan usullar: ${disabledCashierMethods.map(paymentMethodLabel).join(", ")}. Oflayn Desktop kassa faqat oxirgi sinxronlangan katalogda naqd yoqilgan bo'lsa naqd savdoni navbatga oladi. Boshqa qurilmadan o'zgartirilgan sozlama offline terminalga internet qaytgach yetib boradi. Saqlashdan oldin kutayotgan Desktop amallarini internet orqali sinxronlang. Oldin yaratilgan navbatdagi amal o'chirilgan usulga bog'liq bo'lsa, usulni qayta yoqib, navbatni sinxronlash kerak bo'ladi.`
          : (SETTING_LABELS[row.key]?.impact ??
            "Bu sozlama mijoz saytida darhol qo'llanadi."),
      });
    },
    [save],
  );

  const groups = useMemo(
    () => ({
      customer: rows.filter((row) => row.affectsCustomer),
      cashierPayments: rows.filter(
        (row) => SETTING_LABELS[row.key]?.group === "cashier-payments",
      ),
      kitchenOrders: rows.filter(
        (row) => SETTING_LABELS[row.key]?.group === "kitchen-orders",
      ),
      orderNumbers: rows.filter(
        (row) => SETTING_LABELS[row.key]?.group === "order-numbering",
      ),
      internal: rows.filter(
        (row) =>
          !row.affectsCustomer &&
          !["cashier-payments", "kitchen-orders", "order-numbering"].includes(
            SETTING_LABELS[row.key]?.group ?? "",
          ),
      ),
    }),
    [rows],
  );

  // Skelet FAQAT birinchi yuklashda — har saqlashdan keyin butun ekran
  // skeletga aylanib, foydalanuvchi joyini yo'qotardi.
  if (isLoading && !data) {
    return (
      <div aria-busy="true" className="grid gap-4">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardBody>
          <p className="text-[13px] text-mz-text-muted">
            Bu qiymatlar darhol qo&apos;llanadi — deploy talab qilmaydi.
            Noto&apos;g&apos;ri qiymat saqlanmaydi: chegara va ruxsat etilgan
            variantlar serverda tekshiriladi.{" "}
            <span className="font-semibold text-mz-text">
              Mijozga ochiq sozlamalar tasdiqlashdan o&apos;tadi
            </span>{" "}
            — ular mijoz checkout&apos;iga o&apos;sha zahoti ta&apos;sir qiladi.
          </p>
        </CardBody>
      </Card>

      <SettingsGroup
        description="Mijoz checkout'ida bevosita ko'rinadi. O'zgartirish tasdiqlanadi."
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={requestSave}
        rows={groups.customer}
        savingKey={savingKey}
        title="Mijozga ta'sir qiladi"
      />

      <SettingsGroup
        description="Internet bor paytda kassir yoqilgan usullardan tanlaydi; Click/Payme va karta tushumini alohida tekshiradi, avtomatik bank tasdig'i yo'q. Oflayn kassa oxirgi sinxronlangan sozlamada ruxsat etilgan naqd savdoni qo'llaydi; boshqa qurilmadagi o'zgarish internet qaytgach olinadi. To'lov usulini o'chirishdan oldin Desktop navbatidagi kutayotgan amallarni sinxronlang."
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={requestSave}
        rows={groups.cashierPayments}
        savingKey={savingKey}
        title="Kassa to'lovlari"
      />

      <SettingsGroup
        description="Yangi raqamlar o'zgarishdan keyin beriladi. Shu Toshkent kunida mavjud bo'lgan kattaroq raqamlar takrorlanmaydi. Desktop oflayn holatda oxirgi sinxronlangan boshlang'ich raqamdan foydalanadi."
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={requestSave}
        rows={groups.orderNumbers}
        savingKey={savingKey}
        title="Buyurtma raqamlari"
      />

      <SettingsGroup
        description="Faqat oshxona monitoridagi ro'yxatni boshqaradi. Chek printerga yuborilishi va kassadagi moliyaviy hisobga ta'sir qilmaydi."
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={requestSave}
        rows={groups.kitchenOrders}
        savingKey={savingKey}
        title="Oshxona buyurtmalari"
      />

      <SettingsGroup
        description="Xavfsizlik chegaralari va xizmat muddatlari — mijozga ko'rinmaydi, darhol saqlanadi."
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={requestSave}
        rows={groups.internal}
        savingKey={savingKey}
        title="Ichki cheklovlar"
      />

      <Modal
        footer={
          <>
            <Button onClick={() => setPending(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={savingKey === pending?.key}
              onClick={() => {
                if (pending) {
                  void save(pending.key, pending.value);
                }
              }}
              size="lg"
              variant="danger"
            >
              Tasdiqlayman va saqlayman
            </Button>
          </>
        }
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `${pending.title} — tasdiqlash` : "Tasdiqlash"}
      >
        {pending ? (
          <div className="grid gap-3">
            <dl className="grid gap-2 rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-[13px] font-semibold text-mz-text-muted">
                  Hozirgi qiymat
                </dt>
                <dd className="text-mz-text">{pending.before}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-[13px] font-semibold text-mz-text-muted">
                  Yangi qiymat
                </dt>
                <dd className="font-semibold text-mz-text">{pending.after}</dd>
              </div>
            </dl>

            <p className="flex items-start gap-2 rounded-mz-control bg-mz-warning-bg px-3 py-2 text-[13px] font-medium text-mz-warning">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" name="alert" />
              {pending.impact}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function SettingsGroup({
  title,
  description,
  rows,
  drafts,
  savingKey,
  onDraftChange,
  onSave,
}: {
  title: string;
  description: string;
  rows: SettingRow[];
  drafts: Record<string, string>;
  savingKey: string | null;
  onDraftChange: (key: string, value: string) => void;
  onSave: (row: SettingRow, value: string) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader description={description} title={title} />
      <CardBody className="space-y-5">
        {rows.map((row) => (
          <SettingControl
            draft={drafts[row.key] ?? row.value}
            key={row.key}
            onChange={(value) => onDraftChange(row.key, value)}
            onSave={(value) => onSave(row, value)}
            row={row}
            saving={savingKey === row.key}
          />
        ))}
      </CardBody>
    </Card>
  );
}

function SettingControl({
  row,
  draft,
  saving,
  onChange,
  onSave,
}: {
  row: SettingRow;
  draft: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}) {
  const label = SETTING_LABELS[row.key];
  const title = settingTitle(row.key);
  const dirty = draft !== row.value;

  if (row.rule.kind === "bool") {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mz-border pb-4 last:border-0 last:pb-0">
        <Toggle
          checked={row.value === "true"}
          disabled={saving}
          {...(label?.hint
            ? {
                description: row.isPublic
                  ? `${label.hint} · o'zgartirish tasdiqlanadi`
                  : label.hint,
              }
            : {})}
          label={title}
          onChange={(checked) => onSave(String(checked))}
        />
        <SettingMeta row={row} />
      </div>
    );
  }

  if (row.rule.kind === "csv-enum") {
    const allowed = row.rule.values;
    const selected = new Set(
      draft
        .split(",")
        .map((option) => option.trim().toUpperCase())
        .filter((option) => allowed.includes(option)),
    );
    const isOnlySelection = selected.size === 1;

    return (
      <div className="border-b border-mz-border pb-4 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-mz-text">{title}</p>
            {label?.hint ? (
              <p className="mt-0.5 text-[13px] text-mz-text-muted">
                {label.hint}
              </p>
            ) : null}
          </div>
          <SettingMeta row={row} />
        </div>

        <div
          aria-label={title}
          className="mt-2 flex flex-wrap gap-2"
          role="group"
        >
          {allowed.map((option) => {
            const isOn = selected.has(option);
            /*
             * Oxirgi yoqilgan usulni o'chirib bo'lmaydi: bo'sh ro'yxat
             * checkout'da hech qanday to'lov usuli qolmasligini bildiradi va
             * server ham buni rad etadi. Ilgari bosish JIMGINA hech narsa
             * qilmasdi — endi tugma o'chirilgan va sababi ko'rsatilgan.
             */
            const blocked = isOn && isOnlySelection;

            return (
              <button
                aria-pressed={isOn}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-mz-pill border px-3.5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  isOn
                    ? "border-mz-accent-strong bg-mz-accent-strong text-mz-white"
                    : "border-mz-border-strong bg-mz-surface text-mz-text-muted hover:bg-mz-surface-sunken hover:text-mz-text"
                }`}
                disabled={saving || blocked}
                key={option}
                onClick={() => {
                  const next = new Set(selected);

                  if (isOn) {
                    next.delete(option);
                  } else {
                    next.add(option);
                  }

                  onChange([...next].join(","));
                }}
                title={
                  blocked
                    ? "Kamida bitta to'lov usuli yoqilgan bo'lishi shart."
                    : undefined
                }
                type="button"
              >
                {isOn ? <Icon className="h-3.5 w-3.5" name="check" /> : null}
                {paymentMethodLabel(option)}
              </button>
            );
          })}
        </div>

        {isOnlySelection ? (
          <p className="mt-2 text-[13px] text-mz-text-muted">
            Kamida bitta to&apos;lov usuli yoqilgan bo&apos;lishi shart, shuning
            uchun oxirgi usul o&apos;chirilmaydi.
          </p>
        ) : null}

        {dirty ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/*
              Qator darajasidagi saqlash — OLTIN emas, to'q teal. Bir vaqtda
              bir nechta sozlama o'zgartirilsa ekranda bir nechta oltin tugma
              paydo bo'lardi, oltin esa sahifaning YAGONA asosiy harakati
              uchun zaxiralangan.
            */}
            <Button
              isLoading={saving}
              onClick={() => onSave(draft)}
              variant="secondary"
            >
              <Icon className="h-4 w-4" name="check" />
              Saqlash
            </Button>
            <Button
              disabled={saving}
              onClick={() => onChange(row.value)}
              variant="ghost"
            >
              Qaytarish
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const range =
    row.rule.kind === "int" ? `${row.rule.min}–${row.rule.max}` : undefined;
  const hint =
    [label?.hint, range ? `Ruxsat etilgan: ${range}` : null]
      .filter(Boolean)
      .join(" · ") || undefined;

  return (
    <div className="border-b border-mz-border pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FormField {...(hint ? { hint } : {})} label={title}>
            {(props) => (
              <div className="flex flex-wrap items-center gap-2">
                <TextInput
                  {...props}
                  className="max-w-40"
                  disabled={saving}
                  inputMode={row.rule.kind === "int" ? "numeric" : "text"}
                  onChange={(event) => onChange(event.target.value)}
                  {...(row.rule.kind === "int"
                    ? {
                        max: row.rule.max,
                        min: row.rule.min,
                        type: "number",
                      }
                    : {})}
                  value={draft}
                />
                {dirty ? (
                  <>
                    <Button
                      isLoading={saving}
                      onClick={() => onSave(draft)}
                      variant="secondary"
                    >
                      Saqlash
                    </Button>
                    <Button
                      disabled={saving}
                      onClick={() => onChange(row.value)}
                      variant="ghost"
                    >
                      Qaytarish
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </FormField>
        </div>
        <SettingMeta row={row} />
      </div>
    </div>
  );
}

/**
 * Sozlama saqlanganmi yoki hali default'dami.
 *
 * Bu farq admin uchun muhim: "default" degani qiymat kodda emas, reestrda
 * e'lon qilingan va uni o'zgartirsa baza qatoriga aylanadi.
 */
function SettingMeta({ row }: { row: SettingRow }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {row.isPublic ? <Badge tone="info">Mijozga ochiq</Badge> : null}
      {row.isStored ? (
        <Badge tone="success">O&apos;zgartirilgan</Badge>
      ) : (
        <Badge tone="neutral">
          Standart: {describeValue(row.rule, row.fallback)}
        </Badge>
      )}
    </div>
  );
}
