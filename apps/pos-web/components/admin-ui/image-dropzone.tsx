"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { getApiBaseUrl } from "../../lib/auth";
import { readSession } from "../../lib/session";

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";
const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 5 * 1024 * 1024;

type UploadResponse = { url: string; objectName: string };
type ImageProfile = "product" | "hero" | "promotion";
type ImageDimensions = { width: number; height: number };

const PROFILE_COPY: Record<
  ImageProfile,
  {
    label: string;
    recommendation: string;
    minimum: ImageDimensions;
    ratio: string;
  }
> = {
  product: {
    label: "Mahsulot rasmi",
    recommendation: "Tavsiya: 1200 × 900 px (4:3).",
    minimum: { width: 600, height: 450 },
    ratio: "aspect-[4/3]",
  },
  hero: {
    label: "Hero slayd rasmi",
    recommendation:
      "Tavsiya: 1600 × 900 px (16:9). Muhim obyektni markazga qo'ying.",
    minimum: { width: 1200, height: 675 },
    ratio: "aspect-[16/9]",
  },
  promotion: {
    label: "Aksiya rasmi",
    recommendation:
      "Tavsiya: 1200 × 900 px (4:3). Muhim matn va obyekt markazda bo'lsin.",
    minimum: { width: 600, height: 450 },
    ratio: "aspect-[4/3]",
  },
};

function readImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    image.src = objectUrl;
  });
}

export function ImageDropzone({
  value,
  folder = "products",
  imageProfile = "product",
  onUploaded,
}: {
  value: string;
  folder?: "products" | "categories" | "homepage";
  imageProfile?: ImageProfile;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const describedBy = useId();
  const copy = PROFILE_COPY[imageProfile];

  useEffect(() => {
    setDimensions(null);
  }, [value]);

  const upload = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.has(file.type)) {
        setError("Faqat PNG, JPEG, WebP yoki GIF rasm yuklang.");
        return;
      }

      if (file.size > MAX_BYTES) {
        setError(
          "Fayl 5 MB dan katta. Sifatni saqlagan holda hajmini kamaytiring.",
        );
        return;
      }

      let nextDimensions: ImageDimensions;
      try {
        nextDimensions = await readImageDimensions(file);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Rasmni o'qib bo'lmadi",
        );
        return;
      }

      if (
        nextDimensions.width < copy.minimum.width ||
        nextDimensions.height < copy.minimum.height
      ) {
        setError(
          `Rasm juda kichik. Kamida ${copy.minimum.width} × ${copy.minimum.height} px bo'lishi kerak.`,
        );
        return;
      }

      setDimensions(nextDimensions);
      setUploading(true);

      try {
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
            Array.isArray(message)
              ? message.join(", ")
              : (message ?? "Yuklab bo'lmadi"),
          );
        }

        onUploaded(payload.data.url);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Yuklab bo'lmadi");
      } finally {
        setUploading(false);
      }
    },
    [copy.minimum.height, copy.minimum.width, folder, onUploaded],
  );

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div
          className={`relative w-full overflow-hidden rounded-mz-card border border-mz-border bg-mz-surface-sunken ${copy.ratio}`}
        >
          <img
            alt={`${copy.label} preview`}
            className="h-full w-full object-cover"
            onError={() =>
              setError("Rasmni ko'rsatib bo'lmadi. Manzilni tekshiring.")
            }
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            src={value}
          />
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
            Mijoz ko'rinishi
          </span>
        </div>
      ) : null}

      <div
        aria-describedby={describedBy}
        className={`flex flex-wrap items-center gap-3 rounded-mz-card border border-dashed p-3 transition ${
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

        <div className="min-w-[12rem] flex-1">
          <p className="text-[13px] text-mz-text-muted" id={describedBy}>
            {copy.recommendation} PNG, JPEG, WebP yoki GIF — 5 MB gacha.
          </p>
          <p className="mt-1 text-[12px] text-mz-text-faint">
            {dimensions
              ? `${dimensions.width} × ${dimensions.height} px · ${copy.label}`
              : "Yuklashdan oldin piksel sifati tekshiriladi."}
          </p>
          {error ? (
            <p
              className="mt-1 text-[13px] font-medium text-mz-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <Button
          isLoading={uploading}
          onClick={() => inputRef.current?.click()}
          variant="ghost"
        >
          {uploading ? "Yuklanmoqda" : "Fayl tanlash"}
        </Button>

        <input
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void upload(file);
            }

            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>
    </div>
  );
}
