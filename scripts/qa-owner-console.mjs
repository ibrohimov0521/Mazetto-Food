import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.OWNER_WEB_URL ?? "http://127.0.0.1:3104";
const stamp = "2026-09-26T07:00:00.000Z";
const probe = (status) => ({ status, statusCode: status === "ONLINE" ? 200 : null, latencyMs: status === "ONLINE" ? 84 : null, checkedAt: stamp, error: status === "OFFLINE" ? "Timeout" : null });
const site = {
  id: "site-1", siteKey: "mz_demo", name: "Mazetto Food", productCode: "MAZETTO_FOOD",
  websiteUrl: "https://mazetto.example", apiHealthUrl: "https://api.mazetto.example/health",
  isActive: true, agentStatus: "ONLINE", lastHeartbeatAt: stamp, website: probe("ONLINE"), api: probe("ONLINE"),
  heartbeat: { version: "1.0.0", status: "healthy", services: { backend: "ok", database: "ok", redis: "ok" }, totals: { branchCount: 1, openOrders: 5, kitchenQueue: 3, onlineDevices: 2, offlineDevices: 0, deadPrintJobs: 0 }, backup: { status: "verified", verifiedAt: stamp, bytes: 4096, archiveEntries: 18, restoreTested: false }, kitchens: [{ branchId: "branch-1", name: "Markaziy oshxona", status: "OPEN", openOrders: 5, kitchenQueue: 3, onlineDevices: 2, offlineDevices: 0, lastActivityAt: stamp }] },
};
const second = { ...site, id: "site-2", siteKey: "second", name: "Yangi Restoran", productCode: "OTHER_FOOD", website: probe("OFFLINE"), agentStatus: "OFFLINE" };
const tenant = {
  id: "tenant-1", code: "MAZETTO_FOOD", name: "Mazetto Food", status: "ACTIVE", createdAt: stamp, updatedAt: stamp,
  branches: [{ id: "branch-1", code: "central", name: "Markaziy filial", isActive: true, isTemporarilyClosed: false, acceptsOrders: true }],
  activity: { activeBranches: 1, acceptingOrdersBranches: 1, openOrders: 5, onlineDevices: 2, offlineDevices: 0 },
  platformSites: [], domains: [],
};
const envelope = (data) => ({ success: true, data });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: "chrome" }) });

