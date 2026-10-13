import { CashTransactionType, Prisma } from "@prisma/client";

export function calculateCashBalance(
  openingBalance: Prisma.Decimal,
  transactions: { amount: Prisma.Decimal; type: CashTransactionType }[],
): Prisma.Decimal {
  const hasOpeningTransaction = transactions.some(
    ({ type }) =>
      type === CashTransactionType.OPENING ||
      type === CashTransactionType.OPENING_BALANCE,
  );
  const startingBalance = hasOpeningTransaction
    ? new Prisma.Decimal(0)
    : openingBalance;
  const outgoingTypes = new Set<CashTransactionType>([
    CashTransactionType.EXPENSE,
    CashTransactionType.REFUND,
    CashTransactionType.WITHDRAW,
    CashTransactionType.CASH_OUT,
  ]);

  return transactions.reduce(
    (balance, transaction) =>
      outgoingTypes.has(transaction.type)
        ? balance.sub(transaction.amount)
        : balance.add(transaction.amount),
    startingBalance,
  );
}
