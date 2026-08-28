"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BrandLogo } from "./brand-logo";

const splashKey = "mazetto.customer.splash.seen";

export function BrandSplash({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || window.localStorage.getItem(splashKey)) {
      return;
    }

    setVisible(true);
    window.localStorage.setItem(splashKey, "1");
    const timeout = window.setTimeout(() => setVisible(false), 1750);
    return () => window.clearTimeout(timeout);
  }, [enabled]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-[#0B0B0B]"
          exit={{ opacity: 0, scale: 1.02 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="text-center"
            initial={{ opacity: 0, scale: 0.88, y: 18 }}
            transition={{ delay: 0.16, duration: 0.62, type: "spring", stiffness: 220, damping: 24 }}
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto w-[min(20rem,82vw)]"
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.26, duration: 0.46 }}
            >
              <BrandLogo className="h-auto w-full drop-shadow-[0_22px_48px_rgba(245,207,0,0.22)]" priority sizes="320px" />
            </motion.div>
            <motion.div
              animate={{ scaleX: 1 }}
              className="mx-auto mt-5 h-1.5 w-32 origin-left rounded-full bg-gradient-to-r from-[#F5CF00] to-[#B9B8F0]"
              initial={{ scaleX: 0 }}
              transition={{ delay: 0.58, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
