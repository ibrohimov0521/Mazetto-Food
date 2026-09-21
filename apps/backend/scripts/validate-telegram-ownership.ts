import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agent = readFileSync("../telegram-bot/src/main.ts", "utf8");
const controller = readFileSync("src/modules/telegram/telegram.controller.ts", "utf8");
const ownership = readFileSync("../../docs/audit/OPERATIONS_OWNERSHIP.md", "utf8");

assert.match(controller, /@Post\("webhook\/:secret"\)/);
assert.match(agent, /process\.argv\.includes\("--set-webhook"\)/);
assert.match(agent, /process\.argv\.includes\("--delete-webhook"\)/);
assert.doesNotMatch(agent, /getUpdates/);
assert.match(ownership, /backend alone parses customer and/);
assert.match(ownership, /Never run polling and webhook consumers/);

console.log("Telegram webhook ownership is explicit and single-consumer");
