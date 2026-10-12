export type TelegramModifierSelection = {
  modifierId: string;
  quantity: number;
};

export type TelegramModifierRule = {
  modifierId: string;
  isRequired?: boolean | null;
  minSelect?: number | null;
  maxSelect?: number | null;
};

function minimumFor(rule: TelegramModifierRule): number {
  return Math.max(
    0,
    Math.trunc(Number(rule.minSelect) || 0),
    rule.isRequired ? 1 : 0,
  );
}

function maximumFor(rule: TelegramModifierRule, minimum: number): number {
  const configured = Number(rule.maxSelect);
  const maximum =
    rule.maxSelect == null || !Number.isFinite(configured)
      ? 99
      : Math.max(0, Math.trunc(configured));
  return Math.max(minimum, Math.min(99, maximum));
}

export function normalizeTelegramModifierSelections(
  rules: TelegramModifierRule[],
  selections: TelegramModifierSelection[],
): TelegramModifierSelection[] {
  const requested = new Map<string, number>();
  for (const selection of selections) {
    if (!selection.modifierId) continue;
    const quantity = Math.max(0, Math.trunc(Number(selection.quantity) || 0));
    requested.set(
      selection.modifierId,
      (requested.get(selection.modifierId) ?? 0) + quantity,
    );
  }

  return rules.flatMap((rule) => {
    const minimum = minimumFor(rule);
    const maximum = maximumFor(rule, minimum);
    const quantity = Math.max(
      minimum,
      Math.min(maximum, requested.get(rule.modifierId) ?? 0),
    );
    return quantity > 0 ? [{ modifierId: rule.modifierId, quantity }] : [];
  });
}

export function adjustTelegramModifierSelection(
  rules: TelegramModifierRule[],
  selections: TelegramModifierSelection[],
  modifierId: string,
  delta: number,
): TelegramModifierSelection[] {
  if (delta !== -1 && delta !== 1) return selections;

  const rule = rules.find((item) => item.modifierId === modifierId);
  if (!rule) return normalizeTelegramModifierSelections(rules, selections);

  const current = normalizeTelegramModifierSelections(rules, selections);
  const quantity =
    current.find((item) => item.modifierId === modifierId)?.quantity ?? 0;
  const minimum = minimumFor(rule);
  const maximum = maximumFor(rule, minimum);
  const nextQuantity = Math.max(minimum, Math.min(maximum, quantity + delta));
  const next = current.filter((item) => item.modifierId !== modifierId);
  if (nextQuantity > 0) next.push({ modifierId, quantity: nextQuantity });
  return normalizeTelegramModifierSelections(rules, next);
}
