import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const receiptDto = readFileSync("src/modules/receipts/dto/list-receipts.dto.ts", "utf8");
const receiptService = readFileSync("src/modules/receipts/receipts.service.ts", "utf8");
const printAgent = readFileSync("../print-agent/src/main.ts", "utf8");

test("receipt polling can ask the backend for unprinted receipts only", () => {
  assert.match(receiptDto, /printed\?: boolean/);
  assert.match(receiptDto, /value === "true" \? true : value === "false" \? false/);
  assert.match(receiptService, /typeof query\.printed === "boolean" \? \{ printed: query\.printed \}/);
  assert.match(printAgent, /new URLSearchParams\(\{ limit: "50", printed: "false" \}\)/);
});

test("print agent marks a receipt printed only after an adapter succeeds", () => {
  assert.match(printAgent, /if \(agentConfig\.dryRun\)[\s\S]*?return;[\s\S]*?await sendToPrinter\(agentConfig, receipt\);[\s\S]*?\/receipts\/\$\{encodeURIComponent\(receipt\.id\)\}\/print/);
  assert.match(printAgent, /agentConfig\.mode === "file"/);
  assert.match(printAgent, /agentConfig\.mode === "tcp"/);
  assert.match(printAgent, /catch \(error\) \{[\s\S]*?console\.error\(`Print failed for/);
});
