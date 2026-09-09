import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const controllerPath = join(__dirname, "../src/modules/customers/customers.controller.ts");
const source = readFileSync(controllerPath, "utf8");

function handlerName(block: string): string {
  return block.match(/^  (\w+)\(/m)?.[1] ?? "unknown handler";
}

test("customer endpoints that read CurrentCustomer use CustomerAuth decorator", () => {
  assert(
    !source.includes("UseGuards(CustomerAuthGuard)"),
    "Use @CustomerAuth() instead of hand-written Public + CustomerAuthGuard pairs.",
  );

  const unsafeHandlers = source
    .split(/\n\s*\n/g)
    .filter((block) => block.includes("@CurrentCustomer()"))
    .filter((block) => !block.includes("@CustomerAuth()"))
    .map(handlerName);

  assert.deepEqual(unsafeHandlers, []);
});
