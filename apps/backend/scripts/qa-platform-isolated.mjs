import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
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
  DATABASE_URL: url.toString(),
  BESTTEAM_OWNER_BOOTSTRAP: "1",
  BACKEND_PORT: String(port),
  BACKEND_HOST: "127.0.0.1",
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: refreshSecret,
  BESTTEAM_OWNER_EMAIL: ownerEmail,
  BESTTEAM_OWNER_PASSWORD: ownerPassword,
};

function run(command, args, timeout = 180_000) {
  const result = spawnSync(command, args, { cwd: backendDir, env, encoding: "utf8", timeout, maxBuffer: 10_000_000 });
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}):\n${(result.stderr || result.stdout || "").slice(-4000)}`);
  }
}

async function request(base, path, init) {
  const response = await fetch(`${base}${path}`, { ...init, signal: globalThis.AbortSignal.timeout(8000) });
  const body = await response.json();
  return { status: response.status, body };
}

let server;
let webServer;
let browser;
let created = false;
try {
  docker("exec", container, "createdb", "-U", user, database);
  created = true;
  run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
  run(process.execPath, ["--import", "tsx", "scripts/bootstrap-platform-owner.ts"]);

  let staffRefreshToken = "";
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const tenant = await prisma.restaurantTenant.findUnique({ where: { code: "MAZETTO_FOOD" } });
    assert.equal(tenant?.status, "ACTIVE", "The initial Mazetto tenant must exist after migration.");
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
    const role = await prisma.role.create({ data: { code: "SUPER_ADMIN", name: "QA restaurant owner" } });
    const staff = await prisma.user.create({ data: {
      email: "qa-staff@bestteam.invalid", passwordHash: await hash("qa-staff-password", 12), isActive: true,
    } });
    await prisma.userRole.create({ data: { userId: staff.id, roleId: role.id } });
    const session = await prisma.session.create({ data: {
      userId: staff.id, refreshTokenHash: "pending", expiresAt: new Date(Date.now() + 3_600_000),
    } });
    staffRefreshToken = await new JwtService().signAsync(
      { id: staff.id, sessionId: session.id, tokenUse: "refresh" },
      { secret: refreshSecret, expiresIn: 3600 },
    );
    await prisma.session.update({
      where: { id: session.id }, data: { refreshTokenHash: await hash(staffRefreshToken, 12) },
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  let logs = "";
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
  const staffLogin = await request(base, "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "qa-staff@bestteam.invalid", password: "qa-staff-password" }),
  });
  assert.equal(staffLogin.status, 201, "Restaurant admins still authenticate on the shared API.");
  const restaurantAdminToken = staffLogin.body.data.tokens.accessToken;
  const restaurantOwnerAccess = await request(base, "/platform/sites", { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
  assert.equal(restaurantOwnerAccess.status, 403, "Restaurant SUPER_ADMIN must not access BestTeam owner routes.");
  const staffRefresh = await request(base, "/auth/refresh", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: staffRefreshToken }),
  });
  assert.equal(staffRefresh.status, 201);
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
  await page.getByRole("button", { name: "Restoran qo'shish" }).click();
  await page.getByRole("dialog").getByLabel("Restoran nomi").fill("QA From Browser");
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
  console.log("Shared-backend owner API QA passed: migrations, bootstrap, role isolation, registry, heartbeat, diagnostics, reports, activity, acknowledgement, audit.");
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
