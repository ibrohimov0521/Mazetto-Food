const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasStringFields = (value, fields) =>
  isRecord(value) && fields.every((field) => typeof value[field] === "string");

const isOrder = (value) =>
  hasStringFields(value, [
    "id",
    "orderNumber",
    "status",
    "total",
    "createdAt",
  ]) &&
  Number.isInteger(value.version) &&
  Array.isArray(value.items);

/**
 * @param {unknown} snapshot
 * @param {string | null} expectedBranchId
 * @param {boolean} includeMenu
 */
export function readOfflineWaiterSnapshot(
  snapshot,
  expectedBranchId,
  includeMenu = true,
) {
  if (
    !isRecord(snapshot) ||
    snapshot.schemaVersion !== 2 ||
    typeof snapshot.branchId !== "string" ||
    !expectedBranchId ||
    snapshot.branchId !== expectedBranchId ||
    typeof snapshot.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.generatedAt)) ||
    !Array.isArray(snapshot.tables) ||
    !snapshot.tables.every(
      (table) =>
        hasStringFields(table, ["id", "branchId", "name", "status"]) &&
        table.branchId === expectedBranchId &&
        Array.isArray(table.orders) &&
        table.orders.every(isOrder),
    )
  ) {
    return null;
  }

  const menu = snapshot.menu;
  if (
    includeMenu &&
    (!isRecord(menu) ||
      !Array.isArray(menu.categories) ||
      !menu.categories.every((category) =>
        hasStringFields(category, ["id", "name"]),
      ) ||
      !Array.isArray(menu.products) ||
      !menu.products.every(
        (product) =>
          hasStringFields(product, ["id", "name"]) &&
          (typeof product.categoryId === "string" ||
            product.categoryId === null) &&
          (typeof product.sellingPrice === "string" ||
            typeof product.sellingPrice === "number") &&
          Array.isArray(product.variants) &&
          Array.isArray(product.modifiers),
      ))
  ) {
    return null;
  }

  return {
    branchId: snapshot.branchId,
    generatedAt: snapshot.generatedAt,
    tables: snapshot.tables,
    categories: includeMenu ? menu.categories : [],
    products: includeMenu ? menu.products : [],
  };
}
