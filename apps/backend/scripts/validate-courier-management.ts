/*
 * Kuryer nazorati (5.5) va masofa (5.3).
 *
 * Bu yerdagi shartlarning aksariyati XAVFSIZLIK chegarasi: kim kimning
 * buyurtmasini o'zgartira oladi. Buzilsa hech narsa qulamaydi — faqat
 * kuryer boshqasining buyurtmasini tortib olishi mumkin bo'lib qoladi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const permissions = read("apps/backend/src/common/auth/permissions.ts");
const seed = read("apps/backend/prisma/seed.ts");
const service = read("apps/backend/src/modules/customers/customers.service.ts");
const controller = read(
  "apps/backend/src/modules/customers/customers.controller.ts",
);
const nav = read("apps/pos-web/lib/admin-nav.ts");
const routeAccess = read("apps/pos-web/lib/route-access.ts");
const adminUi = read("apps/pos-web/components/admin/admin-couriers.tsx");

// --- Permission ---
assert.match(
  permissions,
  /COURIER_MANAGE: "COURIER_MANAGE"/,
  "COURIER_MANAGE permissioni yo'q.",
);

/*
 * KURYERGA BERILMASLIGI SHART. Kuryer o'z buyurtmasini oladi, lekin
 * boshqasinikini o'ziga tortib ololmasligi kerak — aks holda "kim olib
 * ketyapti" degan javob ishonchsiz bo'lardi.
 */
const courierRoleBlock =
  seed.match(/code: "COURIER",[\s\S]*?\n {2}\},/)?.[0] ?? "";
assert.ok(courierRoleBlock, "seed.ts da COURIER roli topilmadi.");
assert.doesNotMatch(
  courierRoleBlock,
  /COURIER_MANAGE/,
  "COURIER roliga COURIER_MANAGE berilgan — kuryer boshqasining buyurtmasini tortib olardi.",
);

// Menejerlarda esa BO'LISHI kerak, aks holda ekran hech kimga ochilmaydi.
for (const role of ["BRANCH_MANAGER", "ADMIN"]) {
  const block = seed.match(
    new RegExp(`code: "${role}",[\\s\\S]*?\\n {2}\\},`),
  )?.[0];
  assert.ok(block, `seed.ts da ${role} roli topilmadi.`);
  assert.match(
    block,
    /COURIER_MANAGE/,
    `${role} roliga COURIER_MANAGE berilmagan — nazorat ekrani ochilmaydi.`,
  );
}

// --- Endpointlar himoyalangan ---
for (const [route, why] of [
  ["couriers", "kuryerlar ro'yxati"],
  ["couriers/deliveries", "faol yetkazishlar"],
  ["courier/orders/:id/assign", "biriktirish"],
] as const) {
  const escaped = route.replace(/[/:]/g, (char) => "\\" + char);
  assert.match(
    controller,
    new RegExp(`"${escaped}"\\)[\\s\\S]{0,120}PERMISSIONS\\.COURIER_MANAGE`),
    `"${route}" (${why}) COURIER_MANAGE bilan himoyalanmagan.`,
  );
}

// --- Biriktirishda qulf ---
const assignBody =
  service.match(/async assignCourier\([\s\S]*?\n {2}\}/)?.[0] ?? "";
assert.ok(assignBody, "assignCourier topilmadi.");
/*
 * Kuryerning o'zi shu lahzada buyurtmani olayotgan bo'lishi mumkin
 * (`updateCourierOrderStatus` ham shu qulfni oladi). Qulfsiz ikkalasi ham
 * muvaffaqiyatli tugab, oxirgi yozuv yutardi.
 */
assert.match(
  assignBody,
  /FOR UPDATE OF o/,
  "assignCourier qator qulfini olmayapti — kuryer bilan poyga holati chiqadi.",
);
/*
 * Biriktirilayotgan xodim HAQIQATAN kuryer va SHU filialda bo'lishi kerak.
 * Aks holda buyurtma oshpazga biriktirilib, kuryer ro'yxatidan butunlay
 * yo'qolib ketardi.
 */
assert.match(
  assignBody,
  /roles: \{ some: \{ role: \{ code: "COURIER" \} \} \}/,
  "assignCourier xodim kuryer ekanini tekshirmayapti.",
);
assert.match(
  assignBody,
  /branchId: existing\.branchId/,
  "assignCourier xodim shu filialda ekanini tekshirmayapti.",
);
assert.match(
  assignBody,
  /OrderStatus\.COMPLETED[\s\S]{0,80}OrderStatus\.CANCELLED/,
  "Yakunlangan buyurtma qayta biriktirilishi mumkin.",
);

// --- Faol yetkazishlar SERVERDA filtrlanadi ---
const deliveriesBody =
  service.match(/async listActiveDeliveries\([\s\S]*?\n {2}\/\*\*/)?.[0] ?? "";
assert.ok(deliveriesBody, "listActiveDeliveries topilmadi.");
assert.match(
  deliveriesBody,
  /type: "DELIVERY"/,
  "Faol yetkazishlar turi bo'yicha filtrlanmayapti.",
);
assert.match(
  deliveriesBody,
  /status: \{ notIn: \[OrderStatus\.COMPLETED, OrderStatus\.CANCELLED\] \}/,
  "Yakunlangan buyurtmalar nazorat ekranidan chiqarilmayapti.",
);
assert.match(
  deliveriesBody,
  /servedById: true/,
  "Javobda servedById yo'q — biriktirish ustuni doim bo'sh ko'rinardi.",
);

// --- Masofa (5.3) ---
const distance = read(
  "apps/backend/src/modules/customers/delivery-distance.ts",
);
assert.match(
  distance,
  /Math\.atan2/,
  "Haversine `atan2` ishlatishi kerak: `asin` juda uzoq nuqtalarda NaN berardi.",
);
assert.match(
  distance,
  /EARTH_RADIUS_KM = 6371/,
  "Yer radiusi kilometrda bo'lishi kerak.",
);
assert.match(
  service,
  /withDeliveryDistance\(withDerivedCustomerOrderStatus\(customerOrder\)\)/,
  "Kuryer ro'yxatlariga masofa qo'shilmayapti.",
);
/*
 * Masofa `deliveryLocation` JSON ustunidan hisoblanadi, ya'ni SQL uni
 * bilmaydi. Unga qarab SARALASH faqat joriy sahifa ichida bo'lardi —
 * "eng yaqin buyurtma" ro'yxat boshida turgandek ko'rinib, aslida keyingi
 * sahifada qolib ketardi.
 */
assert.doesNotMatch(
  service,
  /sort\(\(a, b\) => \(a\.distanceKm/,
  "Masofa bo'yicha saralash qo'shilgan — u faqat joriy sahifa ichida ishlaydi va yolg'on tartib beradi.",
);

// --- Admin panelga ulangan ---
assert.match(
  nav,
  /href: "\/admin\/couriers"/,
  "Kuryerlar sahifasi menyuda yo'q.",
);
assert.match(
  nav,
  /permission: "COURIER_MANAGE"/,
  "Menyu yozuvi permissionsiz — hammaga ko'rinardi.",
);
assert.match(
  routeAccess,
  /pattern: "\/admin\/couriers"[\s\S]{0,80}permission: "COURIER_MANAGE"/,
  "route-access da /admin/couriers qoidasi yo'q.",
);
assert.match(
  adminUi,
  /apiFetch<DeliveryOrder\[\]>\("\/couriers\/deliveries"\)/,
  "Admin ekrani alohida endpointdan o'qimayapti.",
);

console.log("Kuryer nazorati validatsiyasi o'tdi");
