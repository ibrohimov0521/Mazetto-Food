/**
 * Rebuild modifier choices from the current catalog, not stale order config.
 * Invalid current constraints fail closed so checkout can report the line as skipped.
 *
 * @param {{ id?: string | null; quantity?: string | number | null }[]} snapshotModifiers
 * @param {{ isRequired?: boolean; minSelect?: number; maxSelect?: number | null; modifier: { id: string; name: string; price: string } }[]} productModifiers
 * @returns {{ modifierId: string; name: string; price: string; quantity: number }[] | null}
 */
export function restoreReorderModifiers(snapshotModifiers, productModifiers) {
  const snapshots = new Map();
  for (const snapshot of snapshotModifiers) {
    if (snapshot.id && !snapshots.has(snapshot.id)) {
      snapshots.set(snapshot.id, snapshot);
    }
  }

  const restored = [];
  for (const link of productModifiers) {
    const minimum = Math.max(link.minSelect ?? 0, link.isRequired ? 1 : 0);
    const maximum = link.maxSelect ?? Number.POSITIVE_INFINITY;
    if (
      !Number.isInteger(minimum) ||
      minimum < 0 ||
      (maximum !== Number.POSITIVE_INFINITY &&
        (!Number.isInteger(maximum) || maximum < minimum))
    ) {
      return null;
    }

    const snapshot = snapshots.get(link.modifier.id);
    const requested = Number(snapshot ? (snapshot.quantity ?? 1) : minimum);
    const safeRequested =
      Number.isFinite(requested) && requested > 0
        ? Math.trunc(requested)
        : minimum;
    const quantity = Math.min(maximum, Math.max(minimum, safeRequested));
    if (quantity > 0) {
      restored.push({
        modifierId: link.modifier.id,
        name: link.modifier.name,
        price: link.modifier.price,
        quantity,
      });
    }
  }

  return restored;
}
