import { BadRequestException } from "@nestjs/common";

const uzbekistanLocalPhoneLength = 9;
const uzbekistanCountryCode = "998";
const uzbekistanInternationalPhoneLength =
  uzbekistanCountryCode.length + uzbekistanLocalPhoneLength;

export function normalizeCustomerPhone(phone: string): string {
  const trimmed = phone.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === uzbekistanLocalPhoneLength) {
    digits = `${uzbekistanCountryCode}${digits}`;
  }

  if (
    digits.length !== uzbekistanInternationalPhoneLength ||
    !digits.startsWith(uzbekistanCountryCode)
  ) {
    throw new BadRequestException("Phone number is invalid");
  }

  if (hasInternationalPrefix && !trimmed.replace(/[^\d+]/g, "").startsWith("+998")) {
    throw new BadRequestException("Phone number is invalid");
  }

  return `+${digits}`;
}
