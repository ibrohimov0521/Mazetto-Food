"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { hasPermission } from "../../lib/auth";
import { formatMoney } from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FormField, Select, Textarea, TextInput } from "../admin-ui/form";
import { ImageDropzone } from "../admin-ui/image-dropzone";
import { useToast } from "../admin-ui/toast";

/*
 * Mahsulot tahrirlash — katalog 2-bosqichi.
 *
 * Oldingi editor faqat BITTA standart variantni tahrirlardi ("Asosiy" nomi
 * qattiq yozilgan edi) va modifier'larni umuman yubormasdi, garchi backend
 * `POST/PATCH /menu/products` da `variants[]` va `modifiers[]` ni allaqachon
 * qabul qilsa ham. Ya'ni ko'p variantli mahsulot va modifier biriktirish
 * admin paneldan mumkin emas edi.
 *
 * Endi qo'shildi:
 *   - ko'p variant: qo'shish, o'chirish, narx/tannarx, standart tanlash
 *   - modifier biriktirish (katalogdan tanlash)
 *   - filial bo'yicha mavjudlik
 *
 * Set tarkibi (`ProductBundleItem`) faqat ko'rsatiladi — uni boshqarish uchun
 * backend endpoint'i yo'q, u seed orqali to'ldiriladi.
 */

type Category = { id: string; name: string };
type Branch = { id: string; code: string; name: string };

type Variant = {
  id?: string;
  code?: string;
  name: string;
  sellingPrice: string;
  costPrice?: string | null;
  isDefault: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
};

type Modifier = {
  id: string;
  code: string;
  name: string;
  price: string;
  isActive: boolean;
  _count?: { products: number };
};

type BundleItem = {
  id: string;
  componentName: string;
  quantity: string;
  unitLabel?: string | null;
};

type AvailabilityStatus = "AVAILABLE" | "OUT_OF_STOCK" | "UNAVAILABLE";

type BranchAvailability = {
  id: string;
  branchId: string;
  status: AvailabilityStatus;
  reason?: string | null;
  branch?: { id: string; code: string; name: string } | null;
};

type Product = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  preparationTime?: number | null;
  sellingPrice: string;
  isAvailable: boolean;
  isRecommended: boolean;
  isCombo: boolean;
  sortOrder: number;
  catalogVisibility: "CANONICAL" | "LEGACY" | "INTERNAL";
  variants: Variant[];
  modifiers?: { modifier: Modifier }[];
  bundleItems?: BundleItem[];
  branchAvailabilities?: BranchAvailability[];
};

const availabilityLabels: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Mavjud",
  OUT_OF_STOCK: "Tugagan",
  UNAVAILABLE: "Yopilgan",
};

function availabilityTone(status: AvailabilityStatus) {
  if (status === "AVAILABLE") return "success" as const;
  if (status === "OUT_OF_STOCK") return "warning" as const;
  return "danger" as const;
}

