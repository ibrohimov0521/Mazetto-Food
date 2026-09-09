"use client";

import { useEffect, useRef, useState } from "react";

// The section wrappers used to run a framer-motion opacity tween from 1 to 1,
// so they are plain elements now; the visible entrance comes from CSS.
export const pageMotion = {} as const;
export const sectionMotion = {} as const;
export const buttonMotion = {} as const;

export const MotionDiv = "div";
export const MotionArticle = "article";
export const MotionButton = "button";

const countDuration = 180;

export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / countDuration);
      // Matches the easeOut curve the previous framer-motion tween used.
      const eased = 1 - (1 - progress) * (1 - progress);
      const next = from + (value - from) * eased;
      setDisplay(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }

      fromRef.current = value;
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <span>{Math.round(display).toLocaleString("uz-UZ")}</span>;
}

export function AnimatedMoney({ value }: { value: number }) {
  return (
    <>
      <AnimatedNumber value={value} /> so'm
    </>
  );
}

export function hapticTap(pattern: number | number[] = 12): void {
  if (typeof window === "undefined" || !("vibrate" in window.navigator)) {
    return;
  }

  window.navigator.vibrate(pattern);
}
