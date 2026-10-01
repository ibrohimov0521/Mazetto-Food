const rootDomain = "mazettofood.uz";
const tenantApiHosts = new Set([
  "mazettofood.uz",
  "www.mazettofood.uz",
  "pos.mazettofood.uz",
]);

export function getMazettoFoodApiBaseUrl(hostname) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  return tenantApiHosts.has(normalizedHostname)
    ? "https://api.mazettofood.uz/api/v1"
    : null;
}

export function isMazettoFoodHost(hostname) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalizedHostname === rootDomain ||
    normalizedHostname.endsWith(`.${rootDomain}`)
  );
}
