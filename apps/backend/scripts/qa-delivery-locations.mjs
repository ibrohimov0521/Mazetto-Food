/* global console, process, fetch */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { randomInt, randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
process.loadEnvFile(new URL("../.env", import.meta.url));
assert.equal(
  new URL(process.env.DATABASE_URL).pathname,
  "/mazetto_dev",
  "Dev database only",
);
const { PrismaService } = require("../dist/prisma/prisma.service");
const {
  CustomerOrderEngineService,
} = require("../dist/modules/customers/customer-order-engine.service");
const {
  CustomersService,
} = require("../dist/modules/customers/customers.service");
const {
  CustomerAddressesService,
} = require("../dist/modules/customers/customer-addresses.service");
const { JwtService } = require("@nestjs/jwt");
const { getCustomerJwtAccessSecret } = require("../dist/config/auth.config");
const {
  customerVisibleProductCodes,
} = require("../dist/modules/customers/customer-catalog-visibility");
const db = new PrismaService();
const jwt = new JwtService();
const ids = [];
const checks = [];
const api = "http://127.0.0.1:4100/api/v1";
const location = {
  latitude: 41.3159,
  longitude: 69.2812,
  address: "Amir Temur ko'chasi",
  house: "12A",
  apartment: "24",
  entrance: "2",
  floor: "3",
  landmark: "Dorixona yonida",
  source: "map",
};
const envelope = async (path, token, method = "GET", body) => {
  const result = await fetch(api + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: result.status, body: await result.json() };
};
try {
  for (let i = 0; i < 2; i++) {
    const id = "qa-location-" + randomUUID();
    const phone = "+998" + randomInt(900000000, 999999999);
    await db.customer.create({
      data: { id, name: "QA delivery location", phone },
    });
    ids.push(id);
  }
  const tokens = await Promise.all(
    ids.map((id) =>
      jwt.signAsync(
        { id, phone: "+998900000000", tokenUse: "customer_access" },
        { secret: getCustomerJwtAccessSecret(), expiresIn: 120 },
      ),
    ),
  );
  assert.equal((await envelope("/customer/me/addresses")).status, 401);
  const path = "/customer/me/addresses/test-address";
  assert.equal(
    (
      await envelope(path, tokens[0], "PUT", {
        label: "Uy",
        location: { ...location, latitude: 91 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await envelope(path, tokens[0], "PUT", {
        label: "Uy",
        location: { ...location, longitude: "69" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await envelope(path, tokens[0], "PUT", { label: "Uy", location: null }))
      .status,
    400,
  );
  assert.equal(
    (
      await envelope(path, tokens[0], "PUT", {
        label: "Uy",
        location: { ...location, house: "   " },
      })
    ).status,
    400,
  );
  assert.equal(
    (await envelope(path, tokens[0], "PUT", { label: "Uy", location })).status,
    200,
  );
  let own = await envelope("/customer/me/addresses", tokens[0]);
  assert.equal(own.body.data.length, 1);
  assert.deepEqual(own.body.data[0].location, location);
  const other = await envelope("/customer/me/addresses", tokens[1]);
  assert.deepEqual(other.body.data, []);
  await envelope(path, tokens[1], "DELETE");
  own = await envelope("/customer/me/addresses", tokens[0]);
  assert.equal(
    own.body.data.length,
    1,
    "Another customer must not delete this address",
  );
  await envelope(path, tokens[0], "PUT", {
    label: "Ish",
    location: { ...location, house: "99" },
  });
  own = await envelope("/customer/me/addresses", tokens[0]);
  assert.equal(own.body.data.length, 1);
  assert.equal(own.body.data[0].label, "Ish");
  checks.push(
    "HTTP authentication, nested coordinate validation, persistence, update, cross-customer isolation",
  );

  const rollback = new Error("QA_ROLLBACK");
  try {
    await db.$transaction(
      async (tx) => {
        const prisma = new Proxy(tx, {
          get(target, key) {
            if (key === "$transaction") return async (callback) => callback(tx);
            return Reflect.get(target, key);
          },
        });
        const product = await tx.product.findFirstOrThrow({
          where: {
            isAvailable: true,
            code: { in: [...customerVisibleProductCodes] },
          },
          include: { variants: true },
        });
        const branch = product.branchId
          ? await tx.branch.findUniqueOrThrow({
              where: { id: product.branchId },
            })
          : await tx.branch.findFirstOrThrow();
        const branches = {
          assertCustomerBranchAcceptsOrder: async () => {},
          getUnavailableProductWhere: () => ({}),
        };
        const kitchen = {
          emitOrderCreated: () => {},
          emitOrderConfirmed: () => {},
          emitOrderSentToKitchen: () => {},
        };
        const orders = {
          confirmOrderForPreparation: async () => ({ kitchenTicket: null }),
        };
        const engine = new CustomerOrderEngineService(
          prisma,
          branches,
          kitchen,
          orders,
        );
        const dto = {
          branchId: branch.id,
          type: "DELIVERY",
          paymentMethod: "CASH",
          name: "QA recipient",
          phone: "+998911234567",
          address: "Legacy fallback",
          deliveryLocation: location,
          items: [{ productId: product.id, quantity: 1 }],
        };
        const result = await engine.createOnlineOrder(ids[0], dto);
        assert.deepEqual(result.order.deliveryLocation, location);
        assert.deepEqual(result.customerOrder.deliveryLocation, location);
        assert.equal(result.order.customerPhone, dto.phone);
        assert(result.order.deliveryAddress.includes(location.house));
        const admin = new CustomersService(
          prisma,
          branches,
          jwt,
          engine,
          {},
          {},
        );
        const listed = await admin.listOnlineOrders(
          { limit: 100, offset: 0 },
          { id: "qa-admin", roles: ["SUPER_ADMIN"], permissions: [] },
        );
        const visible = listed.find(
          (item) => item.id === result.customerOrder.id,
        );
        assert(visible, "New order must be in admin online-orders output");
        assert.deepEqual(visible.deliveryLocation, location);
        assert.deepEqual(visible.order.deliveryLocation, location);
        const addresses = new CustomerAddressesService(prisma);
        await addresses.save(ids[0], "test-address", {
          label: "Uy",
          location: { ...location, house: "Other house" },
        });
        const snapshot = await tx.order.findUniqueOrThrow({
          where: { id: result.order.id },
        });
        assert.deepEqual(
          snapshot.deliveryLocation,
          location,
          "Order snapshot must not follow saved-address edits",
        );
        assert.notEqual(
          engine.hashCheckoutRequest(dto),
          engine.hashCheckoutRequest({
            ...dto,
            deliveryLocation: { ...location, longitude: 69.5 },
          }),
        );
        const pickup = await engine.createOnlineOrder(ids[0], {
          ...dto,
          type: "PICKUP",
        });
        assert.equal(pickup.order.deliveryLocation, null);
        assert.equal(pickup.order.deliveryAddress, null);
        assert.equal(pickup.customerOrder.deliveryLocation, null);
        const legacy = { ...dto };
        delete legacy.deliveryLocation;
        const oldClient = await engine.createOnlineOrder(ids[0], legacy);
        assert.equal(oldClient.order.deliveryLocation, null);
        assert.equal(oldClient.order.deliveryAddress, "Legacy fallback");
        checks.push(
          "Real database transaction: coordinate snapshots in both order records and admin response, recipient phone, immutable history, location-aware hash, pickup, legacy client compatibility",
        );
        throw rollback;
      },
      { timeout: 25000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(
    await db.customerOrder.count({ where: { customerId: { in: ids } } }),
    0,
    "QA orders must roll back",
  );
  await envelope(path, tokens[0], "DELETE");
  assert.deepEqual(
    (await envelope("/customer/me/addresses", tokens[0])).body.data,
    [],
  );
  checks.push(
    "Saved address deletion verified; all QA orders rolled back without notifications",
  );
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  if (ids.length) await db.customer.deleteMany({ where: { id: { in: ids } } });
  await db.onModuleDestroy();
}
