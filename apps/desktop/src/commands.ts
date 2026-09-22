export type OfflineCommandDefinition = {
  commandType: string;
  aggregateType: string;
  methods: readonly string[];
  pattern: RegExp;
};

const registry: OfflineCommandDefinition[] = [
  { commandType: "pos.order.create", aggregateType: "pos", methods: ["POST"], pattern: /^\/api\/v1\/pos\/orders$/ },
  { commandType: "payment.process", aggregateType: "payments", methods: ["POST"], pattern: /^\/api\/v1\/payments\/process$/ },
  { commandType: "shift.open", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/shift\/open$/ },
  { commandType: "shift.close", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/shift\/[^/]+\/close$/ },
  { commandType: "cash.transaction.create", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/shift\/[^/]+\/transactions$/ },
  { commandType: "courier-shift.open", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/courier-shift\/open$/ },
  { commandType: "cash.transfer.create", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/(?:courier-shift\/)?transfers$/ },
  { commandType: "cash.transfer.action", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/transfers\/[^/]+\/(?:accept|reject)$/ },
  { commandType: "order.status.update", aggregateType: "orders", methods: ["POST", "PATCH"], pattern: /^\/api\/v1\/orders\/[^/]+\/status$/ },
  { commandType: "order.action", aggregateType: "orders", methods: ["POST"], pattern: /^\/api\/v1\/orders\/[^/]+\/actions\/[^/]+$/ },
  { commandType: "order.items.update", aggregateType: "orders", methods: ["POST", "PATCH", "DELETE"], pattern: /^\/api\/v1\/orders\/[^/]+\/items(?:\/[^/]+)?$/ },
  { commandType: "order.item.cancel", aggregateType: "orders", methods: ["POST"], pattern: /^\/api\/v1\/orders\/[^/]+\/items\/[^/]+\/actions\/cancel$/ },
  { commandType: "table.order.create", aggregateType: "tables", methods: ["POST"], pattern: /^\/api\/v1\/tables\/[^/]+\/orders$/ },
  { commandType: "kitchen.action", aggregateType: "kitchen", methods: ["PATCH"], pattern: /^\/api\/v1\/kitchen\/orders\/[^/]+\/(?:accept|start|ready|complete|cancel)$/ },
  { commandType: "courier.status.update", aggregateType: "courier", methods: ["POST", "PATCH"], pattern: /^\/api\/v1\/courier\/orders\/[^/]+\/status$/ },
  { commandType: "shift.open", aggregateType: "shifts", methods: ["POST"], pattern: /^\/api\/v1\/shifts\/open$/ },
  { commandType: "shift.close", aggregateType: "shifts", methods: ["POST"], pattern: /^\/api\/v1\/shifts\/[^/]+\/close$/ },
  { commandType: "cash.transaction.create", aggregateType: "shifts", methods: ["POST"], pattern: /^\/api\/v1\/shifts\/[^/]+\/cash-transactions$/ },
  { commandType: "receipt.mark-printed", aggregateType: "receipts", methods: ["PATCH"], pattern: /^\/api\/v1\/receipts\/[^/]+\/print$/ },
];

const onlineOnlyMutationPatterns = [
  /^\/api\/v1\/(?:auth|customer|telegram|uploads)(?:\/|$)/,
  /^\/api\/v1\/(?:branches|customers|devices|expenses|homepage|inventory|menu|notifications|printers|recipes|roles|settings|staff|suppliers)(?:\/|$)/,
  /^\/api\/v1\/(?:tables|halls)(?:\/|$)/,
  /^\/api\/v1\/payments$/,
  /^\/api\/v1\/payments\/[^/]+\/refund$/,
  /^\/api\/v1\/orders$/,
  /^\/api\/v1\/orders\/bulk$/,
  /^\/api\/v1\/orders\/bulk\/status$/,
  /^\/api\/v1\/courier\/orders\/[^/]+\/assign$/,
  /^\/api\/v1\/shifts\/[^/]+\/force-handover$/,
  /^\/api\/v1\/receipts\/(?:print-jobs(?:\/|$)|[^/]+\/reprint$)/,
  /^\/api\/v1\/receipts\/bulk$/,
] as const;

export type OfflineMutationPolicy = "queueable" | "online-only" | "unknown";

export function resolveOfflineCommand(
  method: string,
  pathname: string,
): OfflineCommandDefinition | null {
  const normalizedMethod = method.toUpperCase();
  return (
    registry.find(
      (definition) =>
        definition.methods.includes(normalizedMethod) && definition.pattern.test(pathname),
    ) ?? null
  );
}

export function resolveOfflineCommandType(
  commandType: string,
): OfflineCommandDefinition | null {
  return registry.find((definition) => definition.commandType === commandType) ?? null;
}

export function classifyOfflineMutation(
  method: string,
  pathname: string,
): OfflineMutationPolicy {
  if (resolveOfflineCommand(method, pathname)) return "queueable";
  return onlineOnlyMutationPatterns.some((pattern) => pattern.test(pathname))
    ? "online-only"
    : "unknown";
}
