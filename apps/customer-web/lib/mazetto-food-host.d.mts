export function getMazettoFoodCustomerApiBaseUrl(hostname: string): string | null;
export function isMazettoFoodHost(hostname: string): boolean;

export function resolveCustomerApiBaseUrl(options: {
  hostname: string;
  nodeEnv: string | undefined;
  configuredUrl: string | undefined;
  isBrowser: boolean;
}): string;
