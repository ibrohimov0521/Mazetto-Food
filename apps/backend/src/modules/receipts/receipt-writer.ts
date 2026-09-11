import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/*
 * CHEK YOZUVCHISI.
 *
 * NIMA UCHUN AJRATILDI. Chek yozish mantiqi `PaymentsService` ichida
 * `private` bo'lib turgan edi, shuning uchun KASSA checkout'i (u boshqa
 * servisda, o'z tranzaksiyasida to'lovni o'zi yozadi) undan foydalana
 * olmasdi — natijada POS naqd sotuvi uchun chek yozuvi UMUMAN
 * yaratilmasdi va admin panelidagi cheklar ro'yxatida kassa sotuvlari
 * ko'rinmasdi.
 *
 * Bu yerda faqat `tx` bilan ishlaydigan funksiyalar: DI ham, `this` ham
 * yo'q, shuning uchun modul bog'lamlarini o'zgartirmasdan ikki servisdan
 * ham chaqirish mumkin va aylanma bog'liqlik paydo bo'lmaydi.
 */

type TransactionClient = Prisma.TransactionClient;

export type OrderForReceipt = Prisma.OrderGetPayload<{
  include: {
    branch: true;
    items: true;
    payments: { include: { method: true } };
    receipts: true;
  };
}>;

const RECEIPT_NUMBER_ATTEMPTS = 5;

/*
 * Chek raqami tasodifiy sondan yasaladi va uning fazosi KUNIGA atigi
 * 900 000 (soniyada emas). Tug'ilgan kun paradoksi bo'yicha kuniga 500 ta
 * chekda to'qnashuv ehtimoli ~13%, 1000 tada ~43%.
 */
export function createReceiptNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `RCPT-${date}-${Math.floor(Math.random() * 900000 + 100000)}`;
}

/**
 * Band bo'lmagan chek raqamini qaytaradi.
 *
 * Nomzod avval `findUnique` bilan tekshiriladi, keyin yoziladi. Bu poygani
 * BUTUNLAY yopmaydi — ikki tranzaksiya bir xil nomzodni bir vaqtda tekshirib
 * o'tishi mumkin — lekin to'qnashuv ehtimolini urinishlar soniga qarab
 * eksponensial kamaytiradi. Uni butunlay yopish uchun kunlik ketma-ket
 * hisoblagich va `pg_advisory_xact_lock` kerak (buyurtmaning ko'rinadigan
 * raqamida shunday qilingan); u chek formatini o'zgartiradi, ya'ni alohida
 * qaror.
 *
 * To'qnashuv shunchaki chekni emas, BUTUN to'lov tranzaksiyasini bekor
 * qilardi, shuning uchun chegaralangan qayta urinish saqlanadi.
 */
export async function allocateReceiptNumber(
  tx: TransactionClient,
): Promise<string> {
  for (let attempt = 0; attempt < RECEIPT_NUMBER_ATTEMPTS; attempt += 1) {
    const candidate = createReceiptNumber();
    const existing = await tx.receipt.findUnique({
      where: { receiptNumber: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new BadRequestException("Unable to allocate a receipt number");
}

export async function writeReceiptRow(
  tx: TransactionClient,
  order: OrderForReceipt,
): Promise<void> {
  const receiptNumber = await allocateReceiptNumber(tx);

  await tx.receipt.create({
    data: {
      orderId: order.id,
      branchId: order.branchId,
      receiptNumber,
      total: order.total,
      content: {
        title: "MAZETTO FOOD",
        branchName: order.branch.name,
        orderNumber: order.orderNumber,
        items: order.items.map((item) => ({
          name: item.productName,
          variant: item.variantName,
          quantity: item.quantity.toFixed(3),
          total: item.totalPrice.toFixed(2),
        })),
        payments: order.payments.map((payment) => ({
          method: payment.method.code,
          amount: payment.amount.toFixed(2),
        })),
        total: order.total.toFixed(2),
        dateTime: new Date().toISOString(),
      },
    },
  });
}

/*
 * Buyurtmaga chek bo'lishini kafolatlaydi.
 *
 * IDEMPOTENT: cheki bor buyurtmaga ikkinchi chek yozilmaydi. To'lov
 * bo'laklab kelganda (avval karta, keyin naqd) bu funksiya bir necha
 * marta chaqirilishi mumkin, lekin chek bittaligi qoladi.
 */
export async function ensureOrderReceipt(
  tx: TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      branch: true,
      items: true,
      payments: { include: { method: true } },
      receipts: true,
    },
  });

  if (!order || order.receipts.length > 0) {
    return;
  }

  await writeReceiptRow(tx, order);
}
