import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const snapshot = {
  status: "ok",
  checkedAt: "2026-09-14T10:00:00.000Z",
  database: { status: "ok" },
  redis: { status: "ready" },
  backup: {
    status: "verified",
    verifiedAt: "2026-09-14T09:00:00.000Z",
    archiveName: "mazetto-20260914-090000000.dump",
    bytes: 250000,
    archiveEntries: 147,
    verification: "pg_restore_list",
    restoreTested: false,
  },
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 768, height: 900 },
    { width: 360, height: 780 },
    { width: 320, height: 700 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      localStorage.setItem(
        "mazetto.auth.session",
        JSON.stringify({
          user: {
            id: "qa-admin",
            roles: ["SUPER_ADMIN"],
            permissions: ["*"],
            isGlobalScope: true,
          },
          tokens: {
            accessToken: "qa",
            refreshToken: "qa",
            tokenType: "Bearer",
          },
        }),
      );
    });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: snapshot }),
      }),
    );

    await page.goto(`${baseUrl}/admin/system-health`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("heading", { level: 1, name: "Tizim holati" })
      .waitFor();
    await page.getByText("mazetto-20260914-090000000.dump").waitFor();
    await page.getByText("Tiklash sinovi").waitFor();
    assert.ok(await page.getByText("Bajarilmagan").isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${viewport.width}px da gorizontal overflow bor`,
    );
    console.log(`admin system health ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
