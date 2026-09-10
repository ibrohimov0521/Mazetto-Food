import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  coordinateFromJson,
  deliveryDistanceKm,
  haversineKm,
} from "../src/modules/customers/delivery-distance";

const TASHKENT_CENTER = { latitude: 41.3111, longitude: 69.2797 };

test("bir xil nuqta orasidagi masofa nol", () => {
  assert.equal(haversineKm(TASHKENT_CENTER, TASHKENT_CENTER), 0);
});

test("ma'lum masofa to'g'ri hisoblanadi", () => {
  /*
   * Toshkent — Samarqand to'g'ri chiziq bo'yicha ~270 km. Bu test formula
   * BIRLIGINI qulflaydi: radian/gradus almashib qolsa yoki Yer radiusi
   * milyada bo'lsa, raqam keskin farq qiladi.
   */
  const samarkand = { latitude: 39.627, longitude: 66.975 };
  const km = haversineKm(TASHKENT_CENTER, samarkand);
  assert.ok(km !== null);
  assert.ok(km > 250 && km < 290, `kutilgan ~270 km, olindi ${km}`);
});

test("qisqa masofa shahar ichida mantiqiy", () => {
  // Kenglik bo'yicha 0.01 gradus ~1.11 km.
  const km = haversineKm(TASHKENT_CENTER, {
    latitude: TASHKENT_CENTER.latitude + 0.01,
    longitude: TASHKENT_CENTER.longitude,
  });
  assert.ok(km !== null);
  assert.ok(km > 1.0 && km < 1.2, `kutilgan ~1.11 km, olindi ${km}`);
});

test("masofa simmetrik", () => {
  const a = { latitude: 41.32, longitude: 69.24 };
  const b = { latitude: 41.29, longitude: 69.31 };
  assert.equal(haversineKm(a, b), haversineKm(b, a));
});

test("qarama-qarshi nuqtalarda NaN qaytmaydi", () => {
  /*
   * `asin` ishlatilsa, suzuvchi nuqta xatosi argumentni 1 dan kattaroq
   * qilib NaN berardi. `atan2` bunday holatda ham barqaror.
   */
  const km = haversineKm(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 180 },
  );
  assert.ok(km !== null);
  assert.ok(Number.isFinite(km));
  assert.ok(km > 20000, `Yer yarim aylanasi ~20015 km, olindi ${km}`);
});

test("yaroqsiz koordinata null beradi", () => {
  assert.equal(haversineKm({ latitude: Number.NaN, longitude: 0 }, TASHKENT_CENTER), null);
  assert.equal(haversineKm(TASHKENT_CENTER, { latitude: 0, longitude: Number.POSITIVE_INFINITY }), null);
});

test("JSON ustunidan koordinata o'qiladi va buzuq qiymat null beradi", () => {
  assert.deepEqual(
    coordinateFromJson({ latitude: 41.3, longitude: 69.2, address: "x" }),
    { latitude: 41.3, longitude: 69.2 },
  );
  // Xarita qo'shilishidan OLDINGI buyurtmalarda koordinata yo'q.
  assert.equal(coordinateFromJson({ address: "Chilonzor 5" }), null);
  assert.equal(coordinateFromJson(null), null);
  assert.equal(coordinateFromJson("salom"), null);
  assert.equal(coordinateFromJson({ latitude: "a", longitude: "b" }), null);
});

test("filial koordinatasi yo'q bo'lsa masofa null, xato emas", () => {
  /*
   * Filial koordinatasi ixtiyoriy (`Decimal?`). U kiritilmagan bo'lsa
   * kuryer ro'yxati masofasiz ishlashi kerak — qulamasligi.
   */
  assert.equal(
    deliveryDistanceKm(
      { latitude: null, longitude: null },
      { latitude: 41.3, longitude: 69.2 },
    ),
    null,
  );
});

test("masofa bitta kasrgacha yaxlitlanadi", () => {
  /*
   * `2.3 km` foydali; `2.2847284 km` esa aniqlik haqida yolg'on da'vo —
   * bu to'g'ri chiziq, yo'l masofasi emas.
   */
  const km = deliveryDistanceKm(
    {
      latitude: new Prisma.Decimal(TASHKENT_CENTER.latitude),
      longitude: new Prisma.Decimal(TASHKENT_CENTER.longitude),
    },
    { latitude: TASHKENT_CENTER.latitude + 0.02, longitude: TASHKENT_CENTER.longitude },
  );
  assert.ok(km !== null);
  assert.equal(km, Math.round(km * 10) / 10);
});
