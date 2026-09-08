"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { AnimatedMoney } from "./motion-primitives";
import "./order-action-bar.css";

type Props = {
  total: number;
  label: string;
  href?: string;
  onConfirm?: () => void;
  disabled?: boolean;
  busy?: boolean;
  totalLabel?: string;
  notice?: string | null;
};

export function OrderActionBar({
  total,
  label,
  href,
  onConfirm,
  disabled,
  busy,
  totalLabel = "Jami",
  notice,
}: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Keep the viewport bar outside animated page containers.
    setHost(document.body);
    return () => setHost(null);
  }, []);
  if (!host) return null;
  const content = (
    <>
      <span>{label}</span>
      {busy ? (
        <LoaderCircle className="mf-order-spinner" size={19} />
      ) : (
        <ArrowRight size={19} />
      )}
    </>
  );
  return createPortal(
    <div
      className="mf-order-action"
      role="region"
      aria-label="Buyurtmani yakunlash"
    >
      {notice ? (
        <p className="mf-order-action-notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="mf-order-action-row">
        <div className="mf-order-action-total">
          <span>{totalLabel}</span>
          <strong>
            <AnimatedMoney value={total} />
          </strong>
        </div>
        {href ? (
          <Link className="mf-order-action-button" href={href}>
            {content}
          </Link>
        ) : (
          <button
            className="mf-order-action-button"
            type="button"
            disabled={disabled}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {content}
          </button>
        )}
      </div>
    </div>,
    host,
  );
}
