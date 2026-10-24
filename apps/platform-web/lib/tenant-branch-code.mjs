export const tenantCodePattern = "[A-Za-z0-9][A-Za-z0-9_\\x2d]{0,30}[A-Za-z0-9]";
export const tenantSubdomainPattern = "[a-z0-9](?:[a-z0-9\\x2d]{0,61}[a-z0-9])?";

export function normalizeTenantBranchCodeInput(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_");
}

export function createTenantBranchCodeFromName(value) {
  const code = normalizeTenantBranchCodeInput(value)
    .replace(/[_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .replace(/[_-]+$/g, "");

  if (!code) return "MAIN";
  return code.length === 1 ? code + "1" : code;
}
