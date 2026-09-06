"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FormField, TextInput } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { Toggle } from "../admin-ui/toggle";
import { useToast } from "../admin-ui/toast";

/*
 * Filiallar.
 *
 * Backend `POST /branches`, `PATCH /branches/:id` va
 * `PATCH /branches/:id/working-hours` ni allaqachon qo'llab-quvvatlardi, lekin
 * ekran faqat o'qish edi — filial qo'shish va ish vaqtini o'zgartirish faqat
 * ma'lumotlar bazasi orqali mumkin edi.
 *
 * `PATCH /branches/:id/product-availability` bu yerda TAKRORLANMAYDI —
 * u mahsulot tahrirlagichida, mahsulot kontekstida turadi.
 */

export const weekDays = [
  { key: "MONDAY", label: "Dushanba" },
  { key: "TUESDAY", label: "Seshanba" },
  { key: "WEDNESDAY", label: "Chorshanba" },
  { key: "THURSDAY", label: "Payshanba" },
  { key: "FRIDAY", label: "Juma" },
  { key: "SATURDAY", label: "Shanba" },
  { key: "SUNDAY", label: "Yakshanba" },
] as const;

type WorkingHour = {
  dayOfWeek: string;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed: boolean;
};

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  timezone?: string | null;
  sortOrder?: number;
  isActive: boolean;
  isTemporarilyClosed?: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  workingHours?: WorkingHour[];
};

type BranchDraft = {
  code: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  isTemporarilyClosed: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};

const emptyDraft: BranchDraft = {
  code: "",
  name: "",
  address: "",
  phone: "",
  isActive: true,
  isTemporarilyClosed: false,
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
};

function draftFrom(branch: Branch): BranchDraft {
  return {
    code: branch.code,
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    isActive: branch.isActive,
    isTemporarilyClosed: branch.isTemporarilyClosed ?? false,
    acceptsOrders: branch.acceptsOrders,
    deliveryEnabled: branch.deliveryEnabled,
    pickupEnabled: branch.pickupEnabled,
  };
}

/** Kunlarni to'liq haftaga to'ldiradi — backend faqat o'rnatilganlarini qaytaradi. */
function fullWeek(hours: WorkingHour[] | undefined): WorkingHour[] {
  return weekDays.map((day) => {
    const existing = hours?.find((hour) => hour.dayOfWeek === day.key);

    return (
      existing ?? {
        dayOfWeek: day.key,
        opensAt: "09:00",
        closesAt: "23:00",
        isClosed: false,
      }
    );
  });
}

