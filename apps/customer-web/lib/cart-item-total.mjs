/** @param {{ unitPrice: string | number; quantity: number; modifiers: { price: string | number; quantity?: number }[] }} item */
export function cartItemTotal(item) {
  const modifierTotal = item.modifiers.reduce(
    (sum, modifier) => sum + Number(modifier.price) * (modifier.quantity ?? 1),
    0,
  );
  return (Number(item.unitPrice) + modifierTotal) * item.quantity;
}
