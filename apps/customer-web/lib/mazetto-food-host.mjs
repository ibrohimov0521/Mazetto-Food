const restaurantRootDomain = "mazettofood.uz";
const customerWebHosts = new Set(["mazettofood.uz", "www.mazettofood.uz"]);

export function getMazettoFoodCustomerApiBaseUrl(hostname) {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, "");
  return customerWebHosts.has(normalizedHostname)
    ? "https://api.mazettofood.uz/api/v1"
    : null;
}

export function isMazettoFoodHost(hostname) {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    normalizedHostname === restaurantRootDomain ||
    normalizedHostname.endsWith(`.${restaurantRootDomain}`)
  );
}
