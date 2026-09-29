import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import net from "node:net";
import { Buffer } from "node:buffer";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { Pool } from "pg";
import { chromium } from "playwright";

const container = "mazetto-dev-postgres";
const database = `bestteam_owner_qa_${Date.now()}_${randomBytes(3).toString("hex")}`;
const backendDir = process.cwd();
const webDir = fileURLToPath(new URL("../../platform-web/", import.meta.url));
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const portMapping = docker("port", container, "5432/tcp");
assert.match(portMapping, /127\.0\.0\.1:5433/, "The isolated QA script requires the localhost dev database.");
const user = docker("exec", container, "printenv", "POSTGRES_USER");
const password = docker("exec", container, "printenv", "POSTGRES_PASSWORD");
assert.ok(user && password);

const url = new URL("postgresql://127.0.0.1:5433/postgres");
url.username = user;
url.password = password;
url.pathname = `/${database}`;
const ownerPassword = randomBytes(24).toString("base64url");
const ownerEmail = "qa-owner@bestteam.invalid";
const jwtSecret = randomBytes(32).toString("hex");
const refreshSecret = randomBytes(32).toString("hex");
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const env = {
  ...process.env,
  NODE_ENV: "test",
  CUSTOMER_TENANT_MIGRATION_QA: "1",
  MAZETTO_SETTINGS_DB_SMOKE: "1",
  REDIS_URL: "redis://127.0.0.1:1",
  REDIS_PORT: "1",
  DATABASE_URL: url.toString(),
  BESTTEAM_OWNER_BOOTSTRAP: "1",
  BACKEND_PORT: String(port),
  BACKEND_HOST: "127.0.0.1",
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: refreshSecret,
  BESTTEAM_OWNER_EMAIL: ownerEmail,
  BESTTEAM_OWNER_PASSWORD: ownerPassword,
};

function run(command, args, timeout = 180_000, childEnv = env) {
  const result = spawnSync(command, args, { cwd: backendDir, env: childEnv, encoding: "utf8", timeout, maxBuffer: 10_000_000 });
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}):\n${(result.stderr || result.stdout || "").slice(-4000)}`);
  }
}

async function request(base, path, init = {}) {
  const requestedHost = init.headers?.host ?? init.headers?.Host;
  if (!requestedHost) {
    const response = await fetch(`${base}${path}`, { ...init, signal: globalThis.AbortSignal.timeout(8000) });
    const body = await response.json();
    return { status: response.status, body };
  }

  const url = new URL(`${base}${path}`);
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: init.method ?? "GET",
      headers: { ...init.headers, host: requestedHost },
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error("QA request timed out")));
    req.on("error", reject);
    req.end(init.body);
  });
}

let server;
let webServer;
let browser;
let created = false;
let tenantHost = "";
let tenantAId = "";
let tenantBId = "";
let tenantBBranchId = "";
try {
  docker("exec", container, "createdb", "-U", user, database);
  created = true;
  run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
  run(process.execPath, ["--import", "tsx", "scripts/validate-customer-tenant-migration-db.ts"], 60_000);
  run(process.execPath, ["--import", "tsx", "scripts/bootstrap-platform-owner.ts"]);
  run(process.execPath, ["--import", "tsx", "scripts/validate-settings-registry-db.ts"], 60_000, { ...env, REDIS_URL: "", REDIS_PORT: "" });

  let staffRefreshToken = "";
  const staffPassword = "qa-staff-password";
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const tenant = await prisma.restaurantTenant.findUnique({ where: { code: "MAZETTO_FOOD" } });
    assert.equal(tenant?.status, "ACTIVE", "The initial Mazetto tenant must exist after migration.");
    tenantAId = tenant.id;
    const tenantSuffix = randomBytes(4).toString("hex");
    const branch = await prisma.branch.create({
      data: { code: "TENANTQA" + tenantSuffix, name: "Tenant registry QA branch" },
    });
    assert.equal(branch.tenantId, tenant.id, "New branches must default to the initial Mazetto tenant.");
    await prisma.branch.delete({ where: { id: branch.id } });
    const domain = await prisma.tenantDomain.create({
      data: { hostname: "qa-" + tenantSuffix + ".example.test", tenantId: tenant.id },
    });
    assert.equal(domain.status, "PENDING", "A new domain must not route before verification.");
    await prisma.tenantDomain.delete({ where: { id: domain.id } });
    tenantHost = "qa-restaurant-" + tenantSuffix + ".example.test";
    await prisma.tenantDomain.create({
      data: { hostname: tenantHost, tenantId: tenant.id, status: "VERIFIED", verifiedAt: new Date() },
    });
    const role = await prisma.role.create({ data: { code: "SUPER_ADMIN", name: "QA restaurant owner" } });
    const allPermissions = await prisma.permission.upsert({
      where: { code: "*" },
      update: {},
      create: { code: "*", name: "All permissions" },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: allPermissions.id } });
    const staff = await prisma.user.create({ data: {
      email: "qa-staff@bestteam.invalid", passwordHash: await hash(staffPassword, 12), isActive: true,
    } });
    await prisma.userRole.create({ data: { userId: staff.id, roleId: role.id } });
    const backfillBranch = await prisma.branch.create({ data: {
      code: "BACKFILL" + tenantSuffix, name: "Membership backfill QA branch",
    } });
    const backfillEmployee = await prisma.employee.create({ data: {
      branchId: backfillBranch.id,
      employeeCode: "BACKFILL" + tenantSuffix,
      firstName: "Legacy",
      userId: staff.id,
    } });
    const migrationSql = readFileSync(new URL("../prisma/migrations/20260928090000_tenant_memberships/migration.sql", import.meta.url), "utf8");
    const cteStart = migrationSql.indexOf("WITH eligible_membership_candidates AS (");
    const insertStart = migrationSql.indexOf('\nINSERT INTO "tenant_memberships"', cteStart);
    assert.ok(cteStart >= 0 && insertStart > cteStart, "Membership migration backfill CTE must be available for QA.");
    const legacyMemberships = await prisma.$queryRawUnsafe(
      `${migrationSql.slice(cteStart, insertStart)}
