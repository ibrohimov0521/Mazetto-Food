import assert from "node:assert/strict";
import test from "node:test";
import { OrderStatus } from "@prisma/client";
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  canCustomerCancel,
  customerCancelRejection,
} from "../src/modules/customers/customer-shared";

/*
 * Egasining qoidasi: oshxona tayyorlashni BOSHLAGANDAN keyin bekor
 * qilish faqat qo'ng'iroq orqali. Bu chegara mijoz tugmasini
 * boshqaradi, shuning uchun u test bilan qulflanadi — chegara
 * siljib ketsa, mijoz allaqachon pishirilayotgan ovqatni bekor
 * qilib yuborardi.
 */

test("bekor qilish faqat oshxona boshlashidan oldin", () => {
  assert.deepEqual(CUSTOMER_CANCELLABLE_STATUSES, [
    OrderStatus.NEW,
    OrderStatus.CONFIRMED,
  ]);
  assert.equal(canCustomerCancel(OrderStatus.NEW), true);
  assert.equal(canCustomerCancel(OrderStatus.CONFIRMED), true);
  for (const status of [
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ]) {
    assert.equal(
      canCustomerCancel(status),
      false,
      `${status} da mijoz bekor qila olmasligi kerak`,
    );
  }
});

test("tayyorlanayotgan buyurtma uchun xabar qo'ng'iroqqa yo'naltiradi", () => {
  const message = customerCancelRejection({
    status: OrderStatus.PREPARING,
    paymentStatus: "PENDING",
  });
  /*
   * Xabar shunchaki "mumkin emas" demasligi kerak — mijoz nima
   * qilishini bilishi kerak, aks holda u qo'llab-quvvatlashga
   * murojaat qilmasdan buyurtmani tashlab ketadi.
   */
  assert.ok(message);
  assert.match(message, /bog'laning/);
});

test("to'langan buyurtma bekor qilinmaydi", () => {
  /*
   * Pulni qaytarish alohida teskari yozuvni talab qiladi. Uni jimgina
   * o'tkazib yuborish pul hisobini buzardi.
   */
  const message = customerCancelRejection({
    status: OrderStatus.NEW,
    paymentStatus: "PAID",
  });
  assert.ok(message);
  assert.match(message, /to'langan/i);
});

test("bekor qilinadigan buyurtma uchun rad etish sababi yo'q", () => {
  assert.equal(
    customerCancelRejection({
      status: OrderStatus.NEW,
      paymentStatus: "PENDING",
    }),
    null,
  );
  assert.equal(
    customerCancelRejection({
      status: OrderStatus.CONFIRMED,
      paymentStatus: "PENDING",
    }),
    null,
  );
});

test("allaqachon bekor qilingan va yakunlangan buyurtma alohida xabar beradi", () => {
  const already = customerCancelRejection({
    status: OrderStatus.CANCELLED,
    paymentStatus: "PENDING",
  });
  assert.match(String(already), /allaqachon/);
  const done = customerCancelRejection({
    status: OrderStatus.COMPLETED,
    paymentStatus: "PENDING",
  });
  assert.match(String(done), /Yakunlangan/);
});
