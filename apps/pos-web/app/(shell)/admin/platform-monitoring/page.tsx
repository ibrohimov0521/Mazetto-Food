import { redirect } from "next/navigation";

export default function PlatformMonitoringPage() {
  redirect("/admin/system-health");
}
