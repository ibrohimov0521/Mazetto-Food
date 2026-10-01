export type OfflineWaiterSnapshot = {
  branchId: string;
  generatedAt: string;
  tables: unknown[];
  categories: unknown[];
  products: unknown[];
};

export function readOfflineWaiterSnapshot(
  snapshot: unknown,
  expectedBranchId: string | null | undefined,
  includeMenu?: boolean,
): OfflineWaiterSnapshot | null;
