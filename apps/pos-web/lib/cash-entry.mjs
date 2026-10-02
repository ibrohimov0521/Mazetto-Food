const MAX_CASH_DIGITS = 12;

export function sanitizeCashInput(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, MAX_CASH_DIGITS);
  return digits.replace(/^0+(?=\d)/, "");
}

export function appendCashInput(value, key) {
  if (!/^(?:\d|000)$/.test(key)) return sanitizeCashInput(value);
  const current = sanitizeCashInput(value);
  const next = current + key;
  if (next.length > MAX_CASH_DIGITS) return current;
  return sanitizeCashInput(next);
}

export function removeCashDigit(value) {
  return sanitizeCashInput(value).slice(0, -1);
}
