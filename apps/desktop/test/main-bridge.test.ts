import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("native API bridge falls back through the local offline gateway", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const bridgeStart = source.indexOf('"desktop:api:request"');
  assert.notEqual(bridgeStart, -1);

  const bridgeSource = source.slice(bridgeStart, source.indexOf("function readSystemPrinterTargets", bridgeStart));
  assert.match(bridgeSource, /\$\{LOCAL_GATEWAY_API_URL\}\$\{path\}/);
  assert.doesNotMatch(bridgeSource, /\$\{UPSTREAM_API_URL\}\$\{path\}/);
});
