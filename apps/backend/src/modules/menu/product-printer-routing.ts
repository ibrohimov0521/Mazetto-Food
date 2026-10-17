function isKitchenPrinterRouting(
  routing: string | null | undefined,
): boolean {
  // BAR is a legacy route and currently shares the kitchen ticket/receipt path.
  return (
    routing === null ||
    routing === undefined ||
    routing === "KITCHEN" ||
    routing === "BAR"
  );
}

export function kitchenRoutedItems<
  T extends { product?: { printerRouting?: string | null } | null },
>(items: T[]): T[] {
  return items.filter((item) =>
    isKitchenPrinterRouting(item.product?.printerRouting),
  );
}
