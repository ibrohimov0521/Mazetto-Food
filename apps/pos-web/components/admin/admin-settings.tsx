"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  FormField,
  Icon,
  SkeletonRows,
  TextInput,
  Toggle,
  useToast,
} from "../admin-ui";
import { apiFetch } from "../../lib/api";

/*
 * Biznes sozlamalari ekrani (7-bosqich Q1.3).
 *
 * Boshqaruv elementi QOIDADAN chiziladi, kalit nomidan emas. Backend har
 * sozlama bilan birga uning turini qaytaradi (`rule`), shuning uchun bu ekran
 * qaysi kalitlar borligini BILMAYDI — reestrga yangi sozlama qo'shilsa u
 * shu yerda o'z-o'zidan paydo bo'ladi.
 *
 * Buni frontendda qaytadan e'lon qilish reestr yechayotgan drift muammosini
 * qaytarardi: bu safar backend bilan UI orasida.
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
  rule: SettingRule;
  fallback: string;
};

/*
 * Kalit nomlari — texnik. Ular admin uchun o'zbekcha tavsif bilan
 * ko'rsatiladi; tavsifi yo'q kalit kalitning o'zi bilan chiqadi, ya'ni
 * reestrga qo'shilgan yangi sozlama bu ro'yxat yangilanmaguncha ham
 * ishlayveradi.
 */
const SETTING_LABELS: Record<string, { title: string; hint: string }> = {
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
    hint: "Bitta manzildan nechta muvaffaqiyatsiz urinish",
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
    hint: "Tugallanmagan checkout qancha vaqt saqlanadi",
  },
  telegram_checkout_session_ttl_minutes: {
    title: "Telegram checkout muddati",
    hint: "Telegram'dagi savat sessiyasi qancha yashaydi",
  },
  telegram_menu_page_size: {
    title: "Telegram menyu sahifasi",
    hint: "Bitta ekranda nechta mahsulot ko'rsatiladi",
  },
  customer_payment_methods: {
    title: "Mijoz to'lov usullari",
    hint: "Checkout'da ko'rinadigan usullar. Faqat operatsion bo'lganini yoqing",
  },
  customer_delivery_enabled: {
    title: "Yetkazib berish",
    hint: "Mijoz checkout'da yetkazishni tanlay oladimi",
  },
};

export function AdminSettings() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<SettingRow[]>("/settings");
      setRows(data);
      setDrafts(Object.fromEntries(data.map((row) => [row.key, row.value])));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Sozlamalarni yuklab bo'lmadi",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (key: string, value: string) => {
      setSavingKey(key);

      try {
        await apiFetch(`/settings/${key}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        });
        showToast("Sozlama saqlandi", "success");
        await load();
      } catch (caught) {
        // Backend rad etish sababini aniq aytadi (chegara, noma'lum qiymat) —
        // uni o'z matnimiz bilan almashtirmaymiz.
        showToast(
          caught instanceof Error ? caught.message : "Saqlab bo'lmadi",
          "danger",
        );
        await load();
      } finally {
        setSavingKey(null);
      }
    },
    [load, showToast],
  );

  const groups = useMemo(() => {
    const customer = rows.filter((row) => row.isPublic);
    const internal = rows.filter((row) => !row.isPublic);
    return { customer, internal };
  }, [rows]);

  if (loading) {
    return <SkeletonRows rows={6} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <p className="text-xs text-mz-text-muted">
            Bu qiymatlar darhol qo&apos;llanadi — deploy talab qilmaydi.
            Noto&apos;g&apos;ri qiymat saqlanmaydi: chegara va ruxsat etilgan
            variantlar serverda tekshiriladi.
          </p>
        </CardBody>
      </Card>

      <SettingsGroup
        description="Mijoz checkout'ida bevosita ko'rinadi"
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={save}
        rows={groups.customer}
        savingKey={savingKey}
        title="Mijozga ta'sir qiladi"
      />

      <SettingsGroup
        description="Cheklovlar va muddatlar — mijozga ko'rinmaydi"
        drafts={drafts}
        onDraftChange={(key, value) =>
          setDrafts((previous) => ({ ...previous, [key]: value }))
        }
        onSave={save}
        rows={groups.internal}
        savingKey={savingKey}
        title="Ichki cheklovlar"
      />
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
  onSave: (key: string, value: string) => void;
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
            onSave={(value) => onSave(row.key, value)}
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
  const title = label?.title ?? row.key;
  const dirty = draft !== row.value;

  // Mantiqiy sozlama darhol saqlanadi: toggle'da "saqlash" tugmasi
  // ortiqcha qadam, chunki holat allaqachon ikkitadan biri.
  if (row.rule.kind === "bool") {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mz-border pb-4 last:border-0 last:pb-0">
        <Toggle
          checked={row.value === "true"}
          disabled={saving}
          {...(label?.hint ? { description: label.hint } : {})}
          label={title}
          onChange={(checked) => onSave(String(checked))}
        />
        <SettingMeta row={row} />
      </div>
    );
  }

  if (row.rule.kind === "csv-enum") {
    const selected = new Set(draft.split(",").filter(Boolean));
    const allowed = row.rule.values;

    return (
      <div className="border-b border-mz-border pb-4 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-mz-text">{title}</p>
            {label?.hint ? (
              <p className="mt-0.5 text-xs text-mz-text-muted">{label.hint}</p>
            ) : null}
          </div>
          <SettingMeta row={row} />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {allowed.map((option) => {
            const isOn = selected.has(option);

            return (
              <button
                aria-pressed={isOn}
                className={`rounded-mz-pill border px-3 py-1.5 text-xs font-semibold transition ${
                  isOn
                    ? "border-mz-accent bg-mz-accent text-mz-white"
                    : "border-mz-border bg-mz-surface text-mz-text-muted hover:bg-mz-surface-sunken"
                }`}
                disabled={saving}
                key={option}
                onClick={() => {
                  const next = new Set(selected);

                  if (isOn) {
                    next.delete(option);
                  } else {
                    next.add(option);
                  }

                  // Bo'sh ro'yxat to'lov usullarini butunlay yo'q qilardi;
                  // server ham buni rad etadi, lekin tugmani bosishdan
                  // oldin to'sish aniqroq.
                  onChange(
                    next.size > 0 ? [...next].join(",") : draft,
                  );
                }}
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>

        {dirty ? (
          <div className="mt-3">
            <Button
              disabled={saving}
              onClick={() => onSave(draft)}
              size="sm"
              variant="primary"
            >
              <Icon className="h-4 w-4" name="check" />
              Saqlash
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
          <FormField
            {...(hint ? { hint } : {})}
            label={title}
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <TextInput
                  {...props}
                  className="max-w-40"
                  disabled={saving}
                  inputMode={row.rule.kind === "int" ? "numeric" : "text"}
                  onChange={(event) => onChange(event.target.value)}
                  value={draft}
                />
                {dirty ? (
                  <Button
                    disabled={saving}
                    onClick={() => onSave(draft)}
                    size="sm"
                    variant="primary"
                  >
                    Saqlash
                  </Button>
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
    <div className="flex shrink-0 items-center gap-2">
      {row.isPublic ? <Badge tone="info">Ochiq</Badge> : null}
      {row.isStored ? (
        <Badge tone="success">O&apos;zgartirilgan</Badge>
      ) : (
        <Badge tone="neutral">Default {row.fallback}</Badge>
      )}
    </div>
  );
}
