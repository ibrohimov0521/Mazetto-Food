"use client";

import { useEffect } from "react";
import {
  findDialogEnterAction,
  shouldUseDialogEnter,
} from "../lib/keyboard-shortcuts.mjs";

export function KeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!shouldUseDialogEnter(event, target)) return;

      const dialog = target?.closest<HTMLElement>(
        'dialog[open], [role="dialog"], [role="alertdialog"]',
      ) ?? document.querySelector<HTMLElement>(
        'dialog[open], [role="dialog"], [role="alertdialog"]',
      );
      if (!dialog) return;

      const form = target?.closest<HTMLFormElement>("form");
      if (form && target?.matches("input")) {
        event.preventDefault();
        form.requestSubmit();
        return;
      }

      const action = findDialogEnterAction(dialog) as HTMLButtonElement | null;
      if (!action) return;

      event.preventDefault();
      action.click();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
