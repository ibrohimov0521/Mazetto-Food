"use client";

import { Icon, type IconName } from "./icon";

/*
 * Tanlov elementlari — "to'plamdan bittasini tanlash".
 *
 * `Tabs`       sahifa ichidagi ko'rinishlar (segment boshqaruvi)
 * `ChipGroup`  filtr presetlari (dumaloq chiplar)
 *
 * Ikkalasi ham BOSHQARILADIGAN. Ruxsati yo'q tab umuman berilmasligi kerak —
 * komponent permission tekshirmaydi, chaqiruvchi ro'yxatni filtrlaydi.
 */

export type TabItem = {
  key: string;
  label: string;
  icon?: IconName;
};

export function Tabs({
  items,
  active,
  onChange,
  label,
  panelId,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** `aria-label` — ekranda bir nechta tab guruhi bo'lsa ajratish uchun. */
  label: string;
  /**
   * Tab mazmuni turgan elementning `id` si.
   *
   * `role="tab"` ekran o'quvchiga "bu tab" deb aytadi va u bog'liq panelni
   * qidiradi. Panel komponentdan tashqarida render qilingani uchun uning
   * `id` sini chaqiruvchi beradi va o'sha elementga `role="tabpanel"`
   * qo'yadi. Berilmasa — bog'lanish e'lon qilinmaydi.
   */
  panelId?: string;
}) {
  return (
    <div
      aria-label={label}
      className="mz-thin-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-mz-control bg-mz-surface-sunken p-1"
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <button
            aria-controls={panelId}
            aria-selected={isActive}
            className={`flex shrink-0 items-center gap-2 rounded-mz-control px-3.5 py-1.5 text-sm transition ${
              isActive
                ? "bg-mz-surface font-semibold text-mz-text shadow-mz-card"
                : "font-medium text-mz-text-muted hover:text-mz-text"
            }`}
            key={item.key}
            onClick={() => onChange(item.key)}
            role="tab"
            type="button"
          >
            {item.icon ? <Icon className="h-4 w-4" name={item.icon} /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filtr chiplari.
 *
 * Faol chip TEAL, oltin emas. Oltin sahifadagi asosiy harakat uchun
 * zaxiralangan; filtr presetlari ham oltin bo'lsa, ierarxiya yo'qoladi
 * (DESIGN_RULES: "avoid overly colorful dashboards").
 */
export function ChipGroup({
  items,
  active,
  onChange,
  label,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-2" role="group">
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <button
            aria-pressed={isActive}
            className={`rounded-mz-pill border px-3.5 py-1.5 text-sm font-semibold transition ${
              isActive
                ? "border-mz-accent bg-mz-accent text-mz-white"
                : "border-mz-border bg-mz-surface text-mz-text-muted hover:bg-mz-surface-sunken hover:text-mz-text"
            }`}
            key={item.key}
            onClick={() => onChange(item.key)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