export function AdminBranchesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editing, setEditing] = useState<Branch | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<BranchDraft>(emptyDraft);

  const [hoursFor, setHoursFor] = useState<Branch | null>(null);
  const [hours, setHours] = useState<WorkingHour[]>([]);

  const canCreate = hasPermission(user, "BRANCH_CREATE");
  const canEdit = hasPermission(user, "BRANCH_EDIT");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setBranches(await apiFetch<Branch[]>("/branches"));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Filiallarni yuklab bo'lmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(): void {
    setDraft(emptyDraft);
    setIsCreating(true);
  }

  function openEdit(branch: Branch): void {
    setDraft(draftFrom(branch));
    setEditing(branch);
  }

  function openHours(branch: Branch): void {
    setHours(fullWeek(branch.workingHours));
    setHoursFor(branch);
  }

  function closeAll(): void {
    setIsCreating(false);
    setEditing(null);
    setHoursFor(null);
  }

  async function saveBranch(): Promise<void> {
    if (!draft.name.trim()) {
      showToast("Filial nomi kerak.", "danger");
      return;
    }

    setIsSaving(true);

    const body = {
      name: draft.name.trim(),
      ...(draft.code.trim() ? { code: draft.code.trim() } : {}),
      ...(draft.address.trim() ? { address: draft.address.trim() } : {}),
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
      isActive: draft.isActive,
      isTemporarilyClosed: draft.isTemporarilyClosed,
      acceptsOrders: draft.acceptsOrders,
      deliveryEnabled: draft.deliveryEnabled,
      pickupEnabled: draft.pickupEnabled,
    };

    try {
      if (editing) {
        await apiFetch(`/branches/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        showToast("Filial yangilandi.", "success");
      } else {
        await apiFetch("/branches", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Filial yaratildi.", "success");
      }

      closeAll();
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveHours(): Promise<void> {
    if (!hoursFor) {
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`/branches/${hoursFor.id}/working-hours`, {
        method: "PATCH",
        body: JSON.stringify({
          hours: hours.map((hour) => ({
            dayOfWeek: hour.dayOfWeek,
            isClosed: hour.isClosed,
            ...(hour.isClosed
              ? {}
              : {
                  ...(hour.opensAt ? { opensAt: hour.opensAt } : {}),
                  ...(hour.closesAt ? { closesAt: hour.closesAt } : {}),
                }),
          })),
        }),
      });

      showToast("Ish vaqti yangilandi.", "success");
      closeAll();
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <SkeletonRows rows={4} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="grid gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Icon className="h-4 w-4" name="plus" />
            Yangi filial
          </Button>
        </div>
      ) : null}

      {branches.map((branch) => (
        <Card key={branch.id}>
          <CardHeader
            actions={
              canEdit ? (
                <>
                  <Button
                    onClick={() => openHours(branch)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" name="clock" />
                    Ish vaqti
                  </Button>
                  <Button
                    onClick={() => openEdit(branch)}
                    size="sm"
                    variant="secondary"
                  >
                    <Icon className="h-4 w-4" name="pencil" />
                    Tahrirlash
                  </Button>
                </>
              ) : null
            }
            description={`${branch.code} · ${branch.address ?? "Manzil kiritilmagan"}`}
            title={branch.name}
          />
          <CardBody className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-start gap-2">
              <Badge tone={branch.isActive ? "success" : "danger"}>
                {branch.isActive ? "Faol" : "Yopiq"}
              </Badge>
              {branch.isTemporarilyClosed ? (
                <Badge tone="warning">Vaqtincha yopiq</Badge>
              ) : null}
              <Badge tone={branch.acceptsOrders ? "success" : "warning"}>
                {branch.acceptsOrders ? "Buyurtma oladi" : "Buyurtma yopiq"}
              </Badge>
              <Badge tone={branch.deliveryEnabled ? "info" : "neutral"}>
                Yetkazish
              </Badge>
              <Badge tone={branch.pickupEnabled ? "info" : "neutral"}>
                Olib ketish
              </Badge>
              {branch.phone ? (
                <Badge tone="neutral">{branch.phone}</Badge>
              ) : null}
            </div>

            <dl className="grid gap-0.5 text-xs text-mz-text-muted sm:min-w-56">
              {fullWeek(branch.workingHours).map((hour) => {
                const day = weekDays.find(
                  (item) => item.key === hour.dayOfWeek,
                );

                return (
                  <div
                    className="flex justify-between gap-4"
                    key={hour.dayOfWeek}
                  >
                    <dt>{day?.label ?? hour.dayOfWeek}</dt>
                    <dd
                      className={
                        hour.isClosed
                          ? "font-semibold text-mz-danger"
                          : "text-mz-text"
                      }
                    >
                      {hour.isClosed
                        ? "Yopiq"
                        : `${hour.opensAt ?? "--:--"} – ${hour.closesAt ?? "--:--"}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </CardBody>
        </Card>
      ))}

      <Modal
        footer={
          <>
            <Button onClick={closeAll} variant="ghost">
              Bekor qilish
            </Button>
            <Button disabled={isSaving} onClick={() => void saveBranch()}>
              {isSaving ? "Saqlanmoqda…" : "Saqlash"}
            </Button>
          </>
        }
        isOpen={isCreating || editing !== null}
        onClose={closeAll}
        title={editing ? `${editing.name} — tahrirlash` : "Yangi filial"}
      >
        <div className="grid gap-3">
          <FormField label="Nomi" required>
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={draft.name}
              />
            )}
          </FormField>

          <FormField
            hint="Bo'sh qoldirilsa backend o'zi hosil qiladi"
            label="Kod"
          >
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                value={draft.code}
              />
            )}
          </FormField>

          <FormField label="Manzil">
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                value={draft.address}
              />
            )}
          </FormField>

          <FormField label="Telefon">
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                value={draft.phone}
              />
            )}
          </FormField>

          <div className="grid gap-3 border-t border-mz-border pt-3">
            <Toggle
              checked={draft.isActive}
              description="O'chirilsa filial mijoz saytida ham ko'rinmaydi"
              label="Faol"
              onChange={(checked) =>
                setDraft((current) => ({ ...current, isActive: checked }))
              }
            />
            <Toggle
              checked={draft.isTemporarilyClosed}
              description="Filial saqlanadi, lekin hozircha ishlamayapti"
              label="Vaqtincha yopiq"
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  isTemporarilyClosed: checked,
                }))
              }
            />
            <Toggle
              checked={draft.acceptsOrders}
              label="Buyurtma qabul qiladi"
              onChange={(checked) =>
                setDraft((current) => ({ ...current, acceptsOrders: checked }))
              }
            />
            <Toggle
              checked={draft.deliveryEnabled}
              label="Yetkazib berish"
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  deliveryEnabled: checked,
                }))
              }
            />
            <Toggle
              checked={draft.pickupEnabled}
              label="Olib ketish"
              onChange={(checked) =>
                setDraft((current) => ({ ...current, pickupEnabled: checked }))
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        description="Vaqt 24 soatlik formatda (masalan 09:00). Yopiq kunga vaqt kerak emas."
        footer={
          <>
            <Button onClick={closeAll} variant="ghost">
              Bekor qilish
            </Button>
            <Button disabled={isSaving} onClick={() => void saveHours()}>
              {isSaving ? "Saqlanmoqda…" : "Saqlash"}
            </Button>
          </>
        }
        isOpen={hoursFor !== null}
        onClose={closeAll}
        title={hoursFor ? `${hoursFor.name} — ish vaqti` : "Ish vaqti"}
      >
        <div className="grid gap-2">
          {hours.map((hour, index) => {
            const day = weekDays.find((item) => item.key === hour.dayOfWeek);

            return (
              <div
                /*
                 * Mobilda ustunga yig'iladi. `grid-cols-[1fr_auto]` da ikkita
                 * `type="time"` input (brauzerda ~120px) kun nomi bilan yonma-yon
                 * turib 320px ekranga sig'masdi — DESIGN_RULES gorizontal
                 * overflow'ni taqiqlaydi.
                 */
                className="grid gap-2 border-b border-mz-border pb-3 last:border-b-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-3 sm:pb-2"
                key={hour.dayOfWeek}
              >
                <span className="text-sm font-semibold text-mz-text">
                  {day?.label ?? hour.dayOfWeek}
                </span>

                <div className="flex min-w-0 items-center gap-2">
                  <TextInput
                    aria-label={`${day?.label} ochilish vaqti`}
                    className="min-w-0 flex-1"
                    disabled={hour.isClosed}
                    onChange={(event) =>
                      setHours((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, opensAt: event.target.value }
                            : item,
                        ),
                      )
                    }
                    type="time"
                    value={hour.opensAt ?? ""}
                  />
                  <span className="text-mz-text-faint">–</span>
                  <TextInput
                    aria-label={`${day?.label} yopilish vaqti`}
                    className="min-w-0 flex-1"
                    disabled={hour.isClosed}
                    onChange={(event) =>
                      setHours((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, closesAt: event.target.value }
                            : item,
                        ),
                      )
                    }
                    type="time"
                    value={hour.closesAt ?? ""}
                  />
                </div>

                <Toggle
                  checked={hour.isClosed}
                  label="Yopiq"
                  onChange={(checked) =>
                    setHours((current) =>
                      current.map((item, position) =>
                        position === index
                          ? { ...item, isClosed: checked }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
