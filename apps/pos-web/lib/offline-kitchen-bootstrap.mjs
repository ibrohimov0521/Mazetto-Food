const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasStringFields = (value, fields) =>
  isRecord(value) && fields.every((field) => typeof value[field] === "string");

const nullableString = (value) => value === null || typeof value === "string";
const ticketStatuses = new Set(["NEW", "ACCEPTED", "COOKING", "READY"]);
const orderSources = new Set(["POS", "WEB", "TELEGRAM"]);
const orderTypes = new Set(["DINE_IN", "TAKEAWAY", "DELIVERY"]);
const stationRoutings = new Set(["KITCHEN", "BAR", "RECEIPT", "NONE"]);

const isKitchenItem = (value) =>
  hasStringFields(value, ["id", "productName", "quantity"]) &&
  nullableString(value.variantName) &&
  nullableString(value.notes) &&
  (value.stationRouting === undefined ||
    stationRoutings.has(value.stationRouting));

const isOrderItem = (value) =>
  hasStringFields(value, ["id", "productName", "quantity"]) &&
  nullableString(value.variantName) &&
  nullableString(value.notes);

const isKitchenTicket = (value, expectedBranchId) =>
  hasStringFields(value, ["id", "ticketNumber", "status", "createdAt"]) &&
  ticketStatuses.has(value.status) &&
  Number.isInteger(value.priority) &&
  Number.isInteger(value.version) &&
  Number.isInteger(value.revisionNumber) &&
  typeof value.isSupplement === "boolean" &&
  nullableString(value.acceptedAt) &&
  Array.isArray(value.items) &&
  value.items.every(isKitchenItem) &&
  isRecord(value.order) &&
  hasStringFields(value.order, [
    "id",
    "branchId",
    "orderNumber",
    "source",
    "type",
  ]) &&
  value.order.branchId === expectedBranchId &&
  orderSources.has(value.order.source) &&
  orderTypes.has(value.order.type) &&
  typeof value.order.isSupplemental === "boolean" &&
  (value.order.supplementNumber === null ||
    Number.isInteger(value.order.supplementNumber)) &&
  nullableString(value.order.displayOrderNumber) &&
  nullableString(value.order.notes) &&
  nullableString(value.order.kitchenComment) &&
  Array.isArray(value.order.items) &&
  value.order.items.every(isOrderItem) &&
  isRecord(value.order.branch) &&
  typeof value.order.branch.name === "string" &&
  (value.order.table === null ||
    (isRecord(value.order.table) &&
      Number.isInteger(value.order.table.number) &&
      nullableString(value.order.table.name)));

export function readOfflineKitchenSnapshot(snapshot, expectedBranchId) {
  if (
    !isRecord(snapshot) ||
    snapshot.schemaVersion !== 2 ||
    typeof snapshot.branchId !== "string" ||
    !expectedBranchId ||
    snapshot.branchId !== expectedBranchId ||
    typeof snapshot.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.generatedAt)) ||
    !isRecord(snapshot.kitchenQueue)
  ) {
    return null;
  }

  const { items, hasMore, limit } = snapshot.kitchenQueue;
  if (
    !Array.isArray(items) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 250 ||
    items.length > limit ||
    typeof hasMore !== "boolean" ||
    !items.every((ticket) => isKitchenTicket(ticket, expectedBranchId))
  ) {
    return null;
  }

  return { items, hasMore, limit };
}
