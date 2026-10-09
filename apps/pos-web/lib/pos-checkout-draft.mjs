/**
 * @typedef {{ key: string; payloadSignature: string }} PosCheckoutAttempt
 * @typedef {{ key: string; productId: string; variantId?: string | null; modifierIds: string[]; quantity: number }} PosCartLineDraft
 * @typedef {{
 *   lines: PosCartLineDraft[];
 *   checkoutAttempt: PosCheckoutAttempt | null;
 *   orderType: "TAKEAWAY" | "DINE_IN";
 *   payLater: boolean;
 *   tableId: string;
 *   paymentCode: string;
 *   cashReceived: string;
 * }} PosCheckoutDraft
 */

/** @param {unknown} value */
function isCartLine(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const line = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof line.key === "string" &&
    typeof line.productId === "string" &&
    (line.variantId === undefined ||
      line.variantId === null ||
      typeof line.variantId === "string") &&
    Array.isArray(line.modifierIds) &&
    line.modifierIds.every((id) => typeof id === "string") &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0
  );
}

/** @param {string} raw @returns {PosCheckoutDraft | null} */
export function parsePosCheckoutDraft(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (!parsed.every(isCartLine)) return null;
      return {
        lines: parsed,
        checkoutAttempt: null,
        orderType: "TAKEAWAY",
        payLater: false,
        tableId: "",
        paymentCode: "CASH",
        cashReceived: "",
      };
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.lines) ||
      !parsed.lines.every(isCartLine)
    ) {
      return null;
    }
    const attempt = parsed.checkoutAttempt;
    const checkoutAttempt =
      attempt &&
      typeof attempt.key === "string" &&
      attempt.key.length > 0 &&
      attempt.key.length <= 256 &&
      typeof attempt.payloadSignature === "string"
        ? { key: attempt.key, payloadSignature: attempt.payloadSignature }
        : null;
    return {
      lines: parsed.lines,
      checkoutAttempt,
      orderType: parsed.orderType === "DINE_IN" ? "DINE_IN" : "TAKEAWAY",
      payLater: parsed.orderType === "DINE_IN" && parsed.payLater === true,
      tableId: typeof parsed.tableId === "string" ? parsed.tableId : "",
      paymentCode:
        typeof parsed.paymentCode === "string" ? parsed.paymentCode : "CASH",
      cashReceived:
        typeof parsed.cashReceived === "string" ? parsed.cashReceived : "",
    };
  } catch {
    return null;
  }
}

/** @param {PosCheckoutDraft} draft */
export function serializePosCheckoutDraft(draft) {
  return JSON.stringify({ version: 1, ...draft });
}
