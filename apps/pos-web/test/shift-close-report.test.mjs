import assert from "node:assert/strict";
import test from "node:test";
import { groupShiftOrders, readAllShiftOrders, shiftReportHtml, sumAmounts } from "../lib/shift-close-report.mjs";

test("shift close report includes every order in its proper status group", () => {
  const orders = [
    { id: "a", status: "SERVED", total: "12000" },
    { id: "b", status: "CANCELLED", total: "9000" },
    { id: "c", status: "PREPARING", total: "25000" },
    { id: "d", status: "COMPLETED", total: "14000" },
  ];

  const groups = groupShiftOrders(orders);
  assert.deepEqual(groups.map(({ key, orders: rows, total }) => ({
    key,
    ids: rows.map(({ id }) => id),
    total,
  })), [
    { key: "completed", ids: ["a", "d"], total: 26000 },
    { key: "cancelled", ids: ["b"], total: 9000 },
    { key: "in-progress", ids: ["c"], total: 25000 },
  ]);
  assert.equal(groups.flatMap(({ orders: rows }) => rows).length, orders.length);
});

test("invalid amounts make the total unknown instead of silently reporting less revenue", () => {
  const groups = groupShiftOrders([
    { id: "a", status: "COMPLETED", total: "10000" },
    { id: "b", status: "COMPLETED", total: "invalid" },
  ]);

  assert.equal(groups[0].total, null);
});

test("decimal totals and missing values are handled explicitly", () => {
  assert.equal(sumAmounts(["0.1", "0.2"]), 0.3);
  assert.equal(sumAmounts(["1", null]), null);
  assert.equal(sumAmounts(["1", ""]), null);
  assert.equal(sumAmounts([]), 0);
});

test("report escapes user text, includes cancelled items and separates orders from revenue", () => {
  const html = shiftReportHtml({ shiftNumber: 7, salesTotal: "5000", branch: { name: "<script>bad</script>" } }, [
    { id: '"unsafe', orderNumber: "A-1", status: "SERVED", total: "10000", items: [{ quantity: "1", productName: "Tea & cake", status: "CANCELLED" }] },
    { id: "b", orderNumber: "B-2", status: "CANCELLED", total: "3000", items: [] },
  ]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Tea &amp; cake \(bekor qilingan\)/);
  assert.match(html, /data-order-id="&quot;unsafe"/);
  assert.match(html, /Smena savdo tushumi/);
  assert.match(html, /Buyurtmalar soni: 2/);
  assert.doesNotMatch(html, /Yakunlangan savdo:/);
});

test("loads every page, including more than 200 shift orders", async () => {
  const orders = Array.from({ length: 205 }, (_, i) => ({ id: String(i) }));
  const offsets = [];
  const result = await readAllShiftOrders("shift", async (id, offset) => {
    assert.equal(id, "shift");
    offsets.push(offset);
    return orders.slice(offset, offset + 100);
  });
  assert.deepEqual(result, orders);
  assert.deepEqual(offsets, [0, 100, 200]);
});

test("repeated pages cannot loop forever or silently duplicate orders", async () => {
  const page = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
  await assert.rejects(readAllShiftOrders("shift", async () => page), /ro'yxati o'zgardi/);
});
