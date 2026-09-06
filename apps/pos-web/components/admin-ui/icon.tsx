"use client";

import type { ReactNode } from "react";

/*
 * Ikonka tizimi.
 *
 * Oldin nav elementi va `InfoBox` ikonkasi o'rniga yorliqning birinchi harfi
 * turardi (`label.slice(0, 1)`). Bu vizual muammo emas edi: 23 menyu
 * elementidan 13 tasi boshqa element bilan bir xil harfga tushardi
 * (B×2, O×2, S×3, M×2, R×2, X×2), shuning uchun yig'ilgan sidebar
 * navigatsiya sifatida umuman ishlamasdi.
 *
 * Tashqi kutubxona o'rnatilmadi. Inline yo'llar ~5 KB; `lucide-react` paketi
 * ~1.2 MB va `"use client"` chegarasida tree-shaking ishonchsiz.
 *
 * Har bir ikonka 24×24 ramkada, `stroke-width` 1.75, yumaloq uchli — bir xil
 * optik og'irlik uchun. Rang `currentColor` dan keladi, ya'ni ikonka
 * o'zi turgan matn rangiga ergashadi.
 */

export type IconName =
  // navigatsiya
  | "gauge"
  | "receipt"
  | "globe"
  | "grid"
  | "flame"
  | "utensils"
  | "folder"
  | "plusCircle"
  | "megaphone"
  | "boxes"
  | "book"
  | "truck"
  | "users"
  | "user"
  | "shield"
  | "chart"
  | "building"
  | "printer"
  | "scroll"
  | "clipboard"
  | "clock"
  | "wallet"
  | "banknote"
  // interfeys
  | "search"
  | "bell"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "arrowUp"
  | "arrowDown"
  | "sort"
  | "pencil"
  | "eye"
  | "trash"
  | "alert"
  | "inbox"
  | "plus"
  | "download"
  | "filter"
  | "check"
  | "close"
  | "menu"
  | "monitor"
  | "send"
  | "logout";

