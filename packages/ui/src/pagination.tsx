"use client";

import { Button } from "./button";
import { Icon } from "./icon";

/*
 * Sahifalash.
 *
 * Oltita ekranda (audit, xarajatlar, buyurtmalar, to'lovlar, cheklar,
 * smenalar) bir xil blok qo'lda qayta yozilgan edi.
 *
 * NEGA raqamli sahifalar YO'Q: bu endpointlar massiv qaytaradi, umumiy sonni
 * emas. Umumiy son bo'lmasa oxirgi sahifa raqamini hisoblab bo'lmaydi.
 * "Keyingi" tugmasi to'liq sahifa kelganidagina faol bo'ladi — bu backend
 * beradigan yagona ishonchli signal. Endpoint `total` qaytara boshlasa,
 * `total` propini bering va matn o'zi to'liqroq bo'ladi.
 */

export function Pagination({
  offset,
  pageSize,
  count,
  total,
  isLoading = false,
  onOffsetChange,
  noun = "yozuv",
}: {
  offset: number;
  pageSize: number;
  /** Shu sahifada nechta yozuv keldi. */
  count: number;
  /** Backend umumiy sonni bersa. */
  total?: number;
  isLoading?: boolean;
  onOffsetChange: (offset: number) => void;
  /** "21–40-buyurtma" dagi so'z. */
  noun?: string;
}) {
  const from = count === 0 ? 0 : offset + 1;
  const to = offset + count;
  const isFirstPage = offset === 0;
  const isLastPage = count < pageSize;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
      <p className="text-[13px] text-mz-text-muted" role="status">
        {count === 0
          ? `${noun} yo'q`
          : total === undefined
            ? `${from}–${to}-${noun}`
            : `${total} tadan ${from}–${to}`}
      </p>

      <div className="flex gap-2">
        <Button
          disabled={isFirstPage || isLoading}
          onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
          size="sm"
          variant="ghost"
        >
          <Icon className="h-3.5 w-3.5" name="chevronLeft" />
          Oldingi
        </Button>
        <Button
          disabled={isLastPage || isLoading}
          onClick={() => onOffsetChange(offset + pageSize)}
          size="sm"
          variant="ghost"
        >
          Keyingi
          <Icon className="h-3.5 w-3.5" name="chevronRight" />
        </Button>
      </div>
    </div>
  );
}
