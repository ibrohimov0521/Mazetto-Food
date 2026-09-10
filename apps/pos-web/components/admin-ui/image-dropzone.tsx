"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { getApiBaseUrl } from "../../lib/auth";
import { readSession } from "../../lib/session";

/*
 * Rasm yuklash zonasi (7-bosqich Q4).
 *
 * MUAMMO. Rasm maydoni ODDIY MATN edi: admin `/products/lavash-big.webp`
 * kabi yo'lni qo'lda yozardi va faylni serverga ALOHIDA joylashtirishi kerak
 * bo'lardi. Ikkita qadam bir-biridan uzilgani uchun qator bazada bo'lib,
 * fayl esa hech qachon serverga chiqmasligi mumkin edi — AUD-009 aynan shu.
 *
 * Matn maydoni ATAYLAB SAQLANADI: mavjud 74 mahsulotning yo'llari allaqachon
 * yozilgan va ularni yuklab qayta ishlash bu ishning qamrovidan tashqarida.
 * Yuklash yo'lni to'ldiradi, uni almashtirmaydi.
 */

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

type UploadResponse = { url: string; objectName: string };

export function ImageDropzone({
  value,
  folder = "products",
  onUploaded,
}: {
  value: string;
  folder?: "products" | "categories" | "homepage";
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const describedBy = useId();

  const upload = useCallback(
    async (file: File) => {
      setError(null);

      // Hajmni BROWZERDA ham tekshiramiz: server baribir rad etadi, lekin
      // 6 MB ni yuklab, keyin 413 olish behuda kutish.
      if (file.size > MAX_BYTES) {
        setError("Fayl 5 MB dan katta");
        return;
      }

      setUploading(true);

      try {
        /*
         * `apiFetch` ishlatilmaydi: u `Content-Type: application/json` qo'yadi
         * va tanani JSON deb ko'radi. `FormData` uchun brauzer chegara
         * (`boundary`) bilan o'z sarlavhasini qo'yishi SHART.
         */
        const session = readSession();
        const response = await fetch(
          `${getApiBaseUrl()}/uploads/image?folder=${folder}`,
          {
            method: "POST",
            headers: session
              ? { Authorization: `Bearer ${session.tokens.accessToken}` }
              : {},
            body: (() => {
              const data = new FormData();
              data.append("file", file);
              return data;
            })(),
          },
        );

        const payload = (await response.json()) as {
          success: boolean;
          data?: UploadResponse;
          error?: { message: string | string[] };
        };

        if (!response.ok || !payload.success || !payload.data) {
          const message = payload.error?.message;
          throw new Error(
            Array.isArray(message) ? message.join(", ") : message ?? "Yuklab bo'lmadi",
          );
        }

        onUploaded(payload.data.url);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Yuklab bo'lmadi");
      } finally {
        setUploading(false);
      }
    },
    [folder, onUploaded],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        aria-describedby={describedBy}
        className={`flex items-center gap-3 rounded-mz-card border border-dashed p-3 transition ${
          dragging
            ? "border-mz-accent bg-mz-info-bg"
            : "border-mz-border bg-mz-surface-sunken"
        }`}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];

          if (file) {
            void upload(file);
          }
        }}
      >
        {value ? (
          // Oldindan ko'rish `<img>` bilan: `next/image` tashqi manzil uchun
          // `remotePatterns` sozlamasini talab qiladi va 56px eskiz uchun
          // hech narsa qo'shmaydi. Repo boshqa joyda ham `<img>` ishlatadi.
          <img
            alt=""
            className="h-14 w-14 shrink-0 rounded-mz-control border border-mz-border object-cover"
            src={value}
          />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-mz-control border border-mz-border bg-mz-surface text-mz-text-faint">
            <Icon name="download" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs text-mz-text-muted" id={describedBy}>
            Rasmni shu yerga tashlang yoki tanlang. PNG, JPEG, WebP, GIF —
            5 MB gacha.
          </p>
          {error ? (
            <p className="mt-1 text-xs font-medium text-mz-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <Button
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          variant="ghost"
        >
          {uploading ? "Yuklanmoqda…" : "Fayl tanlash"}
        </Button>

        <input
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void upload(file);
            }

            // Bir xil faylni qayta tanlash ham hodisa bersin.
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>
    </div>
  );
}
