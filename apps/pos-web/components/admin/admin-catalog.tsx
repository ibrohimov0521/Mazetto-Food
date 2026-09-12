"use client";

import { useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { formatMoney } from "../../lib/order-display";
import { useApiResource } from "../../lib/use-api-resource";
import { useAuth } from "../auth/auth-provider";
import { Badge as UiBadge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

/*
 * Mahsulotlar katalogi.
 *
 * ILGARI bu ekran FAQAT O'QIYDIGAN jadval edi: bitta mutatsiya ham yo'q edi,
 * ya'ni 74 mahsulotdan bittasini menyudan olib qo'yish uchun ham tahrirlash
 * sahifasini ochib, formani to'liq saqlash kerak bo'lardi. Backend'da esa
 * `DELETE /menu/products/:id` (arxivlash — `isAvailable: false`) va
 * `PATCH /menu/products/:id { isActive }` (qayta yoqish) allaqachon bor.
 * Endi ikkisi ham qator amali sifatida ishlatiladi.
 *
 * `catalogVisibility` ATAYLAB o'zgartirilmaydi: u bazadagi maydon emas,
 * `menu.service.getCatalogVisibility` mahsulot kodidan hisoblaydi. Shuning
 * uchun u faqat filtr va nishon — tugma emas.
 */

type CatalogVisibility = "CANONICAL" | "LEGACY" | "INTERNAL";

type Category = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
  sortOrder: number;
};

type ProductVariant = {
  id?: string;
  name: string;
  sellingPrice: string;
  isDefault: boolean;
};

type Product = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  imageUrl?: string | null;
  sellingPrice: string;
  isAvailable: boolean;
  isRecommended: boolean;
  isCombo: boolean;
  sortOrder: number;
  catalogVisibility: CatalogVisibility;
  category: { id: string; code: string; name: string };
  variants: ProductVariant[];
};

type PendingAction = { product: Product; mode: "archive" | "restore" };