SELECT "tenantId", "userId", "branchId" FROM eligible_memberships WHERE "tenantId" = $1 AND "userId" = $2`,
      tenant.id,
      staff.id,
    );
    assert.equal(legacyMemberships.length, 1, "A legacy employee and role must yield one membership candidate.");
    assert.equal(legacyMemberships[0].branchId, backfillEmployee.branchId, "The backfill must retain the employee branch.");
    const staffMembership = await prisma.tenantMembership.create({ data: {
      tenantId: tenant.id, userId: staff.id, status: "ACTIVE",
    } });
    await prisma.tenantMembershipRole.create({
      data: { membershipId: staffMembership.id, roleId: role.id },
    });
    await prisma.user.create({ data: {
      email: "qa-member@bestteam.invalid", passwordHash: await hash("qa-member-password", 12), isActive: true,
    } });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  let logs = "";
  run("./node_modules/.bin/nest", ["build"], 180_000);
  server = spawn(process.execPath, ["dist/main.js"], { cwd: backendDir, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", chunk => { logs = (logs + chunk).slice(-5000); });
  server.stderr.on("data", chunk => { logs = (logs + chunk).slice(-5000); });
  const base = `http://127.0.0.1:${port}/api/v1`;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Owner API exited early: ${logs}`);
    try {
      const health = await request(base, "/health");
      if (health.status === 200 && (health.body.service ?? health.body.data?.service) === "mazetto-backend") {
        ready = true;
        break;
      }
    } catch { /* Wait for startup. */ }
    await sleep(300);
  }
  assert.ok(ready, `Owner API did not become healthy: ${logs}`);

  const anonymous = await request(base, "/platform/sites");
  assert.equal(anonymous.status, 401);
  const unknownHostLogin = await request(base, "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", host: "unknown.example.test" },
    body: JSON.stringify({ identifier: "qa-staff@bestteam.invalid", password: staffPassword }),
  });
  assert.equal(unknownHostLogin.status, 403, "Restaurant accounts must not use unknown-host login.");
  const staffLogin = await request(base, "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", host: tenantHost },
    body: JSON.stringify({ identifier: "qa-staff@bestteam.invalid", password: staffPassword }),
  });
  assert.equal(staffLogin.status, 201, "Restaurant login requires a verified host and active membership.");
  const restaurantAdminToken = staffLogin.body.data.tokens.accessToken;
  staffRefreshToken = staffLogin.body.data.tokens.refreshToken;
  const restaurantOwnerAccess = await request(base, "/platform/sites", { headers: { Authorization: "Bearer " + restaurantAdminToken, host: tenantHost } });
  assert.equal(restaurantOwnerAccess.status, 403, "Restaurant SUPER_ADMIN must not access BestTeam owner routes.");
  const unknownHostRefresh = await request(base, "/auth/refresh", {
    method: "POST", headers: { "Content-Type": "application/json", host: "unknown.example.test" },
    body: JSON.stringify({ refreshToken: staffRefreshToken }),
  });
  assert.equal(unknownHostRefresh.status, 403, "Tenant refresh is denied on an unknown host.");
  const staffRefresh = await request(base, "/auth/refresh", {
    method: "POST", headers: { "Content-Type": "application/json", host: tenantHost },
    body: JSON.stringify({ refreshToken: staffRefreshToken }),
  });
  assert.equal(staffRefresh.status, 201, JSON.stringify(staffRefresh.body.error));
  const signedIn = await request(base, "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: ownerEmail, password: ownerPassword }),
  });
  assert.equal(signedIn.status, 201, JSON.stringify(signedIn.body.error));
  const accessToken = signedIn.body.data.tokens.accessToken;
  const authorized = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  const invalidSite = await request(base, "/platform/sites", {
    method: "POST", headers: authorized,
    body: JSON.stringify({ name: "Private target", productCode: "FAST_FOOD", websiteUrl: "http://localhost", apiHealthUrl: "https://example.com/health" }),
  });
  assert.equal(invalidSite.status, 400);
  const suffix = randomBytes(4).toString("hex");
  const deniedTenantCreate = await request(base, "/platform/tenants", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${restaurantAdminToken}` },
    body: JSON.stringify({ code: `QA_${suffix}`, name: "Unauthorized tenant" }),
  });
  assert.equal(deniedTenantCreate.status, 403, "Restaurant admins must not provision tenants.");
  const createdTenant = await request(base, "/platform/tenants", {
    method: "POST", headers: authorized,
    body: JSON.stringify({ code: `QA_${suffix}`, name: "QA provisioning tenant" }),
  });
  assert.equal(createdTenant.status, 201, JSON.stringify(createdTenant.body.error));
  assert.equal(createdTenant.body.data.status, "PROVISIONING");
  tenantBId = createdTenant.body.data.id;
  const tenantRegistry = await request(base, "/platform/tenants", { headers: authorized });
  const provisionedTenant = tenantRegistry.body.data.find((tenant) => tenant.id === createdTenant.body.data.id);
  assert.equal(provisionedTenant?.status, "PROVISIONING");
  assert.equal(tenantRegistry.body.data.filter((tenant) => tenant.status === "ACTIVE").length, 1,
    "Provisioning must not disturb the existing restaurant activation.");
  const createdBranch = await request(base, `/platform/tenants/${createdTenant.body.data.id}/branches`, {
    method: "POST", headers: authorized,
    body: JSON.stringify({ code: `QA_${suffix}_MAIN`, name: "QA main branch", address: "Test address" }),
  });
  assert.equal(createdBranch.status, 201, JSON.stringify(createdBranch.body.error));
  assert.equal(createdBranch.body.data.tenantId, createdTenant.body.data.id);
  assert.equal(createdBranch.body.data.isActive, false, "New branches must not accept work before onboarding finishes.");
  tenantBBranchId = createdBranch.body.data.id;
  const provisionedMembership = await request(base, `/platform/tenants/${createdTenant.body.data.id}/memberships`, {
    method: "POST", headers: authorized,
    body: JSON.stringify({ identifier: "qa-staff@bestteam.invalid", roleCodes: ["SUPER_ADMIN"] }),
  });
  assert.equal(provisionedMembership.status, 201, JSON.stringify(provisionedMembership.body.error));
  assert.equal(provisionedMembership.body.data.status, "ACTIVE");
  assert.equal(provisionedMembership.body.data.roles[0].role.code, "SUPER_ADMIN");
  const provisionedMembers = await request(base, `/platform/tenants/${createdTenant.body.data.id}/memberships`, { headers: authorized });
  assert.equal(provisionedMembers.body.data.length, 1);

  const activeTenant = tenantRegistry.body.data.find((tenant) => tenant.status === "ACTIVE");
  assert.ok(activeTenant, "The pre-existing active restaurant must remain present.");
  const membershipHost = `qa-auth-${suffix}.example.test`;
  const membershipPool = new Pool({ connectionString: env.DATABASE_URL });
  const membershipPrisma = new PrismaClient({ adapter: new PrismaPg(membershipPool) });
  try {
    await membershipPrisma.tenantDomain.create({
      data: { hostname: membershipHost, tenantId: activeTenant.id, status: "VERIFIED", verifiedAt: new Date() },
    });
  } finally {
    await membershipPrisma.$disconnect();
    await membershipPool.end();
  }
  const activeMembership = await request(base, `/platform/tenants/${activeTenant.id}/memberships`, {
    method: "POST", headers: authorized,
    body: JSON.stringify({ identifier: "qa-member@bestteam.invalid", roleCodes: ["SUPER_ADMIN"] }),
  });
  assert.equal(activeMembership.status, 201, JSON.stringify(activeMembership.body.error));
  const invalidPlatformRole = await request(base, `/platform/tenants/${activeTenant.id}/memberships/${activeMembership.body.data.id}/roles`, {
    method: "PATCH", headers: authorized,
    body: JSON.stringify({ roleCodes: ["PLATFORM_OWNER"] }),
  });
  assert.equal(invalidPlatformRole.status, 400, "Platform-only roles must never become restaurant membership roles.");
  const ownerTenantLogin = await request(base, "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", host: membershipHost },
    body: JSON.stringify({ identifier: ownerEmail, password: ownerPassword }),
  });
  assert.equal(ownerTenantLogin.status, 401, "An account without restaurant membership cannot log in on its tenant domain.");
  const scopedLogin = await request(base, "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", host: membershipHost },
    body: JSON.stringify({ identifier: "qa-member@bestteam.invalid", password: "qa-member-password" }),
  });
  assert.equal(scopedLogin.status, 201, JSON.stringify(scopedLogin.body.error));
  const scopedUser = scopedLogin.body.data.user;
  assert.equal(scopedUser.tenantId, activeTenant.id);
  assert.equal(scopedUser.membershipId, activeMembership.body.data.id);
  const scopedAccessToken = scopedLogin.body.data.tokens.accessToken;
  const scopedRefreshToken = scopedLogin.body.data.tokens.refreshToken;
  const scopedMe = await request(base, "/auth/me", { headers: { Authorization: `Bearer ${scopedAccessToken}`, host: membershipHost } });
  assert.equal(scopedMe.status, 200);
  assert.equal(scopedMe.body.data.tenantId, activeTenant.id);
  const replayedToken = await request(base, "/auth/me", { headers: { Authorization: `Bearer ${scopedAccessToken}` } });
  assert.equal(replayedToken.status, 403, "Tenant tokens must not be replayable on an unregistered host.");
  const wrongHostRefresh = await request(base, "/auth/refresh", {
    method: "POST", headers: { "Content-Type": "application/json", host: "other.example.test" },
    body: JSON.stringify({ refreshToken: scopedRefreshToken }),
  });
  assert.equal(wrongHostRefresh.status, 403);
  const refreshedScoped = await request(base, "/auth/refresh", {
    method: "POST", headers: { "Content-Type": "application/json", host: membershipHost },
    body: JSON.stringify({ refreshToken: scopedRefreshToken }),
  });
  assert.equal(refreshedScoped.status, 201, JSON.stringify(refreshedScoped.body.error));
  assert.equal(refreshedScoped.body.data.user.tenantId, activeTenant.id);
  const suspendMembership = await request(base, `/platform/tenants/${activeTenant.id}/memberships/${activeMembership.body.data.id}/status`, {
    method: "PATCH", headers: authorized, body: JSON.stringify({ status: "SUSPENDED" }),
  });
  assert.equal(suspendMembership.status, 200);
  const suspendedToken = await request(base, "/auth/me", {
    headers: { Authorization: `Bearer ${refreshedScoped.body.data.tokens.accessToken}`, host: membershipHost },
  });
  assert.equal(suspendedToken.status, 401, "Suspending membership revokes access immediately.");
  assert.equal(tenantRegistry.body.data.filter((tenant) => tenant.status === "ACTIVE").length, 1,
    "Adding memberships must not activate another restaurant.");
  const activeTenantBranch = await request(base, `/platform/tenants/${activeTenant.id}/branches`, {
    method: "POST", headers: authorized,
    body: JSON.stringify({ code: `QA_${suffix}_ACTIVE`, name: "Must be rejected" }),
  });
  assert.equal(activeTenantBranch.status, 409, "Platform onboarding must not mutate an existing active restaurant.");
  const createdSite = await request(base, "/platform/sites", {
    method: "POST", headers: authorized,
    body: JSON.stringify({ name: "QA Restaurant", productCode: "FAST_FOOD", websiteUrl: `https://example.com/qa-${suffix}`, apiHealthUrl: `https://example.com/qa-${suffix}/health` }),
  });
  assert.equal(createdSite.status, 201, JSON.stringify(createdSite.body.error));
  const { site, agentToken } = createdSite.body.data;
  assert.match(site.siteKey, /^bt_/);
  assert.ok(agentToken.length >= 32);

  const heartbeat = {
    version: "qa", status: "healthy", services: { backend: "ok", database: "ok", redis: "ok" },
    totals: { branchCount: 1, openOrders: 1, kitchenQueue: 1, onlineDevices: 1, offlineDevices: 0, deadPrintJobs: 0 },
    kitchens: [{ branchId: "qa-kitchen", name: "QA oshxona", status: "OPEN", openOrders: 1, kitchenQueue: 1, onlineDevices: 1, offlineDevices: 0 }],
    dailyReports: [{ day: new Date().toISOString().slice(0, 10), completedOrders: 3, cancelledOrders: 1, completedOrderTotal: "91500" }],
    backup: { status: "verified", verifiedAt: new Date().toISOString(), bytes: 4096, archiveEntries: 18, restoreTested: false },
    diagnostics: [{ id: `qa-diagnostic-${suffix}`, service: "control_plane", code: "CONTROL_PLANE_UNREACHABLE", severity: "error", occurredAt: new Date().toISOString() }],
    events: [
      { id: `qa-event-${suffix}`, code: "KITCHEN_TICKET_CHANGED", branchId: "qa-kitchen", branchName: "QA oshxona", occurredAt: new Date().toISOString() },
      { id: `qa-alert-${suffix}`, code: "DEVICE_DISCONNECTED", branchId: "qa-kitchen", branchName: "QA oshxona", occurredAt: new Date().toISOString() },
      { id: `qa-ui-alert-${suffix}`, code: "PRINTER_FAILED", branchId: "qa-kitchen", branchName: "QA oshxona", occurredAt: new Date().toISOString() },
    ],
  };
  const posted = await request(base, `/platform/heartbeat/${site.siteKey}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-bestteam-agent-token": agentToken }, body: JSON.stringify(heartbeat),
  });
  assert.equal(posted.status, 201, JSON.stringify(posted.body.error));
  const diagnostics = await request(base, `/platform/diagnostics?siteId=${site.id}&severity=error`, { headers: authorized });
  assert.equal(diagnostics.status, 200, JSON.stringify(diagnostics.body.error));
  assert.equal(diagnostics.body.data[0].code, "CONTROL_PLANE_UNREACHABLE");
  assert.equal(diagnostics.body.data[0].site.name, "QA Restaurant");
  const registry = await request(base, "/platform/sites", { headers: authorized });
  assert.equal(registry.body.data.find(item => item.id === site.id)?.agentStatus, "ONLINE");
  assert.equal(registry.body.data.find(item => item.id === site.id)?.heartbeat.backup.status, "verified");
  const activity = await request(base, `/platform/events?siteId=${site.id}`, { headers: authorized });
  assert.ok(activity.body.data.some(event => event.code === "KITCHEN_TICKET_CHANGED" && event.site.name === "QA Restaurant"));
  const reports = await request(base, `/platform/reports?days=7&siteId=${site.id}`, { headers: authorized });
  assert.equal(reports.status, 200, JSON.stringify(reports.body.error));
  assert.equal(reports.body.data.sites[0].name, "QA Restaurant");
  assert.equal(reports.body.data.sites[0].reports[0].completedOrders, 3);
  assert.equal(reports.body.data.daily.reduce((total, day) => total + day.completedOrderTotal, 0), 91500);
  const openIncidents = await request(base, `/platform/events?siteId=${site.id}&state=open`, { headers: authorized });
  assert.ok(openIncidents.body.data.some(event => event.code === "DEVICE_DISCONNECTED"));
  assert.ok(!openIncidents.body.data.some(event => event.code === "KITCHEN_TICKET_CHANGED"));
  const alertEvent = activity.body.data.find(event => event.code === "DEVICE_DISCONNECTED");
  assert.ok(alertEvent);
  const acknowledgement = await request(base, `/platform/events/${alertEvent.id}/acknowledge`, { method: "POST", headers: authorized });
  assert.equal(acknowledgement.status, 201);
  assert.ok(acknowledgement.body.data.acknowledgedAt);
  assert.equal(acknowledgement.body.data.acknowledgedById, signedIn.body.data.user.id);
  assert.equal(acknowledgement.body.data.acknowledgedBy.email, ownerEmail);
  const openAfterAcknowledgement = await request(base, `/platform/events?siteId=${site.id}&state=open`, { headers: authorized });
  assert.ok(!openAfterAcknowledgement.body.data.some(event => event.code === "DEVICE_DISCONNECTED"));
  const repeatedAcknowledgement = await request(base, `/platform/events/${alertEvent.id}/acknowledge`, { method: "POST", headers: authorized });
  assert.equal(repeatedAcknowledgement.body.data.acknowledgedAt, acknowledgement.body.data.acknowledgedAt);
  const rejectedAcknowledgement = await request(base, `/platform/events/${activity.body.data.find(event => event.code === "KITCHEN_TICKET_CHANGED").id}/acknowledge`, { method: "POST", headers: authorized });
  assert.equal(rejectedAcknowledgement.status, 400);
  const audit = await request(base, "/platform/audit?limit=50&offset=0", { headers: authorized });
  assert.ok(audit.body.data.entries.some(entry => entry.action === "PLATFORM_SITE_CREATED" && entry.user?.email === ownerEmail));
  assert.ok(audit.body.data.entries.some(entry => entry.action === "PLATFORM_EVENT_ACKNOWLEDGED" && entry.user?.email === ownerEmail));
  const searchedAudit = await request(base, `/platform/audit?limit=50&offset=0&q=${encodeURIComponent(ownerEmail)}`, { headers: authorized });
  assert.ok(searchedAudit.body.data.entries.length > 0);
  assert.ok(searchedAudit.body.data.entries.every(entry => entry.user?.email === ownerEmail));
  const kitchen = await request(base, `/platform/sites/${site.id}/events?branchId=qa-kitchen`, { headers: authorized });
  assert.ok(kitchen.body.data.some(event => event.branchId === "qa-kitchen"));

  const webPort = await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
  webServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(webPort), "-H", "127.0.0.1"], {
    cwd: webDir,
    env: { ...env, NODE_ENV: "development", NEXT_DIST_DIR: ".next-owner-qa", BESTTEAM_API_INTERNAL_URL: `http://127.0.0.1:${port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let webLogs = "";
  webServer.stdout.on("data", chunk => { webLogs = (webLogs + chunk).slice(-5000); });
  webServer.stderr.on("data", chunk => { webLogs = (webLogs + chunk).slice(-5000); });
  const webBase = `http://127.0.0.1:${webPort}`;
  let webReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (webServer.exitCode !== null) throw new Error(`Owner web exited early: ${webLogs}`);
    try {
      const response = await fetch(`${webBase}/login`, { signal: globalThis.AbortSignal.timeout(3000) });
      if (response.status === 200) { webReady = true; break; }
    } catch { /* Wait for Next.js. */ }
    await sleep(300);
  }
  assert.ok(webReady, `Owner web did not become ready: ${webLogs}`);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/snap/bin/chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  await page.goto(`${webBase}/login`);
  await page.getByLabel("Login yoki telefon").fill(ownerEmail);
  await page.getByLabel("Parol").fill(ownerPassword);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.getByRole("heading", { name: "Umumiy holat" }).waitFor({ timeout: 15_000 });
  const liveStatus = page.locator(".live-label");
  await liveStatus.waitFor();
  assert.match(await liveStatus.getAttribute("title"), /Ma'lumotlar bazasi: ok; Redis:/);
  await page.getByText("QA Restaurant").first().waitFor();
  await page.getByRole("link", { name: "Hodisalar" }).click();
  await page.getByText("Printerda xato").waitFor();
  const alertRow = page.locator(".global-event").filter({ hasText: "Printerda xato" });
  await alertRow.getByRole("button", { name: "Ko'rib chiqildi" }).click();
  await alertRow.getByText(ownerEmail).waitFor();
  await page.getByRole("button", { name: "Ko'rib chiqilgan" }).click();
  await page.getByText("Printerda xato").waitFor();
  assert.equal(await page.locator(".global-event").filter({ hasText: "Printerda xato" }).getByRole("button", { name: "Ko'rib chiqildi" }).count(), 0);
  await page.getByRole("button", { name: "Ochiq", exact: true }).click();
  await page.locator(".empty").filter({ hasText: "Ochiq hodisalar topilmadi." }).waitFor({ state: "attached" });
  assert.equal(await page.locator(".global-event").count(), 0, "Acknowledged incidents should not appear in the open filter.");
  await page.getByRole("link", { name: "Boshqaruv jurnali" }).click();
  await page.getByRole("heading", { name: "Boshqaruv jurnali" }).waitFor();
  await page.getByText("Restoran monitoringga qo'shildi").waitFor();
  await page.getByText(ownerEmail).waitFor();
  await page.getByRole("link", { name: "Hisobotlar" }).click();
  await page.getByRole("heading", { name: "Hisobotlar" }).waitFor();
  await page.locator(".report-day").first().waitFor();
  assert.equal(await page.locator(".report-day").count(), 14);
  assert.equal(await page.locator(".metrics .metric strong").first().textContent(), "3");
  await page.getByRole("link", { name: "Texnik xatolar" }).click();
  await page.getByRole("heading", { name: "Texnik xatolar" }).waitFor();
  await page.getByText("Markaziy panelga ulanish uzildi").waitFor();
  await page.goto(`${webBase}/restaurants/${site.id}`);
  await page.getByText("Arxiv tekshirildi").waitFor();
  await page.getByText("Tiklash sinovi hali o'tkazilmagan").waitFor();
  await page.getByRole("link", { name: "Umumiy holat" }).click();
  await page.getByRole("button", { name: "Monitoringga ulash" }).click();
  await page.getByRole("dialog").getByLabel("Loyiha nomi").fill("QA From Browser");
  await page.getByRole("dialog").getByLabel("Loyiha kodi").fill("FAST_FOOD");
  await page.getByRole("dialog").getByLabel("Sayt manzili").fill("http://localhost");
  await page.getByRole("dialog").getByLabel("API holat manzili").fill(`https://example.com/browser-${suffix}/health`);
  await page.getByRole("dialog").getByRole("button", { name: "Saqlash" }).click();
  await page.getByRole("dialog").getByRole("alert").getByText("Faqat ommaviy domenning HTTPS manzili qabul qilinadi.").waitFor();
  await page.getByRole("dialog").getByLabel("Sayt manzili").fill(`https://example.com/browser-${suffix}`);
  await page.getByRole("dialog").getByRole("button", { name: "Saqlash" }).click();
  await page.locator(".token-field").waitFor({ timeout: 15_000 });
  const afterBrowser = await request(base, "/platform/sites", { headers: authorized });
  assert.ok(afterBrowser.body.data.some(item => item.name === "QA From Browser"));

  const tenantBHost = `qa-restaurant-b-${suffix}.example.test`;
  const sharedPhone = "+998901234567";
  const codeA = "135791";
  const codeB = "246802";
  const qaPool = new Pool({ connectionString: env.DATABASE_URL });
  const qaPrisma = new PrismaClient({ adapter: new PrismaPg(qaPool) });
  try {
    await qaPrisma.restaurantTenant.update({ where: { id: tenantBId }, data: { status: "ACTIVE" } });
    await qaPrisma.branch.updateMany({ where: { tenantId: tenantAId }, data: { isActive: false } });
    const tenantABranch = await qaPrisma.branch.create({
      data: { code: `QAA_${suffix}`, tenantId: tenantAId, name: "QA tenant A branch" },
    });
    await qaPrisma.branch.update({ where: { id: tenantBBranchId }, data: { isActive: true } });
    await qaPrisma.tenantDomain.create({
      data: { hostname: tenantBHost, tenantId: tenantBId, status: "VERIFIED", verifiedAt: new Date() },
    });
    await qaPrisma.setting.createMany({ data: [
      { tenantId: tenantAId, key: "customer_delivery_fee", value: "1100", isPublic: true },
      { tenantId: tenantBId, key: "customer_delivery_fee", value: "2200", isPublic: true },
    ] });
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await qaPrisma.customerVerificationChallenge.createMany({ data: [
      { tenantId: tenantAId, phone: sharedPhone, codeHash: await hash(codeA, 4), expiresAt },
      { tenantId: tenantBId, phone: sharedPhone, codeHash: await hash(codeB, 4), expiresAt },
    ] });

    const branchesA = await request(base, "/customer/branches", { headers: { host: tenantHost } });
    const branchesB = await request(base, "/customer/branches", { headers: { host: tenantBHost } });
    assert.equal(branchesA.status, 200, JSON.stringify(branchesA.body.error));
    assert.equal(branchesB.status, 200, JSON.stringify(branchesB.body.error));
    assert.deepEqual(branchesA.body.data.map(branch => branch.id), [tenantABranch.id]);
    assert.deepEqual(branchesB.body.data.map(branch => branch.id), [tenantBBranchId]);
    const publicSettingsA = await request(base, "/settings/public", { headers: { host: tenantHost } });
    const publicSettingsB = await request(base, "/settings/public", { headers: { host: tenantBHost } });
    assert.equal(publicSettingsA.status, 200, JSON.stringify(publicSettingsA.body.error));
    assert.equal(publicSettingsB.status, 200, JSON.stringify(publicSettingsB.body.error));
    assert.equal(publicSettingsA.body.data.customerDeliveryFee, 1100);
    assert.equal(publicSettingsB.body.data.customerDeliveryFee, 2200);

    const updateTenantSetting = (host, token, value) => request(base, "/settings/customer_delivery_fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", host, Authorization: "Bearer " + token },
      body: JSON.stringify({ value: String(value) }),
    });
    const crossTenantSettingUpdate = await updateTenantSetting(tenantBHost, restaurantAdminToken, 2600);
    assert.ok([401, 403].includes(crossTenantSettingUpdate.status),
      "Tenant A's staff token must not update tenant B's settings.");
    const staffLoginB = await request(base, "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: tenantBHost },
      body: JSON.stringify({ identifier: "qa-staff@bestteam.invalid", password: staffPassword }),
    });
    assert.equal(staffLoginB.status, 201, JSON.stringify(staffLoginB.body.error));
    assert.equal(staffLoginB.body.data.user.tenantId, tenantBId);
    const settingsUpdateB = await updateTenantSetting(tenantBHost, staffLoginB.body.data.tokens.accessToken, 2500);
    assert.equal(settingsUpdateB.status, 200, JSON.stringify(settingsUpdateB.body.error));
    const settingsAfterWriteA = await request(base, "/settings/public", { headers: { host: tenantHost } });
    const settingsAfterWriteB = await request(base, "/settings/public", { headers: { host: tenantBHost } });
    assert.equal(settingsAfterWriteA.body.data.customerDeliveryFee, 1100);
    assert.equal(settingsAfterWriteB.body.data.customerDeliveryFee, 2500);

    const verify = (host, code, name) => request(base, "/customer/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json", host },
      body: JSON.stringify({ phone: sharedPhone, code, name }),
    });
    const crossTenantCode = await verify(tenantHost, codeB, "Wrong tenant");
    assert.equal(crossTenantCode.status, 401, "Tenant B's OTP must not authenticate on tenant A's host.");
    const customerAResponse = await verify(tenantHost, codeA, "Tenant A customer");
    const customerBResponse = await verify(tenantBHost, codeB, "Tenant B customer");
    assert.equal(customerAResponse.status, 201, JSON.stringify(customerAResponse.body.error));
    assert.equal(customerBResponse.status, 201, JSON.stringify(customerBResponse.body.error));
    const customerA = customerAResponse.body.data;
    const customerB = customerBResponse.body.data;
    assert.equal(customerA.customer.tenantId, tenantAId);
    assert.equal(customerB.customer.tenantId, tenantBId);
    assert.notEqual(customerA.customer.id, customerB.customer.id);

    const customerMe = (host, accessToken) => request(base, "/customer/auth/me", {
      headers: { host, Authorization: `Bearer ${accessToken}` },
    });
    assert.equal((await customerMe(tenantBHost, customerA.tokens.accessToken)).status, 401,
      "Tenant A's access token must not authenticate on tenant B's host.");
    assert.equal((await customerMe(tenantHost, customerB.tokens.accessToken)).status, 401,
      "Tenant B's access token must not authenticate on tenant A's host.");

    const refresh = (host, refreshToken) => request(base, "/customer/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", host },
      body: JSON.stringify({ refreshToken }),
    });
    assert.equal((await refresh(tenantBHost, customerA.tokens.refreshToken)).status, 401,
      "Tenant A's refresh token must not rotate on tenant B's host.");
    assert.equal((await refresh(tenantHost, customerB.tokens.refreshToken)).status, 401,
      "Tenant B's refresh token must not rotate on tenant A's host.");
    const refreshedB = await refresh(tenantBHost, customerB.tokens.refreshToken);
    assert.equal(refreshedB.status, 201, JSON.stringify(refreshedB.body.error));
    assert.equal(refreshedB.body.data.customer.tenantId, tenantBId);
    console.log("Staging A/B proof passed: verified domains isolate branches, same-phone OTP identities, access tokens, and refresh tokens.");
  } finally {
    await qaPrisma.$disconnect();
    await qaPool.end();
  }

  console.log("Shared-backend QA passed: migrations, platform bootstrap, tenant-bound login/refresh, unknown-host denial, membership onboarding, role isolation, monitoring, reports, activity, audit.");
  console.log("Owner web end-to-end QA passed: real login, reports, diagnostics, backup evidence, and site registration through the Next.js proxy.");
} finally {
  if (browser) await browser.close();
  if (webServer && webServer.exitCode === null) {
    webServer.kill("SIGTERM");
    await Promise.race([new Promise(resolve => webServer.once("exit", resolve)), sleep(5000)]);
    if (webServer.exitCode === null) webServer.kill("SIGKILL");
  }
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise(resolve => server.once("exit", resolve)), sleep(5000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  if (created) docker("exec", container, "dropdb", "-U", user, "--force", database);
}
