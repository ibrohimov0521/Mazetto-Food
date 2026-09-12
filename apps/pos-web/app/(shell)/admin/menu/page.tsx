import { redirect } from "next/navigation";

/*
 * `/admin/menu` — eski manzil. Katalog `/admin/products` ga ko'chirilgan.
 *
 * Ilgari bu `"use client"` sahifa edi va `redirect()` ni RENDER paytida
 * chaqirardi: brauzer avval bo'sh sahifani oladi, keyin JS yuklanib
 * yo'naltiradi. Server komponentida yo'naltirish javob bilan birga keladi —
 * bo'sh kadr yo'q.
 */
export default function AdminMenuPage() {
  redirect("/admin/products");
}
