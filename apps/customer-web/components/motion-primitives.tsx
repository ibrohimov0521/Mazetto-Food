"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

export const pageMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
} as const;

export const sectionMotion = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
} as const;

export const cardMotion = {
  whileHover: { y: -5, rotateX: 1.2, rotateY: -1.2, scale: 1.012 },
  whileTap: { y: 1, rotateX: 0, rotateY: 0, scale: 0.982 },
  transition: { type: "spring", stiffness: 420, damping: 30 },
} as const;

export const buttonMotion = {
  whileHover: { y: -1 },
  whileTap: { y: 2, scale: 0.955 },
  transition: { type: "spring", stiffness: 520, damping: 28 },
} as const;

export const imageMotion = {
  whileHover: { scale: 1.055, y: -4 },
  whileTap: { scale: 1.025, y: 0 },
  transition: { type: "spring", stiffness: 260, damping: 26 },
} as const;

export const MotionDiv = motion.div;
export const MotionArticle = motion.article;
export const MotionButton = motion.button;

export function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString("uz-UZ"));

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
  }, [motionValue, value]);

  return <motion.span>{rounded}</motion.span>;
}

export function AnimatedMoney({ value }: { value: number }) {
  return (
    <>
      <AnimatedNumber value={value} /> UZS
    </>
  );
}

export function hapticTap(pattern: number | number[] = 12): void {
  if (typeof window === "undefined" || !("vibrate" in window.navigator)) {
    return;
  }

  window.navigator.vibrate(pattern);
}
