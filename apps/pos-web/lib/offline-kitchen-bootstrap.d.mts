import type { KitchenQueueResponse } from "../components/kitchen/kitchen-types";

export function readOfflineKitchenSnapshot(
  snapshot: unknown,
  expectedBranchId: string | null | undefined,
): KitchenQueueResponse | null;
