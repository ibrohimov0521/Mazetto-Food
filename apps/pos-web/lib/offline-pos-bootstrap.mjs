const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasStringFields = (value, fields) =>
  isRecord(value) && fields.every((field) => typeof value[field] === "string");

/**
 * @param {unknown} snapshot
 * @param {string | null} expectedBranchId
 */
export function readOfflinePosCatalogSnapshot(snapshot, expectedBranchId) {
  if (
    !isRecord(snapshot) ||
    snapshot.schemaVersion !== 2 ||
    typeof snapshot.branchId !== "string" ||
    !snapshot.branchId ||
    !expectedBranchId ||
    snapshot.branchId !== expectedBranchId ||
    typeof snapshot.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.generatedAt)) ||
    !isRecord(snapshot.catalog)
  ) {
    return null;
  }

  const catalog = snapshot.catalog;
  if (
    catalog.branchId !== snapshot.branchId ||
    !Array.isArray(catalog.categories) ||
    !catalog.categories.every((category) =>
      hasStringFields(category, ["id", "name"]),
    ) ||
    !Array.isArray(catalog.products) ||
    !catalog.products.every(
      (product) =>
        hasStringFields(product, ["id", "categoryId", "name"]) &&
        (typeof product.sellingPrice === "string" ||
          typeof product.sellingPrice === "number") &&
        Array.isArray(product.variants) &&
        Array.isArray(product.modifiers),
    ) ||
    !Array.isArray(catalog.paymentMethods) ||
    !catalog.paymentMethods.every((method) =>
      hasStringFields(method, ["code", "name"]),
    ) ||
    !Array.isArray(catalog.tables) ||
    !catalog.tables.every((table) =>
      hasStringFields(table, ["id", "code", "name", "status"]),
    )
  ) {
    return null;
  }

  return {
    branchId: snapshot.branchId,
    generatedAt: snapshot.generatedAt,
    catalog,
  };
}
