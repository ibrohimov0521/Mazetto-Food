"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const themeKey = "mazetto-theme";

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const saved = window.localStorage?.getItem(themeKey);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  return "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initialTheme = resolveInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage?.setItem(themeKey, nextTheme);
    } catch {
      // Theme still changes for this session when persistent storage is unavailable.
    }
  }

  const isLight = theme === "light";

  return (
    <motion.button
      aria-label={isLight ? "Tungi rejimga o'tish" : "Kunduzgi rejimga o'tish"}
      aria-pressed={isLight}
      className="pressable ripple mazetto-glass-button relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/76 md:h-11 md:w-11"
      onClick={toggleTheme}
      transition={{ type: "spring", stiffness: 520, damping: 32 }}
      type="button"
      whileTap={{ scale: 0.94 }}
    >
      <motion.span
        animate={{ opacity: isLight ? 1 : 0, rotate: isLight ? 0 : -50, scale: isLight ? 1 : 0.72 }}
        className="absolute"
        initial={false}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        <SunIcon />
      </motion.span>
      <motion.span
        animate={{ opacity: isLight ? 0 : 1, rotate: isLight ? 50 : 0, scale: isLight ? 0.72 : 1 }}
        className="absolute"
        initial={false}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        <MoonIcon />
      </motion.span>
    </motion.button>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M12 4V2M12 22v-2M4.93 4.93 3.51 3.51M20.49 20.49l-1.42-1.42M4 12H2M22 12h-2M4.93 19.07l-1.42 1.42M20.49 3.51l-1.42 1.42" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M20.2 15.8A8.5 8.5 0 0 1 8.2 3.8 8.5 8.5 0 1 0 20.2 15.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