export function AdminProductEditor({ productId }: { productId?: string }) {
  const isNew = !productId;
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEditBranchAvailability = hasPermission(user, "BRANCH_EDIT");

  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    image: "",
    preparationTime: "10",
    isActive: true,
    isRecommended: false,
    sortOrder: "0",
  });

  /*
   * Yuklash va FORMANI URUG'LANTIRISH ataylab ajratilgan: hook faqat
   * serverdan kelgan xom ma'lumotni beradi, forma esa quyidagi effektda
   * to'ldiriladi. Aks holda har qayta yuklash foydalanuvchi kiritgan
   * o'zgarishlarni bosib ketardi.
   */
  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    async () => {
      const [nextCategories, nextModifiers] = await Promise.all([
        apiFetch<Category[]>("/menu/categories?includeInactive=true"),
        apiFetch<Modifier[]>("/menu/modifiers?includeInactive=true"),
      ]);
      const nextBranches = canEditBranchAvailability
        ? await apiFetch<Branch[]>("/branches")
        : [];
      const nextProduct = productId
        ? await apiFetch<Product>(`/menu/products/${productId}`)
        : null;

      return {
        categories: nextCategories,
        modifiers: nextModifiers,
        branches: nextBranches,
        product: nextProduct,
      };
    },
    [canEditBranchAvailability, productId],
    "Forma ma'lumotlarini yuklab bo'lmadi.",
  );
  const categories = data?.categories ?? [];
  const modifierCatalog = data?.modifiers ?? [];
  const branches = data?.branches ?? [];
  const product = data?.product ?? null;

  useEffect(() => {
    if (!data) return;

    const nextProduct = data.product;

    if (!nextProduct) {
      setVariants([{ name: "Asosiy", sellingPrice: "0", isDefault: true }]);
      setForm((current) => ({
        ...current,
        categoryId: data.categories[0]?.id ?? "",
      }));
      return;
    }

    setVariants(
      nextProduct.variants.length > 0
        ? nextProduct.variants
        : [
            {
              name: "Asosiy",
              sellingPrice: nextProduct.sellingPrice,
              isDefault: true,
            },
          ],
    );
    setSelectedModifierIds(
      (nextProduct.modifiers ?? []).map((entry) => entry.modifier.id),
    );
    setForm({
      name: nextProduct.name,
      description: nextProduct.description ?? "",
      categoryId: nextProduct.categoryId,
      image: nextProduct.imageUrl ?? "",
      preparationTime: String(nextProduct.preparationTime ?? 10),
      isActive: nextProduct.isAvailable,
      isRecommended: nextProduct.isRecommended,
      sortOrder: String(nextProduct.sortOrder ?? 0),
    });
  }, [data]);

  function updateVariant(index: number, patch: Partial<Variant>): void {
    setVariants((current) =>
      current.map((variant, position) =>
        position === index ? { ...variant, ...patch } : variant,
      ),
    );
  }

  /** Standart variant faqat bitta bo'lishi mumkin. */
  function makeDefault(index: number): void {
    setVariants((current) =>
      current.map((variant, position) => ({
        ...variant,
        isDefault: position === index,
      })),
    );
  }

  function addVariant(): void {
    setVariants((current) => [
      ...current,
      { name: "", sellingPrice: "0", isDefault: current.length === 0 },
    ]);
  }

  function removeVariant(index: number): void {
    setVariants((current) => {
      const next = current.filter((_, position) => position !== index);

      // Standart variant o'chirilsa, birinchisi standart bo'ladi.
      if (next.length > 0 && !next.some((variant) => variant.isDefault)) {
        next[0] = { ...next[0]!, isDefault: true };
      }

      return next;
    });
  }

  function toggleModifier(modifierId: string): void {
    setSelectedModifierIds((current) =>
      current.includes(modifierId)
        ? current.filter((id) => id !== modifierId)
        : [...current, modifierId],
    );
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const cleanVariants = variants.filter((variant) => variant.name.trim());

    if (cleanVariants.length === 0) {
      showToast("Kamida bitta variant kerak.", "danger");
      return;
    }

    if (!cleanVariants.some((variant) => variant.isDefault)) {
      showToast("Bitta variant standart deb belgilanishi kerak.", "danger");
      return;
    }

    for (const variant of cleanVariants) {
      if (
        !Number.isFinite(Number(variant.sellingPrice)) ||
        Number(variant.sellingPrice) < 0
      ) {
        showToast(`"${variant.name}" variantining narxi noto'g'ri.`, "danger");
        return;
      }
    }

    setIsSaving(true);

    const body = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      image: form.image.trim() || undefined,
      preparationTime: Number(form.preparationTime) || undefined,
      isActive: form.isActive,
      isRecommended: form.isRecommended,
      sortOrder: Number(form.sortOrder) || 0,
      variants: cleanVariants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        name: variant.name.trim(),
        price: Number(variant.sellingPrice),
        ...(variant.costPrice != null && variant.costPrice !== ""
          ? { costPrice: Number(variant.costPrice) }
          : {}),
        isDefault: variant.isDefault,
      })),
      modifiers: selectedModifierIds.map((modifierId) => ({ modifierId })),
    };

    try {
      const saved = isNew
        ? await apiFetch<Product>("/menu/products", {
            method: "POST",
            body: JSON.stringify(body),
          })
        : await apiFetch<Product>(`/menu/products/${productId}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });

      showToast("Mahsulot saqlandi.", "success");

      if (isNew) {
        window.history.replaceState(null, "", `/admin/products/${saved.id}`);
      }

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

  async function setBranchAvailability(
    branchId: string,
    status: AvailabilityStatus,
  ): Promise<void> {
    if (!productId) {
      return;
    }

    try {
      await apiFetch(`/branches/${branchId}/product-availability`, {
        method: "PATCH",
        body: JSON.stringify({ productId, status }),
      });
      showToast("Filial mavjudligi yangilandi.", "success");
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.",
        "danger",
      );
    }
  }

  if (isLoading) {
    return <SkeletonRows rows={10} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Asosiy ma'lumot" />
            <CardBody className="grid gap-3">
              <FormField label="Nomi" required>
                {(props) => (
                  <TextInput
                    {...props}
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                )}
              </FormField>

              <FormField label="Tavsif">
                {(props) => (
                  <Textarea
                    {...props}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                )}
              </FormField>

              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Kategoriya" required>
                  {(props) => (
                    <Select
                      {...props}
                      required
                      value={form.categoryId}
                      onChange={(event) =>
                        setForm({ ...form, categoryId: event.target.value })
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField label="Tayyorlash vaqti (daqiqa)">
                  {(props) => (
                    <TextInput
                      {...props}
                      min={0}
                      type="number"
                      value={form.preparationTime}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          preparationTime: event.target.value,
                        })
                      }
                    />
                  )}
                </FormField>
                <FormField label="Saralash tartibi">
                  {(props) => (
                    <TextInput
                      {...props}
                      min={0}
                      type="number"
                      value={form.sortOrder}
                      onChange={(event) =>
                        setForm({ ...form, sortOrder: event.target.value })
                      }
                    />
                  )}
                </FormField>
                <FormField
                  hint="Yuklang yoki mavjud yo'lni qo'lda kiriting"
                  label="Rasm"
                >
                  {(props) => (
                    <div className="flex flex-col gap-2">
                      <ImageDropzone
                        onUploaded={(url) => setForm({ ...form, image: url })}
                        value={form.image}
                      />
                      {/*
                        Matn maydoni ATAYLAB qoldirilgan: mavjud 74 mahsulotning
                        yo'llari allaqachon yozilgan va ularni yuklab qayta
                        ishlash bu ishning qamrovidan tashqarida. Yuklash bu
                        maydonni to'ldiradi, uni almashtirmaydi.
                      */}
                      <TextInput
                        {...props}
                        placeholder="/products/lavash-big.webp"
                        value={form.image}
                        onChange={(event) =>
                          setForm({ ...form, image: event.target.value })
                        }
                      />
                    </div>
                  )}
                </FormField>
              </div>

              <div className="flex flex-wrap gap-3">
                <CheckBox
                  checked={form.isActive}
                  label="Faol"
                  onChange={(checked) =>
                    setForm({ ...form, isActive: checked })
                  }
                />
                <CheckBox
                  checked={form.isRecommended}
                  label="Tavsiya qilingan"
                  onChange={(checked) =>
                    setForm({ ...form, isRecommended: checked })
                  }
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              actions={
                <Button onClick={addVariant} size="sm" variant="ghost">
                  Variant qo&apos;shish
                </Button>
              }
              description="Bitta variant standart bo'lishi shart — u asosiy narx sifatida ishlatiladi"
              title="Variantlar"
            />
            <CardBody className="grid gap-3">
              {variants.map((variant, index) => (
                <div
                  className="grid gap-3 rounded-mz-control border border-mz-border p-3 md:grid-cols-[1fr_140px_140px_auto]"
                  key={variant.id ?? `new-${index}`}
                >
                  <FormField label="Nomi">
                    {(props) => (
                      <TextInput
                        {...props}
                        placeholder="Katta / Kichik"
                        value={variant.name}
                        onChange={(event) =>
                          updateVariant(index, { name: event.target.value })
                        }
                      />
                    )}
                  </FormField>
                  <FormField label="Narx">
                    {(props) => (
                      <TextInput
                        {...props}
                        min={0}
                        type="number"
                        value={variant.sellingPrice}
                        onChange={(event) =>
                          updateVariant(index, {
                            sellingPrice: event.target.value,
                          })
                        }
                      />
                    )}
                  </FormField>
                  <FormField label="Tannarx">
                    {(props) => (
                      <TextInput
                        {...props}
                        min={0}
                        type="number"
                        value={variant.costPrice ?? ""}
                        onChange={(event) =>
                          updateVariant(index, {
                            costPrice: event.target.value,
                          })
                        }
                      />
                    )}
                  </FormField>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Button
                      disabled={variant.isDefault}
                      onClick={() => makeDefault(index)}
                      size="sm"
                      variant={variant.isDefault ? "secondary" : "ghost"}
                    >
                      {variant.isDefault ? "Standart" : "Standart qil"}
                    </Button>
                    <Button
                      disabled={variants.length === 1}
                      onClick={() => removeVariant(index)}
                      size="sm"
                      variant="danger"
                    >
                      O&apos;chirish
                    </Button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              actions={
                <ButtonLink href="/admin/modifiers" size="sm" variant="ghost">
                  Katalogni ochish
                </ButtonLink>
              }
              description={`${selectedModifierIds.length} ta tanlangan`}
              title="Qo'shimchalar (modifier)"
            />
            <CardBody>
              {modifierCatalog.length === 0 ? (
                <p className="text-sm text-mz-text-muted">
                  Modifier katalogi bo&apos;sh. Avval qo&apos;shimcha yarating.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {modifierCatalog.map((modifier) => {
                    const isSelected = selectedModifierIds.includes(
                      modifier.id,
                    );

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`rounded-mz-pill border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-mz-accent bg-mz-info-bg text-mz-info"
                            : "border-mz-border bg-mz-surface text-mz-text-muted hover:border-mz-accent"
                        } ${modifier.isActive ? "" : "opacity-55"}`}
                        key={modifier.id}
                        onClick={() => toggleModifier(modifier.id)}
                        type="button"
                      >
                        {modifier.name}
                        {Number(modifier.price) > 0
                          ? ` · ${formatMoney(modifier.price)}`
                          : ""}
                        {modifier.isActive ? "" : " (nofaol)"}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="Katalog holati" />
            <CardBody className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {product ? (
                  <Badge
                    tone={
                      product.catalogVisibility === "CANONICAL"
                        ? "success"
                        : product.catalogVisibility === "LEGACY"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {product.catalogVisibility}
                  </Badge>
                ) : (
                  <Badge tone="neutral">YANGI</Badge>
                )}
                {product?.isCombo ? <Badge tone="info">SET</Badge> : null}
              </div>
              <p className="text-xs text-mz-text-muted">
                Yangi mahsulot avtomatik ommaviy katalogga kirmaydi. Katalog
                siyosati alohida tasdiqlanadi.
              </p>
            </CardBody>
          </Card>

          {canEditBranchAvailability && productId ? (
            <Card>
              <CardHeader
                description="O'zgarish mijoz saytida darhol ko'rinadi"
                title="Filial bo'yicha mavjudlik"
              />
              <CardBody className="grid gap-3">
                {branches.map((branch) => {
                  const current =
                    product?.branchAvailabilities?.find(
                      (entry) => entry.branchId === branch.id,
                    )?.status ?? "AVAILABLE";

                  return (
                    <div className="grid gap-1.5" key={branch.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-mz-text">
                          {branch.name}
                        </span>
                        <Badge tone={availabilityTone(current)}>
                          {availabilityLabels[current]}
                        </Badge>
                      </div>
                      <Select
                        aria-label={`${branch.name} uchun mavjudlik`}
                        value={current}
                        onChange={(event) =>
                          void setBranchAvailability(
                            branch.id,
                            event.target.value as AvailabilityStatus,
                          )
                        }
                      >
                        {Object.entries(availabilityLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </Select>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}

          {product?.bundleItems && product.bundleItems.length > 0 ? (
            <Card>
              <CardHeader
                description="Faqat ko'rish — seed orqali boshqariladi"
                title="Set tarkibi"
              />
              <CardBody className="grid gap-1.5">
                {product.bundleItems.map((item) => (
                  <div
                    className="flex justify-between rounded-mz-control bg-mz-surface-sunken px-3 py-2 text-xs"
                    key={item.id}
                  >
                    <span className="text-mz-text">{item.componentName}</span>
                    <span className="text-mz-text-muted">
                      {item.quantity} {item.unitLabel ?? ""}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Rasm boshqaruvi" />
            <CardBody>
              <p className="text-xs text-mz-text-muted">
                Rasm to&apos;g&apos;ridan-to&apos;g&apos;ri yuklanadi va media
                serverida saqlanadi. Fayl nomi avtomatik beriladi, ya&apos;ni
                bir xil nomli ikki rasm bir-birini almashtirmaydi.
              </p>
              <p className="mt-2 text-xs text-mz-text-muted">
                Mavjud mahsulotlarning yo&apos;llari o&apos;zgarmadi — quyidagi
                matn maydonini qo&apos;lda tahrirlash ham ishlaydi.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/admin/products" variant="ghost">
          Bekor qilish
        </ButtonLink>
        <Button disabled={isSaving} type="submit">
          {isSaving ? "Saqlanmoqda..." : "Saqlash"}
        </Button>
      </div>
    </form>
  );
}

function CheckBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex w-fit items-center gap-2 rounded-mz-control border border-mz-border px-3 py-2 text-sm font-semibold text-mz-text">
      <input
        checked={checked}
        className="h-4 w-4 accent-mz-accent"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
