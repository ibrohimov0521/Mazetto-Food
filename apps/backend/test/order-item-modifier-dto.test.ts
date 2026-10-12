import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { validate } from "class-validator";
import { Prisma } from "@prisma/client";
import { OnlineOrderModifierDto } from "../src/modules/customers/dto/customer.dto";
import { createModifierSnapshot } from "../src/modules/orders/order-guards";
import { OrderItemModifierDto } from "../src/modules/orders/dto/order-item.dto";

test("modifier quantities must be whole positive units", async () => {
  const wholeQuantity = Object.assign(new OrderItemModifierDto(), {
    modifierId: "cheese",
    quantity: 2,
  });
  const fractionalQuantity = Object.assign(new OrderItemModifierDto(), {
    modifierId: "cheese",
    quantity: 1.5,
  });
  const defaultQuantity = Object.assign(new OrderItemModifierDto(), {
    modifierId: "cheese",
  });

  assert.deepEqual(await validate(wholeQuantity), []);
  assert.deepEqual(await validate(defaultQuantity), []);
  assert.ok(
    (await validate(fractionalQuantity)).some(
      ({ property }) => property === "quantity",
    ),
  );
});

test("customer web modifier quantities must be whole positive units", async () => {
  const whole = Object.assign(new OnlineOrderModifierDto(), {
    modifierId: "cheese",
    quantity: 2,
  });
  const fractional = Object.assign(new OnlineOrderModifierDto(), {
    modifierId: "cheese",
    quantity: 1.5,
  });

  assert.deepEqual(await validate(whole), []);
  assert.ok(
    (await validate(fractional)).some(
      ({ property }) => property === "quantity",
    ),
  );
});

test("server modifier snapshots reject fractional units", async () => {
  const tx = {
    productModifier: {
      findMany: async () => [
        {
          modifierId: "m1",
          isRequired: false,
          minSelect: 0,
          maxSelect: 3,
          modifier: {
            id: "m1",
            code: "SAUCE",
            name: "Sous",
            price: new Prisma.Decimal(1000),
          },
        },
      ],
    },
  } as never;
  await assert.rejects(
    () =>
      createModifierSnapshot(tx, "p1", [{ modifierId: "m1", quantity: 1.5 }]),
    /whole number/,
  );
});
