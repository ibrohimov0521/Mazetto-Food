const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BASE_MESSAGE =
  "Serverda vaqtinchalik muammo bor. Bir ozdan keyin qayta urinib ko'ring.";

export function customerServerErrorMessage(requestId) {
  if (typeof requestId !== "string" || !SAFE_REQUEST_ID.test(requestId)) {
    return BASE_MESSAGE;
  }
  return `${BASE_MESSAGE} Murojaat kodi: ${requestId}.`;
}
