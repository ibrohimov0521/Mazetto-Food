import { notFound } from "next/navigation";
import { CheckoutPreview } from "../../../components/checkout-preview";

export const dynamic = "force-dynamic";
export default function CheckoutPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CheckoutPreview />;
}
