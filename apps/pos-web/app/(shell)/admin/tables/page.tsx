import { redirect } from "next/navigation";

/** Eski manzil uchun moslik: zallar endi filial ichida boshqariladi. */
export default function AdminTablesPage() {
  redirect("/admin/branches");
}
