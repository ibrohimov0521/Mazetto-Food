"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

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
              animate={{ boxShadow: ["0 0 0 rgba(34,197,94,0)", "0 0 70px rgba(34,197,94,0.36)", "0 0 28px rgba(34,197,94,0.22)"] }}
              className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] bg-gradient-to-br from-[#22C55E] to-[#67E8F9] text-4xl font-black text-[#04130B]"
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              M
            </motion.div>
            <motion.h1
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-3xl font-black tracking-normal text-white"
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.38, duration: 0.38 }}
            >
              MAZETTO FOOD
            </motion.h1>
            <motion.div
              animate={{ scaleX: 1 }}
              className="mx-auto mt-4 h-1 w-32 origin-left rounded-full bg-gradient-to-r from-[#22C55E] to-[#67E8F9]"
              initial={{ scaleX: 0 }}
              transition={{ delay: 0.58, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