export function AdminProductsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = hasPermission(user, "MENU_EDIT");
  const canArchive = hasPermission(user, "MENU_DELETE");

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [visibility, setVisibility] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    async () => {
      const [products, categories] = await Promise.all([
        apiFetch<Product[]>("/menu/products?includeInactive=true"),
        apiFetch<Category[]>("/menu/categories?includeInactive=true"),
      ]);

      return { products, categories };
    },
    [],
    "Mahsulotlar ro'yxatini yuklab bo'lmadi.",
  );

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.code.toLowerCase().includes(needle);
      const matchesCategory =
        categoryId === "ALL" || product.categoryId === categoryId;
      const matchesVisibility =
        visibility === "ALL" || product.catalogVisibility === visibility;
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" ? product.isAvailable : !product.isAvailable);

      return (
        matchesSearch && matchesCategory && matchesVisibility && matchesStatus
      );
    });
  }, [categoryId, products, query, status, visibility]);

  const isFiltered =
    query.trim() !== "" ||
    categoryId !== "ALL" ||
    visibility !== "ALL" ||
    status !== "ALL";

  function resetFilters(): void {
    setQuery("");
    setCategoryId("ALL");
    setVisibility("ALL");
    setStatus("ALL");
  }

  /*
   * Arxivlash `DELETE` bilan, qayta yoqish `PATCH { isActive: true }` bilan.
   * Ikkisi ham MIJOZ SAYTIDA darhol ko'rinadi, shuning uchun ikkisi ham
   * tasdiqlash oynasidan o'tadi.
   */
  async function confirmPending(): Promise<void> {
    if (!pending) {
      return;
    }

    setIsMutating(true);

    try {
      if (pending.mode === "archive") {
        await apiFetch(`/menu/products/${pending.product.id}`, {
          method: "DELETE",
        });
        showToast(`${pending.product.name} menyudan olindi.`, "success");
      } else {
        await apiFetch(`/menu/products/${pending.product.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
        showToast(`${pending.product.name} menyuga qaytarildi.`, "success");
      }

      setPending(null);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsMutating(false);
    }
  }

  const columns: DataTableColumn<Product>[] = [
    {
      key: "product",
      header: "Mahsulot",
      primary: true,
      render: (product) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{product.name}</p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {product.code}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <UiBadge
              tone={
                product.catalogVisibility === "CANONICAL"
                  ? "success"
                  : product.catalogVisibility === "LEGACY"
                    ? "warning"
                    : "neutral"
              }
            >
              {product.catalogVisibility}
            </UiBadge>
            {product.isCombo ? <UiBadge tone="info">SET</UiBadge> : null}
            {!product.isAvailable ? (
              <UiBadge tone="neutral" withDot>
                Arxivda
              </UiBadge>
            ) : null}
            {product.isRecommended ? (
              <UiBadge tone="warning">Tavsiya</UiBadge>
            ) : null}
            {!product.imageUrl ? (
              <UiBadge tone="neutral">Rasmsiz</UiBadge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Kategoriya",
      render: (product) => product.category.name,
    },
    {
      key: "variants",
      header: "Variant",
      hideOnMobile: true,
      render: (product) => `${product.variants.length || 1} ta`,
    },
    {
      key: "price",
      header: "Narx",
      align: "right",
      render: (product) => (
        <span className="font-semibold text-mz-text">
          {formatMoney(product.sellingPrice)}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <Card>
        <CardHeader
          description={
            isLoading
              ? "Yuklanmoqda…"
              : `${filtered.length} / ${products.length} ta mahsulot`
          }
          title="Mahsulotlar"
          {...(isFiltered
            ? {
                actions: (
                  <Button onClick={resetFilters} size="sm" variant="ghost">
                    Filtrni tozalash
                  </Button>
                ),
              }
            : {})}
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField label="Qidiruv">
              {(props) => (
                <TextInput
                  {...props}
                  placeholder="Nomi yoki kodi"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-52">
            <FormField label="Kategoriya">
              {(props) => (
                <Select
                  {...props}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="ALL">Barchasi</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-44">
            <FormField label="Katalog ko'rinishi">
              {(props) => (
                <Select
                  {...props}
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                >
                  <option value="ALL">Barchasi</option>
                  <option value="CANONICAL">Canonical</option>
                  <option value="LEGACY">Legacy</option>
                  <option value="INTERNAL">Internal</option>
                </Select>
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-40">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="ALL">Barchasi</option>
                  <option value="ACTIVE">Menyuda</option>
                  <option value="ARCHIVED">Arxivda</option>
                </Select>
              )}
            </FormField>
          </div>
        </FilterBar>

        <DataTable
          caption="Mahsulotlar ro'yxati"
          columns={columns}
          emptyAction={
            isFiltered ? (
              <Button onClick={resetFilters} variant="ghost">
                Filtrni tozalash
              </Button>
            ) : (
              <ButtonLink href="/admin/products/new" variant="ghost">
                Yangi mahsulot qo&apos;shish
              </ButtonLink>
            )
          }
          emptyDescription={
            isFiltered
              ? "Qidiruv yoki filtrni o'zgartirib ko'ring."
              : "Katalog hozircha bo'sh."
          }
          emptyIcon={isFiltered ? "search" : "inbox"}
          emptyTitle={
            isFiltered ? "Mos mahsulot topilmadi" : "Mahsulot yo'q"
          }
          getRowKey={(product) => product.id}
          isLoading={isLoading && !data}
          rows={filtered}
          {...(canEdit || canArchive
            ? {
                rowActions: (product: Product) => (
                  <>
                    {/*
                      Tahrirlash `ButtonLink` (next/link) bilan: `RowAction`
                      ning `href` varianti oddiy `<a>` chiqaradi, ya'ni
                      butun sahifa qayta yuklanadi. Balandlik `sm` — qator
                      amali ikonkalari bilan bir xil 36px.
                    */}
                    <ButtonLink
                      href={`/admin/products/${product.id}`}
                      size="sm"
                      variant="ghost"
                    >
                      {canEdit ? "Tahrir" : "Ko'rish"}
                    </ButtonLink>
                    {canArchive ? (
                      product.isAvailable ? (
                        <RowAction
                          icon="trash"
                          label={`${product.name} — menyudan olish`}
                          onClick={() =>
                            setPending({ product, mode: "archive" })
                          }
                          tone="danger"
                        />
                      ) : (
                        <RowAction
                          icon="check"
                          label={`${product.name} — menyuga qaytarish`}
                          onClick={() =>
                            setPending({ product, mode: "restore" })
                          }
                        />
                      )
                    ) : null}
                  </>
                ),
              }
            : {})}
        />
      </Card>

      <Modal
        description={
          pending?.mode === "archive"
            ? "Mahsulot o'chirilmaydi — menyudan chiqadi va mijoz saytida ko'rinmay qoladi. Buyurtma tarixi saqlanadi, keyin qaytarish mumkin."
            : "Mahsulot menyuga qaytadi va mijoz saytida darhol ko'rinadi."
        }
        footer={
          <>
            <Button onClick={() => setPending(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isMutating}
              onClick={() => void confirmPending()}
              variant={pending?.mode === "archive" ? "danger" : "primary"}
            >
              {pending?.mode === "archive"
                ? "Menyudan olish"
                : "Menyuga qaytarish"}
            </Button>
          </>
        }
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending
            ? pending.mode === "archive"
              ? `${pending.product.name} menyudan olinsinmi?`
              : `${pending.product.name} qaytarilsinmi?`
            : "Tasdiqlash"
        }
      />
    </div>
  );
}
