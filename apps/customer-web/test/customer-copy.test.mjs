import test from "node:test";
import assert from "node:assert/strict";
import { localizeCustomerCopy } from "../lib/customer-copy.mjs";

test("localizes customer checkout and validation copy", () => {
  assert.equal(localizeCustomerCopy("Telefon raqamni to'g'ri kiriting.", "ru"), "Введите корректный номер телефона.");
  assert.equal(localizeCustomerCopy("Buyurtmani olganda kuryerga naqd to'lov", "ru"), "Оплата наличными курьеру при получении заказа");
});
test("localizes dynamic labels and preserves user-entered text", () => {
  assert.equal(localizeCustomerCopy("Uy manzilini tahrirlash", "ru"), "Изменить адрес «Uy»");
  assert.equal(localizeCustomerCopy("Qayta yuborish (12)", "ru"), "Отправить код повторно (12)");
  assert.equal(localizeCustomerCopy("My Home", "ru"), "My Home");
});
test("preserves Uzbek copy on Uzbek pages", () => {
  const copy = "Manzilni tekshiring.";
  assert.equal(localizeCustomerCopy(copy, "uz"), copy);
});
