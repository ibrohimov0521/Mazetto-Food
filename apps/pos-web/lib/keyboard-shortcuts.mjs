const textInputTypes = new Set([
  "email",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

export function shouldUseDialogEnter(event, target) {
  if (
    event?.key !== "Enter" ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.keyCode === 229 ||
    event.shiftKey ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  ) {
    return false;
  }

  if (
    target?.closest?.(
      'button, a[href], select, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [data-enter-shortcut="off"]',
    )
  ) {
    return false;
  }

  const input = target?.closest?.("input");
  if (input && !textInputTypes.has(String(input.type || "text").toLowerCase())) {
    return false;
  }

  return true;
}

export function findDialogEnterAction(dialog) {
  const primary = dialog?.querySelector?.("button[data-keyboard-primary]");
  if (primary) return primary.disabled ? null : primary;
  return null;
}
