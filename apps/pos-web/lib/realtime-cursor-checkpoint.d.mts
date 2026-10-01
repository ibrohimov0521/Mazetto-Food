export function refreshBeforeCursorCheckpoint(
  refresh: () => void | boolean | Promise<void | boolean>,
  persist: () => void | Promise<void>,
  canCheckpoint?: () => boolean,
): Promise<boolean>;
