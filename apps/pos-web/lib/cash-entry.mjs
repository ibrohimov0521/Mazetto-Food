const MAX_CASH_DIGITS = 12;

export function sanitizeCashInput(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, MAX_CASH_DIGITS);
  return digits.replace(/^0+(?=\d)/, "");
}
