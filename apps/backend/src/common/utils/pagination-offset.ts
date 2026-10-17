export const MAX_PAGINATION_OFFSET = 1_000_000;

export function normalizePaginationOffset(value?: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(MAX_PAGINATION_OFFSET, Math.max(0, Math.trunc(parsed)));
}
