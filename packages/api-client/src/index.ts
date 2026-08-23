import type { ServiceHealth } from "@mazetto/types";

export async function getBackendHealth(baseUrl: string): Promise<ServiceHealth> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${normalizedBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return (await response.json()) as ServiceHealth;
}
