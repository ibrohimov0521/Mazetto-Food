const rootDomain = "mazettofood.uz";

export function isMazettoFoodHost(hostname) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalizedHostname === rootDomain ||
    normalizedHostname.endsWith(`.${rootDomain}`)
  );
}
