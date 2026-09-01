"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState, PrimaryButton, TextInput } from "../erp/erp-ui";
import { apiFetch } from "../../lib/api";

type CatalogVisibility = "CANONICAL" | "LEGACY" | "INTERNAL";

type Category = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder: number;
  _count?: { products: number };
};

type ProductVariant = {
  id?: string;
  code?: string;
  name: string;
  sellingPrice: string;
  costPrice?: string | null;
  isDefault: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
};

type BundleItem = {
  id: string;
  componentCode: string;
  componentName: string;
  quantity: string;
  unitLabel?: string | null;
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
  catalogVisibility: CatalogVisibility;
  category: { id: string; code: string; name: string };
  variants: ProductVariant[];
  bundleItems?: BundleItem[];
};

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  workingHours?: { dayOfWeek: string; opensAt?: string | null; closesAt?: string | null; isClosed: boolean }[];
};

const formatter = new Intl.NumberFormat("uz-UZ");

export function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      apiFetch<Product[]>("/menu/products?includeInactive=true"),
      apiFetch<Category[]>("/menu/categories?includeInactive=true"),
      apiFetch<Branch[]>("/branches"),
    ])
      .then(([nextProducts, nextCategories, nextBranches]) => {
        setProducts(nextProducts);
        setCategories(nextCategories);
        setBranches(nextBranches);
      })
      .catch(() => setError("Ma'lumotlarni yuklab bo'lmadi."));
  }, []);

  const canonical = products.filter((product) => product.catalogVisibility === "CANONICAL");
  const activeKitchen = "Kitchen ekrani tayyor";

  return (
    <div className="grid gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ommaviy menyu" value={`${canonical.length} ta`} />
        <Metric label="Ichki mahsulotlar" value={`${products.length} ta`} />
        <Metric label="Kategoriyalar" value={`${categories.length} ta`} />
        <Metric label="Filiallar" value={`${branches.filter((branch) => branch.isActive).length} faol`} />
      </div>
      <section className="grid gap-4 lg:grid-cols-3">
        <QuickLink href="/admin/products" title="Mahsulotlar" detail="Narx, holat, rasm yo'li va set tarkibi" />
        <QuickLink href="/admin/categories" title="Kategoriyalar" detail="Saralash, nom va ommaviy katalog tuzilmasi" />
        <QuickLink href="/kitchen" title="Kitchen" detail={activeKitchen} />
      </section>
    </div>
  );
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [visibility, setVisibility] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      apiFetch<Product[]>("/menu/products?includeInactive=true"),
      apiFetch<Category[]>("/menu/categories?includeInactive=true"),
    ])
      .then(([nextProducts, nextCategories]) => {
        setProducts(nextProducts);
        setCategories(nextCategories);
      })
      .catch(() => setError("Mahsulotlar ro'yxatini yuklab bo'lmadi."));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.code.toLowerCase().includes(needle);
      const matchesCategory = categoryId === "ALL" || product.categoryId === categoryId;
      const matchesVisibility = visibility === "ALL" || product.catalogVisibility === visibility;

      return matchesSearch && matchesCategory && matchesVisibility;
    });
  }, [categoryId, products, query, visibility]);

  return (
    <div className="grid gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-3 rounded-3xl border border-white/70 bg-white p-4 shadow-[0_18px_60px_rgba(0,84,77,0.10)] lg:grid-cols-[1fr_220px_180px_auto]">
        <TextInput placeholder="Mahsulot nomi yoki kodi" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="ALL">Barcha kategoriyalar</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="ALL">Barcha holatlar</option>
          <option value="CANONICAL">Canonical</option>
          <option value="LEGACY">Legacy</option>
          <option value="INTERNAL">Internal</option>
        </Select>
        <Link className="inline-flex items-center justify-center rounded-2xl bg-[#f7c948] px-4 py-3 text-sm font-black text-[#06433d]" href="/admin/products/new">
          Yangi mahsulot
        </Link>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
        <div className="grid grid-cols-[1.4fr_120px_130px_110px_90px] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 max-lg:hidden">
          <span>Mahsulot</span>
          <span>Kategoriya</span>
          <span>Tur</span>
          <span>Narx</span>
          <span />
        </div>
        {filtered.length ? (
          filtered.map((product) => (
            <article className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_120px_130px_110px_90px] lg:items-center" key={product.id}>
              <div className="flex min-w-0 gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#0c5a51]">
                  {product.imageUrl ? (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] font-bold text-[#f7c948]">
                      Rasm bor
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/70">Rasm yo'q</div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-[#083f39]">{product.name}</h3>
                  <p className="truncate text-xs font-semibold text-slate-500">{product.code}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={product.catalogVisibility === "CANONICAL" ? "green" : product.catalogVisibility === "LEGACY" ? "amber" : "slate"}>
                      {product.catalogVisibility}
                    </Badge>
                    {product.isCombo ? <Badge tone="teal">SET</Badge> : null}
                    {!product.isAvailable ? <Badge tone="red">Yopiq</Badge> : null}
                    {product.isRecommended ? <Badge tone="gold">Tavsiya</Badge> : null}
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-600">{product.category.name}</span>
              <span className="text-sm font-bold text-slate-600">{product.variants.length || 1} variant</span>
              <span className="text-sm font-black text-[#06433d]">{formatMoney(product.sellingPrice)}</span>
              <Link className="rounded-2xl border border-[#0c6b60]/20 px-4 py-2 text-center text-sm font-black text-[#0c6b60] hover:bg-[#e6f4ef]" href={`/admin/products/${product.id}`}>
                Tahrir
              </Link>
            </article>
          ))
        ) : (
          <div className="p-5">
            <EmptyState title="Mos mahsulot topilmadi." />
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminProductEditor({ productId }: { productId?: string }) {
  const isNew = !productId;
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    image: "",
    preparationTime: "10",
    price: "0",
    isActive: true,
    isRecommended: false,
    sortOrder: "0",
  });

  useEffect(() => {
    async function load() {
      const nextCategories = await apiFetch<Category[]>("/menu/categories?includeInactive=true");
      setCategories(nextCategories);

      if (productId) {
        const nextProduct = await apiFetch<Product>(`/menu/products/${productId}`);
        const defaultVariant = nextProduct.variants.find((variant) => variant.isDefault) ?? nextProduct.variants[0];
        setProduct(nextProduct);
        setForm({
          name: nextProduct.name,
          description: nextProduct.description ?? "",
          categoryId: nextProduct.categoryId,
          image: nextProduct.imageUrl ?? "",
          preparationTime: String(nextProduct.preparationTime ?? 10),
          price: String(defaultVariant?.sellingPrice ?? nextProduct.sellingPrice),
          isActive: nextProduct.isAvailable,
          isRecommended: nextProduct.isRecommended,
          sortOrder: String(nextProduct.sortOrder ?? 0),
        });
      } else {
        setForm((current) => ({ ...current, categoryId: nextCategories[0]?.id ?? "" }));
      }
    }

    void load().catch(() => setError("Forma ma'lumotlarini yuklab bo'lmadi."));
  }, [productId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("Saqlanmoqda...");

    const price = Number(form.price);
    const preparationTime = Number(form.preparationTime);
    const sortOrder = Number(form.sortOrder);

    if (!form.name.trim() || !form.categoryId || !Number.isFinite(price) || price < 0) {
      setStatus("");
      setError("Nom, kategoriya va narx to'g'ri kiritilishi kerak.");
      return;
    }

    const body = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      image: form.image.trim() || undefined,
      preparationTime: Number.isFinite(preparationTime) ? preparationTime : undefined,
      isActive: form.isActive,
      isRecommended: form.isRecommended,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      variants: [
        {
          id: product?.variants.find((variant) => variant.isDefault)?.id ?? product?.variants[0]?.id,
          name: product?.variants.find((variant) => variant.isDefault)?.name ?? "Asosiy",
          price,
          isDefault: true,
        },
      ],
    };

    try {
      const saved = isNew
        ? await apiFetch<Product>("/menu/products", { method: "POST", body: JSON.stringify(body) })
        : await apiFetch<Product>(`/menu/products/${productId}`, { method: "PATCH", body: JSON.stringify(body) });
      setProduct(saved);
      setStatus("Saqlandi.");
      if (isNew) {
        window.history.replaceState(null, "", `/admin/products/${saved.id}`);
      }
    } catch {
      setStatus("");
      setError("Saqlashda xatolik yuz berdi. Maydonlarni tekshiring.");
    }
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Notice>{status}</Notice> : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-4 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
          <Field label="Nomi">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Tavsif">
            <textarea
              className="min-h-28 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Kategoriya">
              <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Narx">
              <TextInput min="0" step="1" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
            </Field>
            <Field label="Tayyorlash vaqti">
              <TextInput min="0" type="number" value={form.preparationTime} onChange={(event) => setForm({ ...form, preparationTime: event.target.value })} />
            </Field>
            <Field label="Saralash">
              <TextInput min="0" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
            </Field>
          </div>
          <Field label="Rasm yo'li">
            <TextInput placeholder="/products/lavash-big.webp" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Check label="Faol" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
            <Check label="Tavsiya qilingan" checked={form.isRecommended} onChange={(checked) => setForm({ ...form, isRecommended: checked })} />
          </div>
        </section>
        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
            <p className="text-sm font-black text-[#06433d]">Katalog holati</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product ? <Badge tone={product.catalogVisibility === "CANONICAL" ? "green" : product.catalogVisibility === "LEGACY" ? "amber" : "slate"}>{product.catalogVisibility}</Badge> : <Badge tone="slate">YANGI</Badge>}
              {product?.isCombo ? <Badge tone="teal">SET</Badge> : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Yangi mahsulot avtomatik canonical 74 ro'yxatiga kirmaydi. Ommaviy katalog siyosati alohida tasdiqlanadi.
            </p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
            <p className="text-sm font-black text-[#06433d]">Rasm boshqaruvi</p>
            <p className="mt-2 text-sm text-slate-500">Media upload endpoint hali yo'q. Hozircha faqat mavjud rasm yo'li tahrirlanadi.</p>
            <button className="mt-4 w-full cursor-not-allowed rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-400" disabled type="button">
              Rasm boshqaruvi - media phase
            </button>
          </div>
          {product?.bundleItems?.length ? (
            <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
              <p className="text-sm font-black text-[#06433d]">Set tarkibi</p>
              <div className="mt-3 grid gap-2">
                {product.bundleItems.map((item) => (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600" key={item.id}>
                    <span>{item.componentName}</span>
                    <span>{item.quantity} {item.unitLabel ?? ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Link className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" href="/admin/products">
          Bekor qilish
        </Link>
        <PrimaryButton type="submit">Saqlash</PrimaryButton>
      </div>
    </form>
  );
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", image: "", sortOrder: "0" });

  async function load() {
    setCategories(await apiFetch<Category[]>("/menu/categories?includeInactive=true"));
  }

  useEffect(() => {
    void load().catch(() => setError("Kategoriyalarni yuklab bo'lmadi."));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await apiFetch("/menu/categories", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          image: form.image || undefined,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      setForm({ name: "", description: "", image: "", sortOrder: "0" });
      await load();
    } catch {
      setError("Kategoriya yaratilmadi. Maydonlarni tekshiring.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className="grid content-start gap-4 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]" onSubmit={create}>
        <h3 className="text-xl font-black text-[#083f39]">Yangi kategoriya</h3>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <TextInput placeholder="Nomi" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <TextInput placeholder="Tavsif" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <TextInput placeholder="/categories/lavash.webp" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
        <TextInput min="0" placeholder="Saralash" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
        <PrimaryButton type="submit">Qo'shish</PrimaryButton>
      </form>
      <section className="grid gap-3">
        {categories.map((category) => (
          <article className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]" key={category.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-[#083f39]">{category.name}</h3>
                <p className="text-sm font-semibold text-slate-500">{category.code} · {category._count?.products ?? 0} mahsulot</p>
                <p className="mt-2 text-sm text-slate-500">{category.description ?? "Tavsif yo'q"}</p>
              </div>
              <Badge tone={category.isActive === false ? "red" : "green"}>{category.isActive === false ? "Yopiq" : "Faol"}</Badge>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiFetch<Branch[]>("/branches").then(setBranches).catch(() => setError("Filiallarni yuklab bo'lmadi."));
  }, []);

  return (
    <div className="grid gap-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {branches.map((branch) => (
        <article className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]" key={branch.id}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-[#083f39]">{branch.name}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{branch.code} · {branch.address ?? "Manzil kiritilmagan"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={branch.isActive ? "green" : "red"}>{branch.isActive ? "Faol" : "Yopiq"}</Badge>
                <Badge tone={branch.acceptsOrders ? "green" : "amber"}>{branch.acceptsOrders ? "Buyurtma oladi" : "Buyurtma yopiq"}</Badge>
                <Badge tone={branch.deliveryEnabled ? "teal" : "slate"}>Yetkazish</Badge>
                <Badge tone={branch.pickupEnabled ? "teal" : "slate"}>Olib ketish</Badge>
              </div>
            </div>
            <div className="grid gap-1 text-sm font-semibold text-slate-500">
              {(branch.workingHours ?? []).slice(0, 7).map((hour) => (
                <span key={hour.dayOfWeek}>
                  {hour.dayOfWeek}: {hour.isClosed ? "Yopiq" : `${hour.opensAt ?? "--"}-${hour.closesAt ?? "--"}`}
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#083f39]">{value}</p>
    </article>
  );
}

function QuickLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(0,84,77,0.16)]" href={href}>
      <p className="text-lg font-black text-[#083f39]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </Link>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "slate" | "red" | "teal" | "gold" }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-700",
    teal: "bg-teal-100 text-teal-800",
    gold: "bg-[#fff2b8] text-[#836100]",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${tone === "danger" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black text-[#083f39]">
      {label}
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-[#083f39]">
      <input checked={checked} className="h-4 w-4 accent-emerald-600" type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
    />
  );
}

function formatMoney(value: string) {
  return `${formatter.format(Number(value))} so'm`;
}
