"use client";

import Image from "next/image";
import { useState } from "react";
import { handleProductImageError, productImage } from "../lib/media";
import { canOptimizeProductImage } from "../lib/media-image-config.mjs";

type CatalogProductImageProps = {
  src?: string | null | undefined;
  eager?: boolean;
};

export function CatalogProductImage(props: CatalogProductImageProps) {
  return <CatalogProductImageContent key={props.src ?? "missing"} {...props} />;
}

function CatalogProductImageContent({
  src,
  eager = false,
}: CatalogProductImageProps) {
  const [useOriginal, setUseOriginal] = useState(false);
  const resolvedSrc = productImage(src);
  const optimized =
    !useOriginal &&
    canOptimizeProductImage(resolvedSrc, process.env.NEXT_PUBLIC_MEDIA_URL);

  if (optimized) {
    return (
      <Image
        src={resolvedSrc}
        alt=""
        fill
        sizes="(max-width: 767px) 50vw, 256px"
        quality={75}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onError={() => setUseOriginal(true)}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      onError={(event) => handleProductImageError(event.currentTarget)}
    />
  );
}
