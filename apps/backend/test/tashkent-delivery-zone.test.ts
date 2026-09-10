import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { normalizeDeliveryLocation } from "../src/modules/customers/delivery-location";
import {
  TASHKENT_BOUNDS,
  TASHKENT_CENTER,
  isWithinTashkent,
  tashkentViewbox,
} from "../src/modules/customers/tashkent-bounds";
import type { DeliveryLocationDto } from "../src/modules/customers/dto/delivery-location.dto";

function location(
  latitude: number,
  longitude: number,
): DeliveryLocationDto {
  return {
    latitude,
    longitude,
    address: "Amir Temur ko'chasi 1",
    house: "1",
    source: "map",
  } as DeliveryLocationDto;
}

test("Toshkent shahri ichidagi nuqta qabul qilinadi", () => {
  const result = normalizeDeliveryLocation(
    location(TASHKENT_CENTER.latitude, TASHKENT_CENTER.longitude),
  );
  assert.equal(result.latitude, TASHKENT_CENTER.latitude);
  assert.equal(result.longitude, TASHKENT_CENTER.longitude);
});

test("zonadan tashqaridagi nuqta rad etiladi", () => {
  /*
   * Har biri haqiqiy joy — eski 41.45/69.5 qutisi ularning bir qismini
   * o'tkazib yuborardi va kuryer bora olmaydigan buyurtma tushardi.
   */
  const outside: Array<[string, number, number]> = [
    ["Samarqand", 39.627, 66.975],
    ["Saryog'och (Qozog'iston)", 41.4499, 69.1667],
    ["Chirchiq (Toshkent viloyati)", 41.4689, 69.5822],
    ["Nukus", 42.4531, 59.6103],
    ["Null orol (0,0)", 0, 0],
  ];
  for (const [name, latitude, longitude] of outside) {
    assert.throws(
      () => normalizeDeliveryLocation(location(latitude, longitude)),
      (error: unknown) =>
        error instanceof BadRequestException &&
        /faqat Toshkent shahri/.test(String(error.message)),
      `${name} rad etilishi kerak edi`,
    );
  }
});

test("quti chegaralari o'zi ichkarida hisoblanadi", () => {
  const { latMin, latMax, lngMin, lngMax } = TASHKENT_BOUNDS;
  assert.equal(isWithinTashkent(latMin, lngMin), true);
  assert.equal(isWithinTashkent(latMax, lngMax), true);
  // Chegaradan tashqarisi — eng kichik qadam bilan.
  assert.equal(isWithinTashkent(latMin - 0.0001, lngMin), false);
  assert.equal(isWithinTashkent(latMax + 0.0001, lngMax), false);
  assert.equal(isWithinTashkent(latMin, lngMin - 0.0001), false);
  assert.equal(isWithinTashkent(latMax, lngMax + 0.0001), false);
});

test("NaN va Infinity zonadan tashqarida hisoblanadi", () => {
  /*
   * `NaN >= x` har doim false, ya'ni taqqoslash o'zi ham to'sadi. Test shu
   * xususiyat tasodifan yo'qolmasligi uchun — masalan taqqoslash inkorga
   * (`!(lat < min)`) aylantirilsa, NaN jimgina O'TIB ketardi.
   */
  assert.equal(isWithinTashkent(Number.NaN, TASHKENT_CENTER.longitude), false);
  assert.equal(isWithinTashkent(TASHKENT_CENTER.latitude, Number.NaN), false);
  assert.equal(
    isWithinTashkent(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    false,
  );
});

test("Nominatim viewbox formati lngMin,latMin,lngMax,latMax", () => {
  // Nominatim kenglik-uzunlikni shu tartibda kutadi; almashtirilsa
  // `bounded=1` bilan hech qanday natija qaytmaydi.
  assert.equal(tashkentViewbox(), "69.13,41.18,69.42,41.4");
});

test("zona tekshiruvi manzil tekshiruvidan KEYIN ishlaydi", () => {
  /*
   * To'liq bo'lmagan manzil zonadan tashqarida bo'lsa, foydalanuvchi avval
   * manzil haqidagi xabarni ko'rishi kerak — "faqat Toshkent" xabari uni
   * chalg'itardi, chunki asosiy muammo boshqa.
   */
  assert.throws(
    () => normalizeDeliveryLocation({ ...location(39.627, 66.975), house: "" } as DeliveryLocationDto),
    (error: unknown) =>
      error instanceof BadRequestException &&
      /Manzil va xaritadagi nuqtani tekshiring/.test(String(error.message)),
  );
});
