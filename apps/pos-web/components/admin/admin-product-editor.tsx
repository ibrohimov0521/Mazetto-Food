"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { hasPermission } from "../../lib/auth";
import { formatMoney } from "../../lib/order-display";
import { productImage } from "../../lib/media";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import {
  Checkbox,
  focusFirstInvalidField,
  FormField,
  Select,
  Textarea,
  TextInput,
} from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
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
  modifiers?: {
    isRequired?: boolean;
    minSelect?: number | null;
    maxSelect?: number | null;
    modifier: Modifier;
  }[];
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

type FieldErrors = Record<string, string>;

/** Iflos (saqlanmagan) holatni aniqlash uchun formaning barqaror surati. */
function snapshot(
  form: ProductFormState,
  variants: Variant[],
  modifierIds: string[],
): string {
  return JSON.stringify([form, variants, [...modifierIds].sort()]);
}

type ProductFormState = {
  name: string;
  description: string;
  categoryId: string;
  image: string;
  preparationTime: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: string;
};

export function AdminProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEditBranchAvailability = hasPermission(user, "BRANCH_EDIT");

  /*
   * YARATILGAN ID NI USHLAB TURISH — takroriy mahsulot xatosi.
   *
   * Ilgari muvaffaqiyatli POST dan keyin `window.history.replaceState`
   * chaqirilardi. U manzil satrini o'zgartiradi, lekin Next router'ga
   * hech narsa demaydi: `useParams` dan kelayotgan `productId` propi
   * `undefined` bo'lib qolardi, ya'ni `isNew` ROST bo'lib turardi va
   * ikkinchi "Saqlash" YANA POST yuborib, ikkinchi mahsulot yaratardi.
   * Shu bilan birga sahifa sarlavhasi "Yangi" bo'lib turardi va filial
   * mavjudligi kartochkasi (u `productId` ga bog'liq) ko'rinmasdi.
   *
   * Endi: id darhol holatga yoziladi (shu render'dan boshlab PATCH ishlaydi)
   * VA `router.replace` haqiqiy navigatsiyani bajaradi, ya'ni route, param
   * va sahifa sarlavhasi ham yangilanadi.
   */
  const [createdId, setCreatedId] = useState<string | null>(null);
  const effectiveId = productId ?? createdId;
  const isNew = !effectiveId;

  const formRef = useRef<HTMLFormElement>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [baseline, setBaseline] = useState("");
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [modifierQuery, setModifierQuery] = useState("");
  /** Saqlangan variantni olib tashlash tasdiqlanadi — u saqlashda yopiladi. */
  const [pendingVariantRemoval, setPendingVariantRemoval] = useState<
    number | null
  >(null);
  /*
   * Biriktirilgan modifier'ning GURUH sozlamalari (majburiy, min, maks)
   * `GET /menu/products/:id` da qaytadi, lekin `ProductModifierDto` faqat
   * `modifierId` ni qabul qiladi — ya'ni ularni bu yerdan o'zgartirib
   * bo'lmaydi. Shuning uchun ular FAQAT KO'RSATILADI, va `modifiers`
   * massivi faqat tanlov O'ZGARGANDA yuboriladi: aks holda `updateProduct`
   * ni har saqlash `deleteMany` + `createMany` qilib, bu sozlamalarni
   * jimgina nolga tushirardi.
   */
  const [savedModifierIds, setSavedModifierIds] = useState<string[]>([]);

  const [form, setForm] = useState<ProductFormState>({
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
      const nextProduct = effectiveId
        ? await apiFetch<Product>(`/menu/products/${effectiveId}`)
        : null;

      return {
        categories: nextCategories,
        modifiers: nextModifiers,
        branches: nextBranches,
        product: nextProduct,
      };
    },
    [canEditBranchAvailability, effectiveId],
    "Forma ma'lumotlarini yuklab bo'lmadi.",
  );
  const categories = data?.categories ?? [];
  const modifierCatalog = data?.modifiers ?? [];
  const branches = data?.branches ?? [];
  const product = data?.product ?? null;

  const modifierNeedle = modifierQuery.trim().toLowerCase();
  const visibleModifiers = modifierNeedle
    ? modifierCatalog.filter(
        (modifier) =>
          modifier.name.toLowerCase().includes(modifierNeedle) ||
          modifier.code.toLowerCase().includes(modifierNeedle),
      )
    : modifierCatalog;

  useEffect(() => {
    if (!data) return;

    const nextProduct = data.product;

    setErrors({});

    if (!nextProduct) {
      const nextVariants: Variant[] = [
        { name: "Asosiy", sellingPrice: "0", isDefault: true },
      ];

      setVariants(nextVariants);
      setForm((current) => {
        const nextForm = {
          ...current,
          categoryId: data.categories[0]?.id ?? "",
        };
        setBaseline(snapshot(nextForm, nextVariants, []));
        return nextForm;
      });
      setSelectedModifierIds([]);
      setSavedModifierIds([]);
      return;
    }

    const nextVariants =
      nextProduct.variants.length > 0
        ? nextProduct.variants
        : [
            {
              name: "Asosiy",
              sellingPrice: nextProduct.sellingPrice,
              isDefault: true,
            },
          ];
    const nextModifierIds = (nextProduct.modifiers ?? []).map(
      (entry) => entry.modifier.id,
    );
    const nextForm: ProductFormState = {
      name: nextProduct.name,
      description: nextProduct.description ?? "",
      categoryId: nextProduct.categoryId,
      image: nextProduct.imageUrl ?? "",
      preparationTime: String(nextProduct.preparationTime ?? 10),
      isActive: nextProduct.isAvailable,
      isRecommended: nextProduct.isRecommended,
      sortOrder: String(nextProduct.sortOrder ?? 0),
    };

    setVariants(nextVariants);
    setSelectedModifierIds(nextModifierIds);
    setSavedModifierIds(nextModifierIds);
    setForm(nextForm);
    setBaseline(snapshot(nextForm, nextVariants, nextModifierIds));
  }, [data]);

  const isDirty =
    baseline !== "" &&
    snapshot(form, variants, selectedModifierIds) !== baseline;

  /*
   * Saqlanmagan o'zgarish bilan sahifadan chiqishni ogohlantirish.
   * Bu brauzer/tab yopilishi va tashqi havolalarni qamrab oladi; ichki
   * "Bekor qilish" esa o'z tasdiqlash oynasini ko'rsatadi.
   */
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
      // Eski brauzerlar uchun: qaytarilgan qiymat dialogni majburlaydi.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

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

  /*
   * Validatsiya INLINE.
   *
   * Ilgari har bir tekshiruv 5 soniyalik `danger` toast chiqarardi: xabar
   * qaysi maydon aybdorligini aytmasdi, maydon belgilanmasdi va matn
   * harakat qilishga ulgurmasdan yo'qolardi. Endi xato maydon yonida
   * turadi, `aria-invalid` qo'yiladi va birinchi noto'g'ri maydon
   * fokuslanadi. Toast faqat SERVER javobi uchun qoladi.
   */
  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!form.name.trim()) {
      next.name = "Mahsulot nomi kiritilishi shart.";
    }

    if (!form.categoryId) {
      next.categoryId = "Kategoriya tanlanishi shart.";
    }

    const named = variants.filter((variant) => variant.name.trim());

    if (named.length === 0) {
      next["variant-0-name"] = "Kamida bitta variant nomi kerak.";
    }

    variants.forEach((variant, index) => {
      if (!variant.name.trim()) {
        return;
      }

      const price = Number(variant.sellingPrice);

      if (variant.sellingPrice === "" || !Number.isFinite(price) || price < 0) {
        next[`variant-${index}-price`] =
          "Narx 0 yoki undan katta son bo'lishi kerak.";
      }

      if (variant.costPrice != null && variant.costPrice !== "") {
        const cost = Number(variant.costPrice);

        if (!Number.isFinite(cost) || cost < 0) {
          next[`variant-${index}-cost`] =
            "Tannarx 0 yoki undan katta son bo'lishi kerak.";
        }
      }
    });

    if (named.length > 0 && !named.some((variant) => variant.isDefault)) {
      next.variantDefault = "Bitta variant standart deb belgilanishi kerak.";
    }

    return next;
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // Xato xabarlari render bo'lgandan KEYIN fokuslanadi.
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(formRef.current),
      );
      return;
    }

    const cleanVariants = variants.filter((variant) => variant.name.trim());

    setIsSaving(true);

    /*
     * `isActive` FAQAT PATCH da yuboriladi.
     *
     * `CreateProductDto` da bunday maydon yo'q, `main.ts` da esa
     * `forbidNonWhitelisted: true` — ya'ni uni POST bilan yuborish
     * "property isActive should not exist" degan 400 qaytarardi va YANGI
     * MAHSULOT UMUMAN YARATILMASDI. Backend yangi mahsulotni har holda
     * faol qiladi (`isAvailable: true`), shuning uchun yaratish formasida
     * bu bayroq ko'rsatilmaydi ham.
     */
    const modifiersChanged =
      [...selectedModifierIds].sort().join(",") !==
      [...savedModifierIds].sort().join(",");

    const body = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      image: form.image.trim() || undefined,
      preparationTime: Number(form.preparationTime) || undefined,
      ...(isNew ? {} : { isActive: form.isActive }),
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
      ...(isNew || modifiersChanged
        ? {
            modifiers: selectedModifierIds.map((modifierId) => ({
              modifierId,
            })),
          }
        : {}),
    };

    try {
      const saved = isNew
        ? await apiFetch<Product>("/menu/products", {
            method: "POST",
            body: JSON.stringify(body),
          })
        : await apiFetch<Product>(`/menu/products/${effectiveId}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });

      showToast("Mahsulot saqlandi.", "success");

      if (isNew) {
        /*
         * Tartib muhim: `setCreatedId` SHU render'dan keyin `isNew` ni
         * YOLG'ON qiladi, ya'ni `router.replace` tugashini kutmasdan ham
         * ikkinchi bosish PATCH yuboradi. `router.replace` esa route,
         * `useParams` va sahifa sarlavhasini haqiqatan almashtiradi.
         */
        setCreatedId(saved.id);
        router.replace(`/admin/products/${saved.id}`);
        return;
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
    if (!effectiveId) {
      return;
    }

    try {
      await apiFetch(`/branches/${branchId}/product-availability`, {
        method: "PATCH",
        body: JSON.stringify({ productId: effectiveId, status }),
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
    <form className="space-y-5 pb-2" onSubmit={save} ref={formRef}>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Asosiy ma'lumot" />
            <CardBody className="grid gap-3">
              <FormField
                label="Nomi"
                required
                {...(errors.name ? { error: errors.name } : {})}
              >
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
                <FormField
                  label="Kategoriya"
                  required
                  {...(errors.categoryId ? { error: errors.categoryId } : {})}
                >
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
              </div>

              {/*
                Rasm maydoni 2 ustunli setkadan CHIQARILDI: yarim kenglikdagi
                katakda `ImageDropzone` (eskiz + matn + tugma) 768-1023px
                oralig'ida sig'masdi. Endi u to'liq kenglikda va dropzone
                o'zi ham o'ralishga ruxsat beradi.
              */}
              <FormField
                hint="Yuklang yoki mavjud yo'lni qo'lda kiriting"
                label="Rasm"
              >
                {(props) => (
                  <div className="flex flex-col gap-2">
                    <ImageDropzone
                      imageProfile="product"
                      onUploaded={(url) => setForm({ ...form, image: url })}
                      value={form.image ? productImage(form.image) : ""}
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

              <div className="flex flex-wrap gap-3">
                {/*
                  "Faol" FAQAT tahrirlashda: yaratish endpoint'i bu maydonni
                  qabul qilmaydi va mahsulotni har holda faol qiladi.
                  Ilgari u yaratish formasida ham turardi va hech narsaga
                  ta'sir qilmasdi (aslida so'rovni 400 bilan buzardi).
                */}
                {isNew ? null : (
                  <Checkbox
                    boxed
                    checked={form.isActive}
                    description="Nofaol mahsulot menyuda va mijoz saytida ko'rinmaydi"
                    label="Faol"
                    onChange={(checked) =>
                      setForm({ ...form, isActive: checked })
                    }
                  />
                )}
                <Checkbox
                  boxed
                  checked={form.isRecommended}
                  label="Tavsiya qilingan"
                  onChange={(checked) =>
                    setForm({ ...form, isRecommended: checked })
                  }
                />
              </div>
              {isNew ? (
                <p className="text-[13px] text-mz-text-muted">
                  Yangi mahsulot darhol faol bo&apos;ladi. Uni menyudan olish
                  saqlangandan keyin mumkin.
                </p>
              ) : null}
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
              {errors.variantDefault ? (
                <p
                  className="rounded-mz-control bg-mz-danger-bg px-3 py-2 text-[13px] font-medium text-mz-danger"
                  role="alert"
                >
                  {errors.variantDefault}
                </p>
              ) : null}
              {variants.map((variant, index) => (
                /*
                  1024-1279px da OVERFLOW bo'lardi: qat'iy `140px_140px_auto`
                  ustunlar + ikki tugma ~500px talab qilardi, lekin
                  `lg:grid-cols-[1fr_340px]` tashqi setkada asosiy ustun
                  ~338px edi. To'rt ustunli qator faqat `xl` dan boshlanadi;
                  pastda narx maydonlari ikkiga bo'linadi va tugmalar
                  alohida qatorga tushadi.
                */
                <div
                  className="grid gap-3 rounded-mz-control border border-mz-border p-3 md:grid-cols-2 xl:grid-cols-[1fr_150px_150px_auto]"
                  key={variant.id ?? `new-${index}`}
                >
                  <FormField
                    label="Nomi"
                    {...(errors[`variant-${index}-name`]
                      ? { error: errors[`variant-${index}-name`] as string }
                      : {})}
                  >
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
                  <FormField
                    label="Narx"
                    {...(errors[`variant-${index}-price`]
                      ? { error: errors[`variant-${index}-price`] as string }
                      : {})}
                  >
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
                  <FormField
                    label="Tannarx"
                    {...(errors[`variant-${index}-cost`]
                      ? { error: errors[`variant-${index}-cost`] as string }
                      : {})}
                  >
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
                  <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-1 xl:pb-0.5">
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
                      onClick={() => {
                        /*
                          Saqlangan variantni olib tashlash MIJOZGA
                          ko'rinadigan o'zgarish (saqlashda u yopiladi),
                          shuning uchun tasdiqlanadi. Hali saqlanmagan
                          qatorni olib tashlash esa oddiy forma tahriri.
                        */
                        if (variant.id) {
                          setPendingVariantRemoval(index);
                          return;
                        }

                        removeVariant(index);
                      }}
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

          {/*
            QO'SHIMCHA BIRIKTIRISH.

            Ilgari bu tekis, 28px balandlikdagi `text-xs` chiplar ro'yxati
            edi: qidiruv yo'q, tanlanganlar aralash turardi va guruh
            sozlamalari (majburiy / min / maks) umuman ko'rinmasdi. Endi:
              - chip balandligi 40px, matn 13px;
              - qidiruv maydoni (katalog o'sganda kerak);
              - tanlanganlar tepada, alohida bo'limda, olib tashlash bilan;
              - biriktirilgan modifier'ning guruh sozlamalari ko'rsatiladi
                (ular faqat o'qish uchun).
          */}
          <Card>
            <CardHeader
              actions={
                <ButtonLink href="/admin/modifiers" size="sm" variant="ghost">
                  Katalogni ochish
                </ButtonLink>
              }
              description={`${selectedModifierIds.length} ta biriktirilgan`}
              title="Qo'shimchalar (modifier)"
            />
            <CardBody className="grid gap-3">
              {modifierCatalog.length === 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-mz-text-muted">
                    Modifier katalogi bo&apos;sh.
                  </p>
                  <ButtonLink href="/admin/modifiers" size="sm" variant="ghost">
                    Qo&apos;shimcha yaratish
                  </ButtonLink>
                </div>
              ) : (
                <>
                  {selectedModifierIds.length > 0 ? (
                    <div className="grid gap-2 rounded-mz-control bg-mz-info-bg/60 p-3">
                      <p className="text-[13px] font-semibold text-mz-text">
                        Biriktirilgan
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedModifierIds.map((modifierId) => {
                          const modifier = modifierCatalog.find(
                            (entry) => entry.id === modifierId,
                          );
                          const group = (product?.modifiers ?? []).find(
                            (entry) => entry.modifier.id === modifierId,
                          );

                          if (!modifier) {
                            return null;
                          }

                          return (
                            <span
                              className="inline-flex min-h-10 items-center gap-2 rounded-mz-pill border border-mz-accent bg-mz-surface px-3.5 py-1.5 text-[13px] font-semibold text-mz-info"
                              key={modifierId}
                            >
                              {modifier.name}
                              {Number(modifier.price) > 0
                                ? ` · ${formatMoney(modifier.price)}`
                                : ""}
                              {group?.isRequired ? (
                                <Badge tone="warning">majburiy</Badge>
                              ) : null}
                              {group && (group.minSelect || group.maxSelect) ? (
                                <Badge tone="neutral">
                                  {group.minSelect ?? 0}
                                  {"–"}
                                  {group.maxSelect ?? "∞"}
                                </Badge>
                              ) : null}
                              <button
                                aria-label={`${modifier.name} — biriktirishni olib tashlash`}
                                className="grid h-6 w-6 place-items-center rounded-mz-pill text-mz-text-muted transition hover:bg-mz-danger-bg hover:text-mz-danger"
                                onClick={() => toggleModifier(modifierId)}
                                type="button"
                              >
                                <Icon className="h-3.5 w-3.5" name="close" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {modifierCatalog.length > 8 ? (
                    <FormField label="Katalogdan qidirish">
                      {(props) => (
                        <TextInput
                          {...props}
                          placeholder="Qo'shimcha nomi"
                          value={modifierQuery}
                          onChange={(event) =>
                            setModifierQuery(event.target.value)
                          }
                        />
                      )}
                    </FormField>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {visibleModifiers.map((modifier) => {
                      const isSelected = selectedModifierIds.includes(
                        modifier.id,
                      );

                      return (
                        <button
                          aria-pressed={isSelected}
                          className={`inline-flex min-h-10 items-center rounded-mz-pill border px-3.5 py-2 text-[13px] font-semibold transition ${
                            isSelected
                              ? "border-mz-accent bg-mz-info-bg text-mz-info"
                              : "border-mz-border-strong bg-mz-surface text-mz-text hover:border-mz-accent"
                          } ${modifier.isActive ? "" : "opacity-60"}`}
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

                  {visibleModifiers.length === 0 ? (
                    <p className="text-[13px] text-mz-text-muted">
                      Qidiruvga mos qo&apos;shimcha topilmadi.
                    </p>
                  ) : null}

                  <p className="text-[13px] text-mz-text-muted">
                    Guruh sozlamalari (majburiy, eng kam va eng ko&apos;p
                    tanlov) faqat ko&apos;rsatiladi — biriktirish payload&apos;i
                    ularni qabul qilmaydi.
                  </p>
                </>
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
              <p className="text-[13px] text-mz-text-muted">
                Yangi mahsulot avtomatik ommaviy katalogga kirmaydi. Katalog
                siyosati alohida tasdiqlanadi.
              </p>
            </CardBody>
          </Card>

          {canEditBranchAvailability && effectiveId ? (
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
                    className="flex justify-between rounded-mz-control bg-mz-surface-sunken px-3 py-2 text-[13px]"
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
              <p className="text-[13px] text-mz-text-muted">
                Rasm to&apos;g&apos;ridan-to&apos;g&apos;ri yuklanadi va media
                serverida saqlanadi. Fayl nomi avtomatik beriladi, ya&apos;ni
                bir xil nomli ikki rasm bir-birini almashtirmaydi.
              </p>
              <p className="mt-2 text-[13px] text-mz-text-muted">
                Mavjud mahsulotlarning yo&apos;llari o&apos;zgarmadi — quyidagi
                matn maydonini qo&apos;lda tahrirlash ham ishlaydi.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      {/*
        `position: sticky` uchun MUHIM: yopishqoq element GRID ELEMENTI
        bo'lmasligi kerak. Grid elementining yopishqoq "idishi" — uning
        o'z grid maydoni, ya'ni o'z balandligidagi qator; bunda siljish
        uchun joy qolmaydi va `bottom-0` hech narsa qilmaydi. Shu sababli
        forma oddiy blok konteyner, ustunli setka esa ichki `div`.
      */}
      {/*
        YOPISHQOQ HARAKAT PANELI.

        Editor to'rt kartochka + yon panel — Saqlash/Bekor qilish uzun
        sahifaning eng tubida qolardi va sahifada "saqlanmagan" ko'rsatkichi
        umuman yo'q edi.
      */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-mz-card border border-mz-border bg-mz-surface px-4 py-3 shadow-mz-overlay">
        <p
          aria-live="polite"
          className="mr-auto flex items-center gap-2 text-[13px] font-medium text-mz-text-muted"
        >
          {isDirty ? (
            <>
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-mz-pill bg-mz-warning-accent"
              />
              Saqlanmagan o&apos;zgarishlar bor
            </>
          ) : (
            "Barcha o'zgarishlar saqlangan"
          )}
        </p>

        <Button
          onClick={() => {
            if (isDirty) {
              setIsDiscardOpen(true);
              return;
            }

            router.push("/admin/products");
          }}
          variant="ghost"
        >
          Bekor qilish
        </Button>
        <Button
          disabled={!isDirty}
          isLoading={isSaving}
          size="lg"
          type="submit"
        >
          {isSaving ? "Saqlanmoqda" : "Saqlash"}
        </Button>
      </div>

      <Modal
        description="Variant saqlaganingizda yopiladi — buyurtma tarixi saqlanadi. Standart variant olib tashlansa, birinchi qolgan variant standart bo'ladi."
        footer={
          <>
            <Button
              onClick={() => setPendingVariantRemoval(null)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button
              onClick={() => {
                if (pendingVariantRemoval !== null) {
                  removeVariant(pendingVariantRemoval);
                }

                setPendingVariantRemoval(null);
              }}
              variant="danger"
            >
              Olib tashlash
            </Button>
          </>
        }
        isOpen={pendingVariantRemoval !== null}
        onClose={() => setPendingVariantRemoval(null)}
        title={
          pendingVariantRemoval !== null
            ? `${variants[pendingVariantRemoval]?.name || "Variant"} olib tashlansinmi?`
            : "Variantni olib tashlash"
        }
      />

      <Modal
        description="Kiritilgan o'zgarishlar saqlanmaydi."
        footer={
          <>
            <Button onClick={() => setIsDiscardOpen(false)} variant="ghost">
              Tahrirlashda qolish
            </Button>
            <Button
              onClick={() => {
                setIsDiscardOpen(false);
                router.push("/admin/products");
              }}
              variant="danger"
            >
              O&apos;zgarishlarni tashlab ketish
            </Button>
          </>
        }
        isOpen={isDiscardOpen}
        onClose={() => setIsDiscardOpen(false)}
        title="O'zgarishlarni bekor qilasizmi?"
      />
    </form>
  );
}