try {
  for (const viewport of [{ width: 1600, height: 900 }, { width: 768, height: 900 }, { width: 360, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("dialog", dialog => dialog.accept());
    let currentSites = [site, second];
    let currentTenants = [tenant];
    const membershipRoleOptions = [
      { id: "role-admin", code: "RESTAURANT_ADMIN", name: "Restoran administratori", isBranchScoped: false },
      { id: "role-cashier", code: "CASHIER", name: "Kassir", isBranchScoped: true },
    ];
    const membershipsByTenant = new Map();
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem("bestteam.owner.session", JSON.stringify({ user: { id: "owner-1", email: "owner@bestteam.uz", roles: ["PLATFORM_OWNER"], permissions: ["*"] }, accessToken: "qa" })));
    await page.route("**/api/v1/auth/me", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ id: "owner-1", email: "owner@bestteam.uz", roles: ["PLATFORM_OWNER"], permissions: ["*"] })) }));
    await page.route("**/api/v1/health", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ service: "bestteam-platform", status: "ok", database: { status: "ok" }, redis: "fallback" })) }));
    await page.route("**/api/v1/platform/sites", route => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        const created = { ...site, ...body, id: "site-3", siteKey: "new_site", agentStatus: "WAITING", heartbeat: null };
        currentSites = [...currentSites, created];
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ site: created, agentToken: "qa-one-time-token" })) });
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(currentSites)) });
    });
    await page.route("**/api/v1/platform/tenants", route => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        const created = {
          ...tenant, id: "tenant-new", code: body.code, name: body.name,
          status: "PROVISIONING", branches: [], domains: [], platformSites: [],
          activity: { activeBranches: 0, acceptingOrdersBranches: 0, openOrders: 0, onlineDevices: 0, offlineDevices: 0 },
        };
        currentTenants = [...currentTenants, created];
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(created)) });
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(currentTenants)) });
    });
    await page.route("**/api/v1/platform/tenants/*/membership-role-options", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(membershipRoleOptions)) }));
    await page.route("**/api/v1/platform/tenants/*/memberships**", route => {
      const request = route.request();
      const segments = new URL(request.url()).pathname.split("/");
      const tenantId = segments[5];
      const current = membershipsByTenant.get(tenantId) || [];
      if (request.method() === "GET") return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(current)) });
      const body = request.postDataJSON();
      if (request.method() === "POST") {
        const tenantEntry = currentTenants.find(item => item.id === tenantId);
        const created = { id: `member-${tenantId}`, tenantId, userId: "user-qa", branchId: body.branchId || null, status: "ACTIVE", createdAt: stamp, updatedAt: stamp, user: { id: "user-qa", displayName: "QA Manager", email: body.identifier, phone: null, isActive: true }, branch: tenantEntry?.branches.find(item => item.id === body.branchId) || null, roles: body.roleCodes.map(code => ({ role: membershipRoleOptions.find(role => role.code === code) })) };
        membershipsByTenant.set(tenantId, [...current, created]);
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(created)) });
      }
      const membershipId = segments.at(-2);
      const updated = current.map(item => item.id !== membershipId ? item : request.url().endsWith("/status")
        ? { ...item, status: body.status, updatedAt: stamp }
        : { ...item, branchId: body.branchId || item.branchId, branch: currentTenants.find(tenantItem => tenantItem.id === tenantId)?.branches.find(branch => branch.id === (body.branchId || item.branchId)) || null, roles: body.roleCodes.map(code => ({ role: membershipRoleOptions.find(role => role.code === code) })), updatedAt: stamp });
      membershipsByTenant.set(tenantId, updated);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(updated.find(item => item.id === membershipId))) });
    });
    await page.route("**/api/v1/platform/tenants/*/branches", route => {
      const body = route.request().postDataJSON();
      const tenantId = new URL(route.request().url()).pathname.split("/").at(-2);
      const created = { id: "branch-new", tenantId, code: body.code, name: body.name, address: body.address ?? null, phone: body.phone ?? null, isActive: false, isTemporarilyClosed: false, acceptsOrders: false };
      currentTenants = currentTenants.map(item => item.id === tenantId ? { ...item, branches: [...item.branches, created] } : item);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(created)) });
    });
    await page.route("**/api/v1/platform/sites/site-1/rotate-token", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ siteKey: "mz_demo", agentToken: "qa-rotated-token" })) }));
    await page.route("**/api/v1/platform/sites/site-1", route => {
      const body = route.request().postDataJSON();
      currentSites = currentSites.map(item => item.id === "site-1" ? { ...item, ...body } : item);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(currentSites[0])) });
    });
    await page.route("**/api/v1/platform/sites/site-2", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(second)) }));
    await page.route("**/api/v1/platform/sites/site-2/events?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope([])) }));
    await page.route("**/api/v1/platform/sites/site-1/events?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope([{ id: "event-1", siteId: "site-1", code: "KITCHEN_TICKET_CHANGED", branchId: "branch-1", branchName: "Markaziy oshxona", occurredAt: stamp, receivedAt: stamp }])) }));
    await page.route("**/api/v1/platform/events?**", route => {
      const params = new URL(route.request().url()).searchParams;
      const selectedSite = params.get("siteId");
      const state = params.get("state");
      const event = state === "acknowledged"
        ? { id: "global-3", siteId: "site-1", site: { name: "Mazetto Food", productCode: "MAZETTO_FOOD" }, code: "API_OFFLINE", branchId: null, branchName: null, occurredAt: stamp, receivedAt: stamp, acknowledgedAt: stamp, acknowledgedById: "owner-1", acknowledgedBy: { id: "owner-1", displayName: "BestTeam egasi", email: "owner@bestteam.uz", phone: null } }
        : state === "open"
          ? { id: "global-1", siteId: "site-2", site: { name: "Yangi Restoran", productCode: "OTHER_FOOD" }, code: "WEBSITE_OFFLINE", branchId: null, branchName: null, occurredAt: stamp, receivedAt: stamp }
          : selectedSite === "site-1"
        ? { id: "global-2", siteId: "site-1", site: { name: "Mazetto Food", productCode: "MAZETTO_FOOD" }, code: "KITCHEN_TICKET_CHANGED", branchId: "branch-1", branchName: "Markaziy oshxona", occurredAt: stamp, receivedAt: stamp }
        : { id: "global-1", siteId: "site-2", site: { name: "Yangi Restoran", productCode: "OTHER_FOOD" }, code: "WEBSITE_OFFLINE", branchId: null, branchName: null, occurredAt: stamp, receivedAt: stamp };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope([event])) });
    });
    await page.route("**/api/v1/platform/audit?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ entries: [{ id: "audit-1", action: "PLATFORM_SITE_CREATED", entity: "PLATFORM_SITE", entityId: "site-1", metadata: { name: "Mazetto Food", productCode: "MAZETTO_FOOD" }, createdAt: stamp, user: { id: "owner-1", displayName: "BestTeam egasi", email: "owner@bestteam.uz", phone: null } }], hasNext: false })) }));
    await page.route("**/api/v1/platform/diagnostics?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope([{ id: "diag-1", siteId: "site-1", externalId: "diag-external-1", service: "control_plane", code: "CONTROL_PLANE_UNREACHABLE", severity: "error", occurredAt: stamp, receivedAt: stamp, site: { name: "Mazetto Food", productCode: "MAZETTO_FOOD" } }])) }));
    await page.route("**/api/v1/platform/reports?**", route => {
      const days = Number(new URL(route.request().url()).searchParams.get("days") || 14);
      const daily = Array.from({ length: days }, (_, index) => {
        const date = new Date(); date.setUTCDate(date.getUTCDate() - days + index + 1);
        const day = date.toISOString().slice(0, 10);
        return { day, completedOrders: index === days - 1 ? 5 : 2, cancelledOrders: index === 3 ? 1 : 0, completedOrderTotal: index === days - 1 ? 120000 : 45000 };
      });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ days, timezone: "UTC", daily, generatedAt: stamp, sites: [
        { siteId: "site-1", name: "Mazetto Food", productCode: "MAZETTO_FOOD", lastHeartbeatAt: stamp, stale: false, reports: daily },
        { siteId: "site-2", name: "Yangi Restoran", productCode: "OTHER_FOOD", lastHeartbeatAt: null, stale: true, reports: [] },
      ] })) });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Umumiy holat" }).waitFor();
    for (const asset of ["best-team-logo.webp", "bestteam-background.webp"]) {
      assert.equal((await page.request.get(new URL("/" + asset, baseUrl).toString())).status(), 200, asset + " must be served");
    }
    const background = await page.locator("body").evaluate(element => {
      const style = getComputedStyle(element, "::before");
      return { position: style.position, image: style.backgroundImage };
    });
    assert.equal(background.position, "fixed", "BestTeam background must stay fixed while scrolling");
    assert.ok(background.image.includes("bestteam-background.webp"));
    const liveStatus = page.locator(".live-label");
    await liveStatus.waitFor();
    assert.match(await liveStatus.getAttribute("title"), /Ma'lumotlar bazasi: ok; Redis: fallback/);
    assert.equal(await liveStatus.locator(".live-dot").evaluate(dot => getComputedStyle(dot).backgroundColor), "rgb(214, 145, 32)");
    await page.getByText("Mazetto Food").first().waitFor();
    await page.getByRole("heading", { name: "So'nggi hodisalar" }).waitFor();
    assert.equal(await page.locator(".metric strong").first().textContent(), "2");
    assert.equal(await page.locator(".metric strong").last().textContent(), "3", "Offline queue must not count as live.");
    for (const item of [
      { label: /Kuzatuvdagi loyihalar/, filter: null, count: "2 ta restoran" },
      { label: /Sog'lom/, filter: "healthy", count: "1 ta restoran" },
      { label: /Nosozlik/, filter: "danger", count: "1 ta restoran" },
      { label: /Oshxona navbati/, filter: "queue", count: "1 ta restoran" },
    ]) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Umumiy holat" }).waitFor();
      await page.locator(".metrics").getByRole("link", { name: item.label }).click();
      await page.waitForURL(url => url.pathname === "/restaurants" && (url.searchParams.get("filter") || null) === item.filter);
      await page.getByText(item.count, { exact: true }).waitFor();
    }
    currentSites = [site, {
      ...second,
      website: probe("ONLINE"), api: probe("ONLINE"), agentStatus: "DEGRADED",
      heartbeat: { ...site.heartbeat, status: "degraded", services: { backend: "ok", database: "error", redis: "degraded" } },
    }];
    await page.goto(`${baseUrl}/restaurants?filter=warning#site-list`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Monitoring xizmatlari" }).waitFor();
    const degradedSiteRow = page.getByRole("row").filter({ hasText: "Yangi Restoran" });
    await degradedSiteRow.locator(".status-warning").getByText("E'tibor kerak").waitFor();
    assert.equal(await page.locator("tbody tr").count(), 1, "degraded heartbeat must be included in the warning filter");
    await page.goto(`${baseUrl}/restaurants/site-2`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Yangi Restoran" }).waitFor();
    const databaseStatus = page.locator(".service-strip .service-line").filter({ hasText: "Ma'lumotlar bazasi" });
    const redisStatus = page.locator(".service-strip .service-line").filter({ hasText: "Redis" });
    await databaseStatus.locator(".status-danger").getByText("error").waitFor();
    await redisStatus.locator(".status-warning").getByText("degraded").waitFor();
    currentSites = [site, second];
    await page.goto(baseUrl + "/tenants", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Restoran tenantlari" }).waitFor();
    await page.getByRole("link", { name: /Restoranlar/ }).click();
    await page.waitForURL(url => url.pathname === "/tenants" && url.hash === "#tenant-list");
    await page.getByText("Mazetto Food").first().waitFor();
    await page.getByRole("button", { name: "Yangi restoran" }).click();
    const tenantDialog = page.getByRole("dialog");
    await tenantDialog.getByLabel("Restoran nomi").fill("QA Restoran");
    await tenantDialog.getByLabel("Restoran kodi").fill("QA_RESTAURANT");
    await tenantDialog.getByRole("button", { name: "Restoran yaratish" }).click();
    await tenantDialog.waitFor({ state: "hidden" });
    const provisionedRow = page.getByRole("row").filter({ hasText: "QA_RESTAURANT" });
    await provisionedRow.getByText("Tayyorlanmoqda").waitFor();
    await provisionedRow.getByRole("button", { name: "Filial qo'shish" }).click();
    const branchDialog = page.getByRole("dialog");
    await branchDialog.getByRole("heading", { name: "Birinchi filial" }).waitFor();
    await branchDialog.getByLabel("Filial nomi").fill("QA main branch");
    await branchDialog.getByLabel("Filial kodi").fill("QA_MAIN");
    await branchDialog.getByLabel("Manzil").fill("Test address");
    await branchDialog.getByLabel("Telefon").fill("+998901234567");
    await branchDialog.getByRole("button", { name: "Filial yaratish" }).click();
    await branchDialog.waitFor({ state: "hidden" });
    await provisionedRow.getByText("QA main branch").waitFor();
    await page.getByLabel(/Tenant holati/).selectOption("PROVISIONING");
    assert.equal(await page.locator("tbody tr").count(), 1, "The provisioning filter must show only the new tenant.");
    await provisionedRow.getByRole("button", { name: "Bosqichlar" }).click();
    const onboarding = page.locator(".tenant-onboarding-panel");
    await onboarding.getByRole("heading", { name: "QA Restoran · onboarding" }).waitFor();
    await onboarding.getByText("1 ta filial ro'yxatda; yangi filial savdo yoqilmagan holatda.").waitFor();
    await onboarding.getByText("Tasdiqlangan domen topilmadi; TXT tekshiruvi hali o'tmagan.").waitFor();
    await onboarding.getByText("Sayt va API monitoringi hali tenantga ulanmagan.").waitFor();
    await onboarding.getByText("A/B tenant izolyatsiyasi va trusted-domain routing yakunlanmagan. Faollashtirish mavjud emas.").waitFor();
    await onboarding.getByRole("button", { name: "A'zolarni boshqarish" }).click();
    const membershipPanel = page.locator(".tenant-membership-panel");
    await membershipPanel.getByRole("heading", { name: "QA Restoran · xodimlar va a'zoliklar" }).waitFor();
    const addMembershipForm = membershipPanel.locator(".tenant-membership-create");
    await addMembershipForm.getByLabel("Login, email yoki telefon").fill("manager@example.uz");
    await addMembershipForm.getByRole("checkbox", { name: /Restoran administratori/ }).check();
    assert.equal(await addMembershipForm.getByRole("checkbox", { name: /Platform owner/ }).count(), 0, "platform roles must not be assignable to a restaurant member");
    await addMembershipForm.getByRole("button", { name: "A'zoni biriktirish" }).click();
    const membershipRow = membershipPanel.locator("tbody tr").filter({ hasText: "manager@example.uz" });
    await membershipRow.getByText("Restoran administratori").waitFor();
    await membershipRow.getByRole("button", { name: "Rollar" }).click();
    const membershipEditForm = membershipPanel.locator(".tenant-membership-edit");
    await membershipEditForm.getByRole("checkbox", { name: /Restoran administratori/ }).uncheck();
    await membershipEditForm.getByRole("checkbox", { name: /Kassir/ }).check();
    await membershipEditForm.locator("select").selectOption("branch-new");
    await membershipEditForm.getByRole("button", { name: "Rollarni saqlash" }).click();
    await membershipRow.getByText("Kassir").waitFor();
    await membershipRow.getByText("QA main branch").waitFor();
    await membershipRow.getByRole("button", { name: "To'xtatish" }).click();
    await membershipRow.getByText("To'xtatilgan").waitFor();
    await membershipRow.getByRole("button", { name: "Faollashtirish" }).click();
    await membershipRow.getByText("Faol", { exact: true }).waitFor();
    await page.screenshot({ path: `/tmp/owner-tenants-${viewport.width}.png`, fullPage: true });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Umumiy holat" }).waitFor();
    await page.screenshot({ path: `/tmp/owner-overview-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Monitoringga ulash" }).click();
    await page.getByRole("dialog").getByLabel("Loyiha nomi").fill("Yangi filial");
    await page.getByRole("dialog").getByLabel("Loyiha kodi").fill("NEW_FOOD");
    await page.getByRole("dialog").getByLabel("Sayt manzili").fill("https://new.example");
    await page.getByRole("dialog").getByLabel("API holat manzili").fill("https://api.new.example/health");
    await page.getByRole("dialog").getByRole("button", { name: "Saqlash" }).click();
    await page.getByText("qa-one-time-token").waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Tayyor" }).click();
    await page.goto(`${baseUrl}/activity`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Hodisalar", exact: true }).waitFor();
    await page.getByText("Sayt ishlamayapti").waitFor();
    await page.screenshot({ path: `/tmp/owner-activity-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Ochiq", exact: true }).click();
    await page.getByText("Sayt ishlamayapti").waitFor();
    await page.getByRole("button", { name: "Ko'rib chiqilgan" }).click();
    await page.getByText("API ishlamayapti").waitFor();
    await page.getByRole("button", { name: "Barchasi", exact: true }).click();
    await page.getByLabel("Restoran bo'yicha filter").selectOption("site-1");
    await page.getByText("Oshxona buyurtmani yangiladi").waitFor();
    assert.equal(await page.getByText("Sayt ishlamayapti").count(), 0);
    await page.goto(`${baseUrl}/audit`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Boshqaruv jurnali" }).waitFor();
    await page.getByText("Restoran monitoringga qo'shildi").waitFor();
    await page.locator(".audit-row").getByText("BestTeam egasi").waitFor();
    await page.getByPlaceholder("Amal yoki egasi bo'yicha qidirish").fill("owner@bestteam.uz");
    await page.locator(".audit-row").waitFor();
    assert.equal(await page.locator(".audit-row").count(), 1);
    await page.screenshot({ path: `/tmp/owner-audit-${viewport.width}.png`, fullPage: true });
    await page.goto(`${baseUrl}/reports`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Hisobotlar" }).waitFor();
    await page.getByRole("heading", { name: "Kundalik ko'rsatkichlar" }).waitFor();
    assert.equal(await page.locator(".report-day").count(), 14);
    await page.getByText("Ma'lumot eskirgan", { exact: true }).waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV yuklab olish" }).click();
    assert.match((await downloadPromise).suggestedFilename(), /bestteam-hisobot-14-kun\.csv/);
    await page.screenshot({ path: `/tmp/owner-reports-${viewport.width}.png`, fullPage: true });
    await page.goto(`${baseUrl}/diagnostics`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Texnik xatolar" }).waitFor();
    await page.getByText("Markaziy panelga ulanish uzildi").waitFor();
    await page.getByText("Mazetto Food · Markaziy aloqa").waitFor();
    await page.getByPlaceholder("Xato kodi, restoran yoki xizmat bo'yicha qidirish").fill("CONTROL_PLANE_UNREACHABLE");
    await page.getByText("CONTROL_PLANE_UNREACHABLE", { exact: true }).waitFor();
    await page.getByLabel("Xizmat bo'yicha filtr").selectOption("backend");
    await page.getByText("Filtrlarga mos diagnostika topilmadi.", { exact: true }).waitFor();
    await page.getByLabel("Xizmat bo'yicha filtr").selectOption("control_plane");
    await page.getByText("1 / 1 ta yozuv", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Filtrlarni tozalash" }).click();
    assert.equal(await page.getByPlaceholder("Xato kodi, restoran yoki xizmat bo'yicha qidirish").inputValue(), "");
    await page.getByRole("button", { name: "Diagnostikani qayta yuklash" }).click();
    await page.getByText("1 / 1 ta yozuv", { exact: true }).waitFor();
    await page.screenshot({ path: `/tmp/owner-diagnostics-${viewport.width}.png`, fullPage: true });
    await page.goto(`${baseUrl}/restaurants`, { waitUntil: "domcontentloaded" });
    assert.equal((await page.locator("tbody tr").nth(1).locator("td").nth(5).textContent())?.trim(), "—");
    await page.getByPlaceholder("Nomi yoki loyiha bo'yicha qidirish").fill("Mazetto");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.screenshot({ path: `/tmp/owner-restaurants-${viewport.width}.png`, fullPage: true });
    await page.goto(`${baseUrl}/restaurants/site-1`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Oshxonalar" }).waitFor();
    await page.getByText("Markaziy oshxona").first().waitFor();
    await page.getByText("Arxiv tekshirildi").waitFor();
    await page.getByText("Tiklash sinovi hali o'tkazilmagan").waitFor();
    await page.screenshot({ path: `/tmp/owner-detail-${viewport.width}.png`, fullPage: true });
    await page.goto(`${baseUrl}/restaurants/site-2`, { waitUntil: "domcontentloaded" });
    await page.getByText("Agentdan yangi ma'lumot kelmayapti.", { exact: false }).waitFor();
    await page.getByText("Oxirgi holat noma'lum").first().waitFor();
    const detailOverflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, ancestors: (() => { const result = []; let element = document.querySelector("table"); while (element) { const rect = element.getBoundingClientRect(); result.push({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), overflowX: getComputedStyle(element).overflowX }); element = element.parentElement; } return result; })(), offenders: [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: Math.round(element.getBoundingClientRect().right), text: element.textContent?.trim().slice(0, 40) })) }));
    assert.equal(detailOverflow.width > viewport.width + 1, false, `Offline detail overflow at ${viewport.width}px: ${JSON.stringify(detailOverflow)}`);
    await page.goto(`${baseUrl}/restaurants/site-1`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Sozlamalar" }).click();
    await page.getByRole("dialog").getByLabel("Loyiha nomi").fill("Mazetto Food Updated");
    await page.getByRole("dialog").getByRole("button", { name: "Saqlash" }).click();
    await page.getByRole("heading", { name: "Mazetto Food Updated" }).waitFor();
    await page.locator(".settings-section").getByRole("button", { name: "Yangilash" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tasdiqlash" }).click();
    await page.getByText("qa-rotated-token").waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Tayyor" }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, `Horizontal page overflow at ${viewport.width}px`);
    assert.deepEqual(errors, [], `Browser errors at ${viewport.width}px`);
    await page.close();
  }
  const guest = await browser.newPage();
  await guest.route("**/api/v1/auth/refresh", route => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Unauthorized" } }) }));
  await guest.goto(baseUrl);
  await guest.waitForURL("**/login");
  await guest.route("**/api/v1/auth/login", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope({ user: { id: "staff-1", roles: ["ADMIN"], permissions: ["*"] }, tokens: { accessToken: "staff", tokenType: "Bearer" } })) }));
  await guest.getByLabel("Login yoki telefon").fill("staff");
  await guest.getByLabel("Parol").fill("test-password");
  await guest.getByRole("button", { name: "Kirish" }).click();
  await guest.getByRole("alert").getByText("Bu panelga faqat BestTeam egasi kira oladi.").waitFor();
  assert.equal(await guest.evaluate(() => sessionStorage.getItem("bestteam.owner.session")), null);
  await guest.close();
  console.log("Owner console QA passed at 1600, 768 and 360px.");
} finally { await browser.close(); }
