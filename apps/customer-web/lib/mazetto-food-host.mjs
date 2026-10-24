const restaurantRootDomain = "mazettofood.uz";
const platformRootDomain = "mazetto.uz";
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
    normalizedHostname.endsWith("." + restaurantRootDomain) ||
    normalizedHostname === platformRootDomain ||
    normalizedHostname.endsWith("." + platformRootDomain)
  );
}

export function resolveCustomerApiBaseUrl({ hostname, nodeEnv, configuredUrl, isBrowser }) {
  const normalizedHostname = (hostname || "").trim().toLowerCase().replace(/\.$/, "");
  const tenantApiBaseUrl = normalizedHostname
    ? getMazettoFoodCustomerApiBaseUrl(normalizedHostname)
    : null;

  if (isBrowser && nodeEnv === "production") {
    // The request host is the tenant identity. Same-origin proxying preserves it
    // for verified external restaurant domains and Mazetto subdomains alike.
    return tenantApiBaseUrl || "/api/v1";
  }
  if (isMazettoFoodHost(normalizedHostname)) return "/api/v1";
  if (configuredUrl) return configuredUrl.trim().replace(/\/$/, "");
  const developmentHost = isBrowser && normalizedHostname ? normalizedHostname : "127.0.0.1";
  return `http://${developmentHost}:4000/api/v1`;
}
