"use client";

import { CustomerMenuSections } from "../../components/customer-menu-sections";
import { SiteShell } from "../../components/site-shell";

export default function MenuPage() {
  return (
    <SiteShell>
      <CustomerMenuSections />
    </SiteShell>
  );
}