const shapes: Record<IconName, ReactNode> = {
  gauge: (
    <>
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="M12 16l4.2-4.6" />
      <circle cx="12" cy="16" r="1.4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4Z" />
      <path d="M9.2 8.4h5.6M9.2 12.4h5.6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" />
    </>
  ),
  grid: (
    <>
      <rect height="7" rx="1.6" width="7" x="3.5" y="3.5" />
      <rect height="7" rx="1.6" width="7" x="13.5" y="3.5" />
      <rect height="7" rx="1.6" width="7" x="3.5" y="13.5" />
      <rect height="7" rx="1.6" width="7" x="13.5" y="13.5" />
    </>
  ),
  flame: (
    <>
      <path d="M12 22a6 6 0 0 0 6-6c0-5-6-12-6-12S6 11 6 16a6 6 0 0 0 6 6Z" />
      <path d="M12 18.5a2.4 2.4 0 0 0 2.4-2.4c0-2-2.4-4.4-2.4-4.4s-2.4 2.4-2.4 4.4A2.4 2.4 0 0 0 12 18.5Z" />
    </>
  ),
  utensils: (
    <>
      <path d="M6.5 3v6a2.6 2.6 0 0 0 5.2 0V3" />
      <path d="M9.1 11.6V21" />
      <path d="M18 3v18" />
      <path d="M18 12.4c2.3-1.1 2.3-8.3 0-9.4" />
    </>
  ),
  folder: (
    <path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.6l2.2 2.2h7.8A2.2 2.2 0 0 1 21 9.4v7.4A2.2 2.2 0 0 1 18.8 19H5.2A2.2 2.2 0 0 1 3 16.8Z" />
  ),
  plusCircle: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 8.2v7.6M8.2 12h7.6" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.2v3.6a1.2 1.2 0 0 0 1.2 1.2h2.6L16 19.4V4.6L7.8 9H5.2A1.2 1.2 0 0 0 4 10.2Z" />
      <path d="M19 9.4a4 4 0 0 1 0 5.2" />
      <path d="M7.8 15v4.4" />
    </>
  ),
  boxes: (
    <>
      <path d="M12 3.2 20 7v10l-8 3.8L4 17V7Z" />
      <path d="M4 7l8 3.8L20 7" />
      <path d="M12 10.8V20.8" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.4A2.4 2.4 0 0 1 7.4 2H19v16.4H7.4A2.4 2.4 0 0 0 5 20.8Z" />
      <path d="M19 18.4H7.4A2.4 2.4 0 0 0 5 20.8" />
      <path d="M9 6.6h6" />
    </>
  ),
  truck: (
    <>
      <path d="M2.6 6h11.2v10H2.6z" />
      <path d="M13.8 9.2h3.9l3.7 3.6V16h-7.6z" />
      <circle cx="7" cy="18.4" r="1.8" />
      <circle cx="17.6" cy="18.4" r="1.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.6 20c0-3.5 2.9-6.2 6.4-6.2s6.4 2.7 6.4 6.2" />
      <path d="M16.4 5.1a3.4 3.4 0 0 1 0 6.6" />
      <path d="M17.8 14.2c2.3.8 3.6 2.9 3.6 5.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7.6" r="4" />
      <path d="M4.2 20.6c0-4.3 3.5-7.4 7.8-7.4s7.8 3.1 7.8 7.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 19.6 6v5.8c0 4.8-3.2 8.4-7.6 9.4-4.4-1-7.6-4.6-7.6-9.4V6Z" />
      <path d="M9 12.2l2.2 2.2 4-4" />
    </>
  ),
  chart: (
    <>
      <path d="M3.2 20.4h17.6" />
      <path d="M6.6 20.4v-6.2M11 20.4V6.6M15.4 20.4v-9M19.8 20.4v-4" />
    </>
  ),
  building: (
    <>
      <path d="M4.4 21V4.6a1.6 1.6 0 0 1 1.6-1.6h7.2a1.6 1.6 0 0 1 1.6 1.6V21" />
      <path d="M14.8 9.6h2.8a1.6 1.6 0 0 1 1.6 1.6V21" />
      <path d="M2.6 21h18.8" />
      <path d="M8 7.4h1M11.4 7.4h1M8 11.4h1M11.4 11.4h1M8 15.4h1M11.4 15.4h1" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9.2V3.6h10v5.6" />
      <path d="M5 9.2h14a2 2 0 0 1 2 2v5h-4v4.2H7V16.2H3v-5a2 2 0 0 1 2-2Z" />
      <path d="M7.8 16.2h8.4" />
    </>
  ),
  scroll: (
    <>
      <path d="M6.6 3H17a1.8 1.8 0 0 1 1.8 1.8V18a3 3 0 0 1-3 3H7.4a3 3 0 0 1-3-3V5.4" />
      <path d="M4.4 5.4A2.4 2.4 0 0 1 6.8 3" />
      <path d="M9 8.4h6.4M9 12.2h6.4M9 16h3.8" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4.2H6.8A1.8 1.8 0 0 0 5 6v13.2A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V6a1.8 1.8 0 0 0-1.8-1.8H15" />
      <rect height="3.6" rx="1.2" width="6" x="9" y="2.4" />
      <path d="M8.6 11.4l1.6 1.6 3-3" />
      <path d="M14.4 16.4h-5.8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 6.8V12l3.6 2.2" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 8a2.2 2.2 0 0 1 2.2-2.2h11.6A2.2 2.2 0 0 1 19 8v9a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17Z" />
      <path d="M17.4 11.4H21v4.2h-3.6a2.1 2.1 0 0 1 0-4.2Z" />
    </>
  ),
  banknote: (
    <>
      <rect height="10.8" rx="2" width="19.2" x="2.4" y="6.6" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10.4v3.2M18 10.4v3.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.4 20.4 16 16" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16.2v-4.6a6 6 0 1 0-12 0v4.6L4.2 19h15.6Z" />
      <path d="M10 21.2a2.4 2.4 0 0 0 4 0" />
    </>
  ),
  chevronLeft: <path d="M14.6 5.4 8 12l6.6 6.6" />,
  chevronRight: <path d="M9.4 5.4 16 12l-6.6 6.6" />,
  chevronDown: <path d="M6.4 9.4 12 15l5.6-5.6" />,
  arrowUp: (
    <>
      <path d="M12 19.4V5.2" />
      <path d="M6.2 11 12 5.2 17.8 11" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 4.6v14.2" />
      <path d="M6.2 13 12 18.8 17.8 13" />
    </>
  ),
  sort: (
    <>
      <path d="M8 10l4-4 4 4" />
      <path d="M8 14l4 4 4-4" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4.2L20 8.2 15.8 4 4 15.8Z" />
      <path d="M14.2 5.6 18.4 9.8" />
    </>
  ),
  eye: (
    <>
      <path d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.8h16" />
      <path d="M9.2 6.8V4.2h5.6v2.6" />
      <path d="M6.2 6.8 7.3 20h9.4l1.1-13.2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.4 21.4 20H2.6Z" />
      <path d="M12 9.6v4.6M12 17.4h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13.2h4.6l1.5 2.8h5.8l1.5-2.8H21" />
      <path d="M3 13.2 6.2 4.6h11.6L21 13.2v5.2A2 2 0 0 1 19 20.4H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  download: (
    <>
      <path d="M12 3.6v10.8" />
      <path d="M7.4 10 12 14.6 16.6 10" />
      <path d="M4 18.4v.6a1.4 1.4 0 0 0 1.4 1.4h13.2a1.4 1.4 0 0 0 1.4-1.4v-.6" />
    </>
  ),
  filter: <path d="M3.4 5h17.2l-6.8 8v6.4l-3.6 1.8V13Z" />,
  check: <path d="M4.4 12.6 9.4 17.6 19.8 7.2" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  monitor: (
    <>
      <rect height="12.4" rx="2" width="18.8" x="2.6" y="4" />
      <path d="M8.4 20.4h7.2M12 16.4v4" />
    </>
  ),
  send: (
    <>
      <path d="M21 3.4 10.4 14" />
      <path d="M21 3.4 14.2 21l-3.8-7-7-3.8Z" />
    </>
  ),
  logout: (
    <>
      <path d="M15.4 16.6 20 12l-4.6-4.6" />
      <path d="M20 12H9.4" />
      <path d="M12.4 4H6.2A2.2 2.2 0 0 0 4 6.2v11.6A2.2 2.2 0 0 0 6.2 20h6.2" />
    </>
  ),
};

/**
 * Ikonka.
 *
 * `aria-hidden` — ikonka hech qachon yagona ma'no tashuvchi bo'lmasligi kerak.
 * Yonida matn bo'lmasa (masalan ikonka-tugma), o'rab turuvchi element
 * `aria-label` berishi shart.
 */
export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      {shapes[name]}
    </svg>
  );
}

/** Validator va testlar uchun — aniqlangan barcha ikonka nomlari. */
export const iconNames = Object.keys(shapes) as IconName[];
