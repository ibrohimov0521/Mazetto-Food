/**
 * @typedef {{ fingerprint: string; key: string }} IdempotencyIntent
 */

/**
 * @param {IdempotencyIntent | null} current
 * @param {string} fingerprint
 * @param {string} scope
 * @returns {IdempotencyIntent}
 */
export function getIdempotencyIntent(current, fingerprint, scope) {
  if (current?.fingerprint === fingerprint) return current;

  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return { fingerprint, key: `${scope}:${token}` };
}
