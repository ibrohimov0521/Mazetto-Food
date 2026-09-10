import assert from "node:assert/strict";
import test from "node:test";
import { GeocodingService } from "../src/modules/geocoding/geocoding.service";
import type { RedisCacheService } from "../src/cache/redis-cache.service";

/** Xotiradagi soxta kesh — yozilganini ham kuzatadi. */
function fakeCache() {
  const store = new Map<string, { value: unknown; ttlMs: number }>();
  const service = {
    getJson: async <T>(key: string) =>
      (store.get(key)?.value as T | undefined) ?? null,
    setJson: async (key: string, value: unknown, ttlMs: number) => {
      store.set(key, { value, ttlMs });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  } as unknown as RedisCacheService;
  return { service, store };
}

/** `fetch` ni almashtiradi va so'ralgan URL'larni yozib boradi. */
function stubFetch(handler: (url: URL) => unknown | Promise<unknown>) {
  const calls: URL[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    const url = input instanceof URL ? input : new URL(String(input));
    calls.push(url);
    const body = await handler(url);
    if (body === undefined) {
      throw new Error("network down");
    }
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const TASHKENT = { lat: 41.3111, lng: 69.2797 };

test("geokoder tushganda buyurtma bloklanmaydi (fail-open) va natija keshlanmaydi", async () => {
  const { service: cache, store } = fakeCache();
  const fetchStub = stubFetch(() => undefined); // har doim xato
  try {
    const result = await new GeocodingService(cache).reverse(
      TASHKENT.lat,
      TASHKENT.lng,
      "uz",
    );
    assert.deepEqual(result, { label: "", inCity: true });
    /*
     * Bu eng muhim assert: uzilish keshlansa, bir daqiqalik nosozlik 30
     * KUNGA muzlab qolardi va hamma manzil yorliqsiz ko'rinardi.
     */
    assert.equal(store.size, 0, "fail-open natijasi keshlanmasligi kerak");
  } finally {
    fetchStub.restore();
  }
});

test("O'zbekistondan tashqaridagi nuqta inCity: false qaytaradi", async () => {
  const { service: cache } = fakeCache();
  const fetchStub = stubFetch(() => ({
    display_name: "Sary-Agash, Kazakhstan",
    address: { country_code: "kz", state: "Turkistan Region" },
  }));
  try {
    const result = await new GeocodingService(cache).reverse(41.44, 69.16, "en");
    assert.equal(result.inCity, false);
  } finally {
    fetchStub.restore();
  }
});

test("viloyat uchala tilda ham shahar emas deb hisoblanadi", async () => {
  /*
   * Nominatim `state` ni `accept-language` ga tarjima qiladi, shuning uchun
   * bitta tilga yozilgan regex qolgan ikkitasini jimgina o'tkazib yuborardi.
   */
  const states = ["Toshkent viloyati", "Ташкентская область", "Tashkent Region"];
  for (const state of states) {
    const { service: cache } = fakeCache();
    const fetchStub = stubFetch(() => ({
      display_name: "Chirchiq",
      address: { country_code: "uz", state },
    }));
    try {
      const result = await new GeocodingService(cache).reverse(41.3, 69.3, "uz");
      assert.equal(result.inCity, false, `"${state}" rad etilishi kerak edi`);
    } finally {
      fetchStub.restore();
    }
  }
});

test("Toshkent shahri inCity: true", async () => {
  const { service: cache, store } = fakeCache();
  const fetchStub = stubFetch(() => ({
    display_name: "Amir Temur ko'chasi, Toshkent",
    address: { country_code: "uz", state: "Toshkent" },
  }));
  try {
    const result = await new GeocodingService(cache).reverse(
      TASHKENT.lat,
      TASHKENT.lng,
      "uz",
    );
    assert.equal(result.inCity, true);
    assert.match(result.label, /Toshkent/);
    assert.equal(store.size, 1, "muvaffaqiyatli natija keshlanishi kerak");
  } finally {
    fetchStub.restore();
  }
});

test("kesh kaliti ~11 metrgacha yaxlitlaydi, ya'ni qo'shni nuqtalar bitta so'rov", async () => {
  const { service: cache } = fakeCache();
  const fetchStub = stubFetch(() => ({
    display_name: "Toshkent",
    address: { country_code: "uz", state: "Toshkent" },
  }));
  try {
    const service = new GeocodingService(cache);
    await service.reverse(41.31115, 69.27971, "uz");
    // 4 kasrdan keyin bir xil -> tashqi so'rov takrorlanmaydi.
    await service.reverse(41.31114, 69.27974, "uz");
    assert.equal(fetchStub.calls.length, 1);
  } finally {
    fetchStub.restore();
  }
});

test("til kesh kalitini ajratadi", async () => {
  const { service: cache } = fakeCache();
  const fetchStub = stubFetch(() => ({
    display_name: "Toshkent",
    address: { country_code: "uz", state: "Toshkent" },
  }));
  try {
    const service = new GeocodingService(cache);
    await service.reverse(TASHKENT.lat, TASHKENT.lng, "uz");
    await service.reverse(TASHKENT.lat, TASHKENT.lng, "ru");
    assert.equal(fetchStub.calls.length, 2, "boshqa til = boshqa kalit");
  } finally {
    fetchStub.restore();
  }
});

test("qidiruv Toshkent bilan chegaralanadi va zonadan tashqari natija tashlanadi", async () => {
  const { service: cache } = fakeCache();
  const fetchStub = stubFetch(() => [
    { display_name: "Navoiy ko'chasi, Toshkent", lat: "41.32", lon: "69.24" },
    // Nominatim `bounded=1` bo'lsa ham chekkadagi natijani qaytarishi mumkin.
    { display_name: "Navoiy ko'chasi, Samarqand", lat: "39.65", lon: "66.96" },
  ]);
  try {
    const results = await new GeocodingService(cache).search("Navoiy", "uz");
    assert.equal(results.length, 1);
    assert.match(results[0]?.label ?? "", /Toshkent/);

    const url = fetchStub.calls[0];
    assert.ok(url, "qidiruv so'rovi yuborilishi kerak edi");
    assert.equal(url.searchParams.get("countrycodes"), "uz");
    assert.equal(url.searchParams.get("bounded"), "1");
    assert.equal(url.searchParams.get("viewbox"), "69.13,41.18,69.42,41.4");
  } finally {
    fetchStub.restore();
  }
});

test("juda qisqa so'rov tashqi xizmatga bormaydi", async () => {
  const { service: cache } = fakeCache();
  const fetchStub = stubFetch(() => []);
  try {
    const results = await new GeocodingService(cache).search("na", "uz");
    assert.deepEqual(results, []);
    assert.equal(fetchStub.calls.length, 0);
  } finally {
    fetchStub.restore();
  }
});

test("qidiruv uzilishi bo'sh ro'yxat qaytaradi va keshlanmaydi", async () => {
  const { service: cache, store } = fakeCache();
  const fetchStub = stubFetch(() => undefined);
  try {
    const results = await new GeocodingService(cache).search("Navoiy", "uz");
    assert.deepEqual(results, []);
    assert.equal(store.size, 0);
  } finally {
    fetchStub.restore();
  }
});

test("Nominatim User-Agent siyosati bajariladi", async () => {
  /*
   * Nominatim aniqlanadigan `User-Agent` ni TALAB qiladi — usiz so'rovlar
   * bloklanadi va bu butun loyiha IP'siga ta'sir qiladi.
   */
  const { service: cache } = fakeCache();
  const original = globalThis.fetch;
  let headers: Record<string, string> = {};
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    headers = (init?.headers ?? {}) as Record<string, string>;
    return {
      ok: true,
      status: 200,
      json: async () => ({ address: { country_code: "uz" } }),
    } as Response;
  }) as typeof fetch;
  try {
    await new GeocodingService(cache).reverse(TASHKENT.lat, TASHKENT.lng, "uz");
    assert.match(headers["User-Agent"] ?? "", /MazettoFood/);
  } finally {
    globalThis.fetch = original;
  }
});
