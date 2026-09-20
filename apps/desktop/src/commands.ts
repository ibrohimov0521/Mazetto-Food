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
  { commandType: "courier-shift.open", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/courier-shift\/open$/ },
  { commandType: "cash.transfer.create", aggregateType: "cash-register", methods: ["POST"], pattern: /^\/api\/v1\/cash-register\/transfers(?:\/[^/]+)?$/ },
  { commandType: "order.status.update", aggregateType: "orders", methods: ["POST", "PATCH"], pattern: /^\/api\/v1\/orders\/[^/]+\/status$/ },
  { commandType: "order.action", aggregateType: "orders", methods: ["POST"], pattern: /^\/api\/v1\/orders\/[^/]+\/actions\/[^/]+$/ },
  { commandType: "order.items.update", aggregateType: "orders", methods: ["POST", "PATCH", "DELETE"], pattern: /^\/api\/v1\/orders\/[^/]+\/items(?:\/[^/]+)?$/ },
  { commandType: "table.order.create", aggregateType: "tables", methods: ["POST"], pattern: /^\/api\/v1\/tables\/[^/]+\/orders$/ },
  { commandType: "kitchen.action", aggregateType: "kitchen", methods: ["POST"], pattern: /^\/api\/v1\/kitchen\/orders\/[^/]+\/[^/]+$/ },
  { commandType: "courier.status.update", aggregateType: "courier", methods: ["POST", "PATCH"], pattern: /^\/api\/v1\/courier\/orders\/[^/]+\/status$/ },
];

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