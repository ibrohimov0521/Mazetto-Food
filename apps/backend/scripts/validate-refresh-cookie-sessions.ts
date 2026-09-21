import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const staffSession = readFileSync("../pos-web/lib/session.ts", "utf8");
const staffApi = readFileSync("../pos-web/lib/api.ts", "utf8");
const customerCart = readFileSync("../customer-web/lib/cart.tsx", "utf8");
const customerApi = readFileSync("../customer-web/lib/api.ts", "utf8");
const cookies = readFileSync("src/common/auth/refresh-cookie.ts", "utf8");

assert.match(cookies, /httpOnly: true/);
assert.match(cookies, /sameSite: "lax"/);
assert.match(cookies, /secure: process\.env\.NODE_ENV === "production"/);
assert.match(staffSession, /withoutRefreshToken/);
assert.match(customerCart, /withoutCustomerRefreshToken/);
assert.match(staffApi, /credentials: "include"/);
assert.match(customerApi, /credentials: "include"/);

console.log("Browser refresh sessions use HttpOnly cookies and omit refresh secrets from local storage");
