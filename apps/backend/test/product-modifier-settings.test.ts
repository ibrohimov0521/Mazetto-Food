import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueProductModifiers,
  productModifierSettings,
} from "../src/modules/menu/menu.service";

/*
 * `updateProduct` modifikator bog'lamlarini `deleteMany` + `createMany`
 * bilan qaytadan yaratadi. Ilgari faqat `modifierId` va indeks
 * yozilardi, ya'ni mahsulot HAR SAQLANGANDA guruh sozlamalari
 * standart qiymatga tushib ketardi — admin buni sezmasdi ham, chunki
 * hech qanday xato chiqmasdi.
 *
 * Shu sababli bu sof funksiya test bilan qulflanadi.
 */

test("ko'rsatilmagan sozlama eski qiymatdan tiklanadi", () => {
  const result = productModifierSettings(
    { modifierId: "m1" } as never,
    { isRequired: true, minSelect: 1, maxSelect: 3 },
  );
  assert.deepEqual(result, {
    isRequired: true,
    minSelect: 1,
    maxSelect: 3,
  });
});

test("so'rovdagi qiymat eski qiymatdan USTUN", () => {
  const result = productModifierSettings(
    { isRequired: false, minSelect: 2, maxSelect: 5 } as never,
    { isRequired: true, minSelect: 1, maxSelect: 3 },
  );
  assert.deepEqual(result, {
    isRequired: false,
    minSelect: 2,
    maxSelect: 5,
  });
});

test("cheksiz tanlov cheksiz qoladi", () => {
  /*
   * `maxSelect` sxemada `Int?` va `null` "yuqori chegara yo'q" degani.
   * Uni 1 ga aylantirish cheksiz guruhni jimgina bitta tanlovga
   * qisib qo'yardi.
   */
  const result = productModifierSettings(
    { modifierId: "m1" } as never,
    { isRequired: false, minSelect: 0, maxSelect: null },
  );
  assert.equal(result.maxSelect, null);
});

test("yangi bog'lamda sxemadagi standart qiymatlar ishlatiladi", () => {
  const result = productModifierSettings({ modifierId: "m1" } as never);
  assert.deepEqual(result, {
    isRequired: false,
    minSelect: 0,
    maxSelect: null,
  });
});

test("majburiy yangi bog'lam kamida bitta tanlov talab qiladi", () => {
  const result = productModifierSettings({
    modifierId: "m1",
    isRequired: true,
  } as never);
  assert.equal(result.minSelect, 1);
});

test("eng kam tanlov eng ko'pdan oshmaydi", () => {
  assert.throws(
    () =>
      productModifierSettings({
        modifierId: "m1",
        minSelect: 3,
        maxSelect: 2,
      } as never),
    /eng kam tanlovdan kichik/,
  );
});

test("bir modifier ikki marta biriktirilmaydi", () => {
  assert.throws(
    () =>
      assertUniqueProductModifiers([
        { modifierId: "m1" },
        { modifierId: "m1" },
      ]),
    /ikki marta/,
  );
});
