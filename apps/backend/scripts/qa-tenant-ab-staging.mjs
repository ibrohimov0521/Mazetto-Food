import assert from "node:assert/strict";
import http from "node:http";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { Pool } from "pg";
import { URL, pathToFileURL } from "node:url";
import * as Minio from "minio";

const EXPECTED_DATABASE_HOST = "postgres-input-wireless-sensor-gioz9i";
const { AbortSignal } = globalThis;

const EXPECTED_DATABASE_NAME = "mazetto_staging";
const EXPECTED_MEDIA_HOST = "mazetto-staging-minio";
const EXPECTED_MEDIA_BUCKET = "mazetto-staging";
const API_BASE = "http://127.0.0.1:4000/api/v1";
const DELIVERY_SETTING = "customer_delivery_fee";
const SHARED_PHONE = "+998901234567";
const CODE_A = "135791";
const CODE_B = "246802";

let socketIoClientPromise;

async function connectStaffSocket(host, token, tokenType = "staff") {
  if (!socketIoClientPromise) {
    const store = "/app/node_modules/.pnpm";
    const packageDirectory = readdirSync(store).find((entry) =>
      entry.startsWith("socket.io-client@"),
    );
    assert.ok(
      packageDirectory,
      "Staging Socket.IO client package is required.",
    );
    const modulePath = join(
      store,
      packageDirectory,
      "node_modules/socket.io-client/build/esm/index.js",
    );
    socketIoClientPromise = import(pathToFileURL(modulePath).href);
  }

  const { io } = await socketIoClientPromise;
  const agent = new http.Agent({
    lookup(_hostname, options, callback) {
      if (options?.all) {
        callback(null, [{ address: "127.0.0.1", family: 4 }]);
      } else {
        callback(null, "127.0.0.1", 4);
      }
    },
  });
  const socket = io("http://" + host + ":4000", {
    auth: { token, tokenType },
    transports: ["websocket"],
    transportOptions: { websocket: { agent } },
    reconnection: false,
    timeout: 8000,
  });

  return new Promise((resolve) => {
    let settled = false;
    let settleTimer;
    let detail = "connect timeout";
    const timer = globalThis.setTimeout(() => finish(false), 9000);
    const finish = (connected) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      if (settleTimer) globalThis.clearTimeout(settleTimer);
      if (!connected) {
        socket.disconnect();
        agent.destroy();
      }
      resolve({
        connected,
        detail,
        socket,
        close: () => {
          socket.disconnect();
          agent.destroy();
        },
      });
    };
    socket.once("connect", () => {
      settleTimer = globalThis.setTimeout(() => finish(socket.connected), 150);
    });
    socket.once("connect_error", (error) => {
      detail = error?.message ?? "connect_error";
      finish(false);
    });
    socket.once("disconnect", (reason) => {
      detail = reason ?? "disconnected";
      finish(false);
    });
  });
}

function waitForSocketDisconnect(socket, timeoutMs = 5000) {
  if (!socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      socket.off("disconnect", onDisconnect);
      resolve(false);
    }, timeoutMs);
    const onDisconnect = () => {
      globalThis.clearTimeout(timer);
      resolve(true);
    };
    socket.once("disconnect", onDisconnect);
  });
}

async function waitUntil(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
  }
  assert.ok(predicate(), message);
}

function requireStagingTarget() {
  assert.equal(
    process.env.MAZETTO_STAGING_AB_QA,
    "1",
    "Set the explicit staging QA opt-in flag.",
  );
  assert.equal(
    process.env.NODE_ENV,
    "production",
    "Run this check only inside the deployed staging API container.",
  );
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(
    databaseUrl.hostname,
    EXPECTED_DATABASE_HOST,
    "Refusing an unknown database host.",
  );
  assert.equal(
    decodeURIComponent(databaseUrl.pathname.slice(1)),
    EXPECTED_DATABASE_NAME,
    "Refusing an unknown database.",
  );
  assert.equal(
    API_BASE,
    "http://127.0.0.1:4000/api/v1",
    "Keep the API target inside this container.",
  );
  return databaseUrl;
}

function requireStagingMedia() {
  assert.equal(
    process.env.MINIO_ENDPOINT,
    EXPECTED_MEDIA_HOST,
    "Refusing a non-staging media endpoint.",
  );
  assert.equal(
    process.env.MINIO_BUCKET,
    EXPECTED_MEDIA_BUCKET,
    "Refusing a non-staging media bucket.",
  );
  const accessKey = process.env.MINIO_ROOT_USER;
  const secretKey = process.env.MINIO_ROOT_PASSWORD;
  assert.ok(accessKey && secretKey, "Staging media credentials are required.");
  return new Minio.Client({
    endPoint: EXPECTED_MEDIA_HOST,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL?.trim().toLowerCase() === "true",
    accessKey,
    secretKey,
  });
}

async function request(
  path,
  { host, method = "GET", body, headers = {} } = {},
) {
  const url = new URL(path.replace(/^\/+/, ""), API_BASE + "/");
  const requestHeaders = { ...headers };
  const payload =
    body === undefined
      ? undefined
      : Buffer.isBuffer(body)
        ? body
        : JSON.stringify(body);
  if (body !== undefined && !Buffer.isBuffer(body)) {
    requestHeaders["Content-Type"] = "application/json";
  }
  if (Buffer.isBuffer(payload) && !requestHeaders["Content-Length"]) {
    requestHeaders["Content-Length"] = String(payload.length);
  }

  if (!host) {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: payload,
      signal: AbortSignal.timeout(8000),
    });
    return { status: response.status, body: await response.json() };
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method, headers: { ...requestHeaders, host } },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          } catch {
            reject(new Error("The staging API returned a non-JSON response."));
          }
        });
      },
    );
    req.setTimeout(8000, () =>
      req.destroy(new Error("The staging API request timed out.")),
    );
    req.on("error", reject);
    req.end(payload);
  });
}

async function main() {
  const databaseUrl = requireStagingTarget();
  const mediaClient = requireStagingMedia();
  const suffix = randomBytes(5).toString("hex");
  const tenantAHost = `qa-a-${suffix}.invalid`;
  const tenantBHost = `qa-b-${suffix}.invalid`;
  const pendingHost = `qa-pending-${suffix}.invalid`;
  const email = "qa-ab-" + suffix + "@bestteam.invalid";
  const socketEmailA = "qa-socket-" + suffix + "-a@bestteam.invalid";
  const socketEmailB = "qa-socket-" + suffix + "-b@bestteam.invalid";
  const password = randomBytes(24).toString("base64url");
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const fixture = {
    tenantAId: null,
    tenantBId: null,
    branchIds: [],
    deviceIds: [],
    auditLogIds: [],
    auditBaselineCount: null,
    domainIds: [],
    userIds: [],
    employeeIds: [],
    roleId: null,
    socketRoleId: null,
    permissionId: null,
    auditPermissionId: null,
    reportPermissionId: null,
    membershipIds: [],
    mediaObjects: [],
    uploadPermissionId: null,
    outboxEventIds: [],
    orderIds: [],
    realtimePermissionId: null,
    orderCreatePermissionId: null,
    tenantAOnlyRoleId: null,
    tenantAOnlyPermissionId: null,
    socketClients: [],
  };
  let cleanupFailure = null;
  let guardPassed = false;
  let failure = null;

  try {
    const tenantA = await prisma.restaurantTenant.findUnique({
      where: { code: "MAZETTO_FOOD" },
    });
    assert.ok(
      tenantA && tenantA.status === "ACTIVE",
      "The staging baseline tenant must exist and be active.",
    );
    fixture.tenantAId = tenantA.id;

    const [
      tenantCount,
      branchCount,
      deviceCount,
      userCount,
      employeeCount,
      membershipCount,
      domainCount,
      customerCount,
      challengeCount,
      settingCount,
      roleCount,
      permissionCount,
      orderCount,
      orderEventCount,
      outboxEventCount,
    ] = await Promise.all([
      prisma.restaurantTenant.count(),
      prisma.branch.count(),
      prisma.device.count(),
      prisma.user.count(),
      prisma.employee.count(),
      prisma.tenantMembership.count(),
      prisma.tenantDomain.count(),
      prisma.customer.count(),
      prisma.customerVerificationChallenge.count(),
      prisma.setting.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.order.count(),
      prisma.orderEvent.count(),
      prisma.outboxEvent.count(),
    ]);
    assert.deepEqual(
      {
        tenantCount,
        branchCount,
        deviceCount,
        userCount,
        employeeCount,
        membershipCount,
        domainCount,
        customerCount,
        challengeCount,
        settingCount,
        roleCount,
        permissionCount,
        orderCount,
        orderEventCount,
        outboxEventCount,
      },
      {
        tenantCount: 1,
        branchCount: 0,
        deviceCount: 0,
        userCount: 0,
        employeeCount: 0,
        membershipCount: 0,
        domainCount: 0,
        customerCount: 0,
        challengeCount: 0,
        settingCount: 0,
        roleCount: 0,
        permissionCount: 0,
        orderCount: 0,
        orderEventCount: 0,
        outboxEventCount: 0,
      },
      "Staging must be an empty baseline before the disposable A/B fixture is created.",
    );
    fixture.auditBaselineCount = await prisma.auditLog.count();
    guardPassed = true;

    const tenantB = await prisma.restaurantTenant.create({
      data: {
        code: `QA_AB_${suffix}`,
        name: "Disposable staging tenant B",
        status: "PROVISIONING",
      },
    });
    fixture.tenantBId = tenantB.id;
    const branchA = await prisma.branch.create({
      data: {
        code: `QA_A_${suffix}`,
        tenantId: tenantA.id,
        name: "Disposable staging A",
        isActive: true,
      },
    });
    fixture.branchIds.push(branchA.id);
    const branchB = await prisma.branch.create({
      data: {
        code: `QA_B_${suffix}`,
        tenantId: tenantB.id,
        name: "Disposable staging B",
        isActive: false,
      },
    });
    fixture.branchIds.push(branchB.id);

    for (const [hostname, tenantId, status] of [
      [tenantAHost, tenantA.id, "VERIFIED"],
      [tenantBHost, tenantB.id, "VERIFIED"],
      [pendingHost, tenantA.id, "PENDING"],
    ]) {
      const domain = await prisma.tenantDomain.create({
        data: {
          hostname,
          tenantId,
          status,
          verifiedAt: status === "VERIFIED" ? new Date() : null,
        },
      });
      fixture.domainIds.push(domain.id);
    }

    const role = await prisma.role.create({
      data: {
        code: "SUPER_ADMIN",
        name: "Disposable staging owner",
        isSystem: false,
        isActive: true,
      },
    });
    fixture.roleId = role.id;
    const permission = await prisma.permission.create({
      data: {
        code: "SETTING_MANAGE",
        name: "Disposable staging setting access",
      },
    });
    fixture.permissionId = permission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
    const auditPermission = await prisma.permission.create({
      data: { code: "AUDIT_VIEW", name: "Disposable staging audit access" },
    });
    fixture.auditPermissionId = auditPermission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: auditPermission.id },
    });
    const reportPermission = await prisma.permission.create({
      data: {
        code: "REPORT_SALES_VIEW",
        name: "Disposable staging sales report access",
      },
    });
    fixture.reportPermissionId = reportPermission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: reportPermission.id },
    });
    const uploadPermission = await prisma.permission.create({
      data: { code: "MENU_EDIT", name: "Disposable staging media upload" },
    });
    fixture.uploadPermissionId = uploadPermission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: uploadPermission.id },
    });
    const realtimePermission = await prisma.permission.create({
      data: { code: "ORDER_VIEW", name: "Disposable staging realtime view" },
    });
    fixture.realtimePermissionId = realtimePermission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: realtimePermission.id },
    });
    const orderCreatePermission = await prisma.permission.create({
      data: { code: "ORDER_CREATE", name: "Disposable order creation" },
    });
    fixture.orderCreatePermissionId = orderCreatePermission.id;
    const tenantAOnlyPermission = await prisma.permission.create({
      data: { code: `QA_TENANT_A_ONLY_${suffix}`, name: "Disposable tenant A role marker" },
    });
    fixture.tenantAOnlyPermissionId = tenantAOnlyPermission.id;
    const tenantAOnlyRole = await prisma.role.create({
      data: {
        code: `QA_TENANT_A_ONLY_${suffix}`,
        name: "Disposable tenant A membership marker",
        isSystem: false,
        isActive: true,
      },
    });
    fixture.tenantAOnlyRoleId = tenantAOnlyRole.id;
    await prisma.rolePermission.create({
      data: { roleId: tenantAOnlyRole.id, permissionId: tenantAOnlyPermission.id },
    });

    const owner = await prisma.user.create({
      data: { email, passwordHash: await hash(password, 10), isActive: true },
    });
    fixture.userIds.push(owner.id);
    await prisma.userRole.create({
      data: { userId: owner.id, roleId: role.id },
    });

    for (const tenantId of [tenantA.id, tenantB.id]) {
      const membership = await prisma.tenantMembership.create({
        data: { tenantId, userId: owner.id, status: "ACTIVE" },
      });
      fixture.membershipIds.push(membership.id);
      await prisma.tenantMembershipRole.create({
        data: { membershipId: membership.id, roleId: role.id },
      });
      if (tenantId === tenantA.id) {
        await prisma.tenantMembershipRole.create({
          data: { membershipId: membership.id, roleId: tenantAOnlyRole.id },
        });
      }
    }

    const socketRole = await prisma.role.create({
      data: {
        code: "WAITER",
        name: "Disposable staging branch staff",
        isSystem: false,
        isActive: true,
        isBranchScoped: true,
      },
    });
    fixture.socketRoleId = socketRole.id;
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: realtimePermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: orderCreatePermission.id },
    });

    for (const staff of [
      {
        tenantId: tenantA.id,
        branchId: branchA.id,
        email: socketEmailA,
        suffix: "A",
      },
      {
        tenantId: tenantB.id,
        branchId: branchB.id,
        email: socketEmailB,
        suffix: "B",
      },
    ]) {
      const user = await prisma.user.create({
        data: {
          email: staff.email,
          passwordHash: await hash(password, 10),
          isActive: true,
        },
      });
      fixture.userIds.push(user.id);
      await prisma.userRole.create({
        data: { userId: user.id, roleId: socketRole.id },
      });
      const employee = await prisma.employee.create({
        data: {
          userId: user.id,
          branchId: staff.branchId,
          employeeCode: "QA-SOCKET-" + suffix + "-" + staff.suffix,
          firstName: "QA",
          lastName: "Socket " + staff.suffix,
          status: "ACTIVE",
        },
      });
      fixture.employeeIds.push(employee.id);
      const membership = await prisma.tenantMembership.create({
        data: {
          tenantId: staff.tenantId,
          userId: user.id,
          branchId: staff.branchId,
          status: "ACTIVE",
        },
      });
      fixture.membershipIds.push(membership.id);
      await prisma.tenantMembershipRole.create({
        data: { membershipId: membership.id, roleId: socketRole.id },
      });
    }

    await prisma.setting.createMany({
      data: [
        {
          tenantId: tenantA.id,
          key: DELIVERY_SETTING,
          value: "1100",
          isPublic: true,
        },
        {
          tenantId: tenantB.id,
          key: DELIVERY_SETTING,
          value: "2200",
          isPublic: true,
        },
      ],
    });
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await prisma.customerVerificationChallenge.createMany({
      data: [
        {
          tenantId: tenantA.id,
          phone: SHARED_PHONE,
          codeHash: await hash(CODE_A, 4),
          expiresAt,
        },
        {
          tenantId: tenantB.id,
          phone: SHARED_PHONE,
          codeHash: await hash(CODE_B, 4),
          expiresAt,
        },
      ],
    });

    await prisma.restaurantTenant.update({
      where: { id: tenantB.id },
      data: { status: "ACTIVE" },
    });
    await prisma.branch.update({
      where: { id: branchB.id },
      data: { isActive: true },
    });

    const deviceCodeA = randomBytes(6).toString("hex").toUpperCase();
    const deviceCodeB = randomBytes(6).toString("hex").toUpperCase();
    const enrollmentExpiresAt = new Date(Date.now() + 15 * 60_000);
    const deviceA = await prisma.device.create({
      data: {
        branchId: branchA.id,
        name: "Disposable staging POS A",
        type: "POS_TERMINAL",
        enrollmentCodeHash: createHash("sha256").update(deviceCodeA).digest("hex"),
        enrollmentExpiresAt,
      },
    });
    fixture.deviceIds.push(deviceA.id);
    const deviceB = await prisma.device.create({
      data: {
        branchId: branchB.id,
        name: "Disposable staging POS B",
        type: "POS_TERMINAL",
        enrollmentCodeHash: createHash("sha256").update(deviceCodeB).digest("hex"),
        enrollmentExpiresAt,
      },
    });
    fixture.deviceIds.push(deviceB.id);

    const health = await request("/health");
    assert.equal(
      health.status,
      200,
      "The staging API must be healthy before A/B checks.",
    );

    const enroll = (host, deviceId, enrollmentCode) =>
      request("/devices/enroll", {
        host,
        method: "POST",
        body: { deviceId, enrollmentCode, softwareVersion: "staging-qa" },
      });
    assert.equal(
      (await enroll(tenantAHost, "qa-hardware-a-" + suffix, deviceCodeB)).status,
      400,
      "Tenant A must not claim tenant B enrollment code.",
    );
    assert.equal(
      (await enroll(tenantBHost, "qa-hardware-b-" + suffix, deviceCodeA)).status,
      400,
      "Tenant B must not claim tenant A enrollment code.",
    );
    assert.equal(
      (await enroll(pendingHost, "qa-hardware-p-" + suffix, deviceCodeB)).status,
      403,
      "Pending domain must not enroll a device.",
    );
    assert.equal(
      (await enroll("unknown-" + suffix + ".invalid", "qa-hardware-u-" + suffix, deviceCodeB)).status,
      403,
      "Unknown domain must not enroll a device.",
    );
    const enrolledA = await enroll(tenantAHost, "qa-hardware-a-" + suffix, deviceCodeA);
    const enrolledB = await enroll(tenantBHost, "qa-hardware-b-" + suffix, deviceCodeB);
    assert.equal(enrolledA.status, 201);
    assert.equal(enrolledB.status, 201);
    assert.equal(
      (await enroll(tenantAHost, "qa-hardware-a-" + suffix, deviceCodeA)).status,
      400,
      "Enrollment code must be consumed after one successful claim.",
    );
    const enrolledDeviceRows = await prisma.device.findMany({
      where: { id: { in: [deviceA.id, deviceB.id] } },
      select: { id: true, branchId: true, hardwareId: true, enrolledAt: true, deviceAuthTokenHash: true, enrollmentCodeHash: true },
    });
    const enrolledById = new Map(enrolledDeviceRows.map((device) => [device.id, device]));
    assert.equal(enrolledById.get(deviceA.id)?.branchId, branchA.id);
    assert.equal(enrolledById.get(deviceA.id)?.hardwareId, "qa-hardware-a-" + suffix);
    assert.ok(enrolledById.get(deviceA.id)?.enrolledAt);
    assert.ok(enrolledById.get(deviceA.id)?.deviceAuthTokenHash);
    assert.equal(enrolledById.get(deviceA.id)?.enrollmentCodeHash, null);
    assert.equal(enrolledById.get(deviceB.id)?.branchId, branchB.id);
    assert.equal(enrolledById.get(deviceB.id)?.hardwareId, "qa-hardware-b-" + suffix);
    assert.ok(enrolledById.get(deviceB.id)?.enrolledAt);
    assert.ok(enrolledById.get(deviceB.id)?.deviceAuthTokenHash);
    assert.equal(enrolledById.get(deviceB.id)?.enrollmentCodeHash, null);

    const unknownHost = await request("/customer/branches", {
      host: `unknown-${suffix}.invalid`,
    });
    assert.equal(
      unknownHost.status,
      403,
      "Unknown tenant hosts must fail closed.",
    );
    const pendingDomain = await request("/customer/branches", {
      host: pendingHost,
    });
    assert.equal(
      pendingDomain.status,
      403,
      "Unverified domains must not resolve a tenant.",
    );

    const branchesA = await request("/customer/branches", {
      host: tenantAHost,
    });
    const branchesB = await request("/customer/branches", {
      host: tenantBHost,
    });
    assert.equal(branchesA.status, 200);
    assert.equal(branchesB.status, 200);
    assert.deepEqual(
      branchesA.body.data.map((branch) => branch.id),
      [branchA.id],
    );
    assert.deepEqual(
      branchesB.body.data.map((branch) => branch.id),
      [branchB.id],
    );

    const publicSettingsA = await request("/settings/public", {
      host: tenantAHost,
    });
    const publicSettingsB = await request("/settings/public", {
      host: tenantBHost,
    });
    assert.equal(publicSettingsA.status, 200);
    assert.equal(publicSettingsB.status, 200);
    assert.equal(publicSettingsA.body.data.customerDeliveryFee, 1100);
    assert.equal(publicSettingsB.body.data.customerDeliveryFee, 2200);

    const login = async (host, identifier = email) =>
      request("/auth/login", {
        host,
        method: "POST",
        body: { identifier, password },
      });
    const unknownLogin = await login(`unknown-${suffix}.invalid`);
    assert.equal(
      unknownLogin.status,
      403,
      "Restaurant login must be denied on an unknown host.",
    );
    const loginA = await login(tenantAHost);
    const loginB = await login(tenantBHost);
    assert.equal(loginA.status, 201);
    assert.equal(loginB.status, 201);
    assert.equal(loginA.body.data.user.tenantId, tenantA.id);
    assert.equal(loginB.body.data.user.tenantId, tenantB.id);
    assert.equal(loginA.body.data.user.id, loginB.body.data.user.id);
    assert.ok(loginA.body.data.user.roles.includes(tenantAOnlyRole.code));
    assert.ok(!loginB.body.data.user.roles.includes(tenantAOnlyRole.code));
    const authMeA = await request("/auth/me", {
      host: tenantAHost,
      headers: { Authorization: "Bearer " + loginA.body.data.tokens.accessToken },
    });
    const authMeB = await request("/auth/me", {
      host: tenantBHost,
      headers: { Authorization: "Bearer " + loginB.body.data.tokens.accessToken },
    });
    assert.equal(authMeA.status, 200);
    assert.equal(authMeB.status, 200);
    assert.ok(authMeA.body.data.roles.includes(tenantAOnlyRole.code));
    assert.ok(!authMeB.body.data.roles.includes(tenantAOnlyRole.code));
    const auditMarkerA = "QA_AUDIT_A_" + suffix;
    const auditMarkerB = "QA_AUDIT_B_" + suffix;
    const auditFixtureA = await prisma.auditLog.create({
      data: {
        tenantId: tenantA.id,
        userId: owner.id,
        action: auditMarkerA,
        entity: "QA_AUDIT",
        entityId: "qa-audit-a-" + suffix,
      },
    });
    const auditFixtureB = await prisma.auditLog.create({
      data: {
        tenantId: tenantB.id,
        userId: owner.id,
        action: auditMarkerB,
        entity: "QA_AUDIT",
        entityId: "qa-audit-b-" + suffix,
      },
    });
    fixture.auditLogIds.push(auditFixtureA.id, auditFixtureB.id);
    const auditA = await request("/audit-logs?limit=100", {
      host: tenantAHost,
      headers: {
        Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
      },
    });
    const auditB = await request("/audit-logs?limit=100", {
      host: tenantBHost,
      headers: {
        Authorization: "Bearer " + loginB.body.data.tokens.accessToken,
      },
    });
    assert.equal(auditA.status, 200);
    assert.equal(auditB.status, 200);
    assert.ok(auditA.body.data.some((row) => row.action === auditMarkerA));
    assert.ok(!auditA.body.data.some((row) => row.action === auditMarkerB));
    assert.ok(auditB.body.data.some((row) => row.action === auditMarkerB));
    assert.ok(!auditB.body.data.some((row) => row.action === auditMarkerA));
    const facetsA = await request("/audit-logs/facets", {
      host: tenantAHost,
      headers: {
        Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
      },
    });
    assert.equal(facetsA.status, 200);
    assert.ok(facetsA.body.data.actions.includes(auditMarkerA));
    assert.ok(!facetsA.body.data.actions.includes(auditMarkerB));
    const reportA = await request("/reports/sales?preset=today", {
      host: tenantAHost,
      headers: {
        Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
      },
    });
    const reportB = await request("/reports/sales?preset=today", {
      host: tenantBHost,
      headers: {
        Authorization: "Bearer " + loginB.body.data.tokens.accessToken,
      },
    });
    assert.equal(reportA.status, 200);
    assert.equal(reportB.status, 200);
    const foreignBranchReport = await request(
      "/reports/sales?preset=today&branchId=" + encodeURIComponent(branchB.id),
      {
        host: tenantAHost,
        headers: {
          Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
        },
      },
    );
    assert.equal(foreignBranchReport.status, 404);
    const socketLoginA = await login(tenantAHost, socketEmailA);
    const socketLoginB = await login(tenantBHost, socketEmailB);
    assert.equal(socketLoginA.status, 201);
    assert.equal(socketLoginB.status, 201);

    const crossStaffRead = await request("/auth/me", {
      host: tenantBHost,
      headers: {
        Authorization: `Bearer ${loginA.body.data.tokens.accessToken}`,
      },
    });
    assert.equal(
      crossStaffRead.status,
      403,
      "Staff access tokens must not cross tenant hosts.",
    );
    const crossStaffWrite = await request(`/settings/${DELIVERY_SETTING}`, {
      host: tenantBHost,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginA.body.data.tokens.accessToken}`,
      },
      body: { value: "2600" },
    });
    assert.ok(
      [401, 403].includes(crossStaffWrite.status),
      "Tenant A must not mutate tenant B settings.",
    );

    const realtimeEventA = await prisma.outboxEvent.create({
      data: {
        branchId: branchA.id,
        aggregateType: "qa_fixture",
        aggregateId: "qa-ab-" + suffix + "-a",
        eventType: "qa.tenant.scope",
        payload: { marker: "tenant-a-" + suffix },
        correlationId: "qa-ab-" + suffix + "-a",
      },
    });
    fixture.outboxEventIds.push(realtimeEventA.id);
    const realtimeEventB = await prisma.outboxEvent.create({
      data: {
        branchId: branchB.id,
        aggregateType: "qa_fixture",
        aggregateId: "qa-ab-" + suffix + "-b",
        eventType: "qa.tenant.scope",
        payload: { marker: "tenant-b-" + suffix },
        correlationId: "qa-ab-" + suffix + "-b",
      },
    });
    fixture.outboxEventIds.push(realtimeEventB.id);

    const realtimeEvents = (host, token, query = "") =>
      request("/realtime/events" + query, {
        host,
        headers: { Authorization: "Bearer " + token },
      });
    const realtimeA = await realtimeEvents(
      tenantAHost,
      loginA.body.data.tokens.accessToken,
      "?limit=50",
    );
    const realtimeB = await realtimeEvents(
      tenantBHost,
      loginB.body.data.tokens.accessToken,
      "?limit=50",
    );
    assert.equal(realtimeA.status, 200);
    assert.equal(realtimeB.status, 200);
    assert.deepEqual(
      realtimeA.body.data.events.map((event) => event.id),
      [realtimeEventA.id],
      "Tenant A realtime catch-up must exclude tenant B events.",
    );
    assert.deepEqual(
      realtimeB.body.data.events.map((event) => event.id),
      [realtimeEventB.id],
      "Tenant B realtime catch-up must exclude tenant A events.",
    );
    const foreignBranchEvents = await realtimeEvents(
      tenantAHost,
      loginA.body.data.tokens.accessToken,
      "?branchId=" + encodeURIComponent(branchB.id),
    );
    assert.ok(
      [403, 404].includes(foreignBranchEvents.status),
      "Tenant A must not request tenant B realtime branch events.",
    );
    const afterCursor = await realtimeEvents(
      tenantAHost,
      loginA.body.data.tokens.accessToken,
      "?cursor=" + encodeURIComponent(realtimeA.body.data.cursor),
    );
    assert.equal(afterCursor.status, 200);
    assert.deepEqual(afterCursor.body.data.events, []);

    const socketA = await connectStaffSocket(
      tenantAHost,
      socketLoginA.body.data.tokens.accessToken,
    );
    const socketB = await connectStaffSocket(
      tenantBHost,
      socketLoginB.body.data.tokens.accessToken,
    );
    assert.equal(
      socketA.connected,
      true,
      "Tenant A staff WebSocket must connect: " + socketA.detail,
    );
    assert.equal(
      socketB.connected,
      true,
      "Tenant B staff WebSocket must connect: " + socketB.detail,
    );
    fixture.socketClients.push(socketA.socket, socketB.socket);

    const receivedA = [];
    const receivedB = [];
    socketA.socket.on("order.created", (event) => receivedA.push(event));
    socketB.socket.on("order.created", (event) => receivedB.push(event));
    const orderAName = "Realtime QA A " + suffix;
    const orderA = await request("/orders", {
      host: tenantAHost,
      method: "POST",
      headers: { Authorization: "Bearer " + socketLoginA.body.data.tokens.accessToken },
      body: { branchId: branchA.id, type: "TAKEAWAY", customerName: orderAName },
    });
    const createdOrderA = await prisma.order.findFirst({
      where: { branchId: branchA.id, customerName: orderAName },
      select: { id: true },
    });
    const orderAId = createdOrderA?.id ?? orderA.body.data?.id ?? orderA.body.data?.order?.id;
    if (typeof orderAId === "string") fixture.orderIds.push(orderAId);
    assert.equal(orderA.status, 201);
    assert.equal(typeof orderAId, "string");
    const orderBName = "Realtime QA B " + suffix;
    const orderB = await request("/orders", {
      host: tenantBHost,
      method: "POST",
      headers: { Authorization: "Bearer " + socketLoginB.body.data.tokens.accessToken },
      body: { branchId: branchB.id, type: "TAKEAWAY", customerName: orderBName },
    });
    const createdOrderB = await prisma.order.findFirst({
      where: { branchId: branchB.id, customerName: orderBName },
      select: { id: true },
    });
    const orderBId = createdOrderB?.id ?? orderB.body.data?.id ?? orderB.body.data?.order?.id;
    if (typeof orderBId === "string") fixture.orderIds.push(orderBId);
    assert.equal(orderB.status, 201);
    assert.equal(typeof orderBId, "string");
    await waitUntil(
      () => receivedA.some((event) => event.orderId === orderAId) &&
        receivedB.some((event) => event.orderId === orderBId),
      5000,
      "Each tenant staff socket must receive its own live order event.",
    );
    assert.deepEqual(receivedA.map((event) => event.orderId), [orderAId]);
    assert.deepEqual(receivedB.map((event) => event.orderId), [orderBId]);

    socketA.close();
    const reconnectedA = await connectStaffSocket(
      tenantAHost, socketLoginA.body.data.tokens.accessToken,
    );
    assert.equal(reconnectedA.connected, true);
    fixture.socketClients.push(reconnectedA.socket);
    const replayedA = await realtimeEvents(
      tenantAHost,
      socketLoginA.body.data.tokens.accessToken,
      "?cursor=" + encodeURIComponent(realtimeA.body.data.cursor) + "&limit=50",
    );
    assert.equal(replayedA.status, 200);
    assert.deepEqual(replayedA.body.data.events.map((event) => event.aggregateId), [orderAId]);

    const tenantATokenOnBHost = await connectStaffSocket(
      tenantBHost,
      socketLoginA.body.data.tokens.accessToken,
    );
    const tenantBTokenOnAHost = await connectStaffSocket(
      tenantAHost,
      socketLoginB.body.data.tokens.accessToken,
    );
    const tenantTokenOnUnknownHost = await connectStaffSocket(
      "qa-unknown-" + suffix + ".invalid",
      socketLoginA.body.data.tokens.accessToken,
    );
    assert.equal(
      tenantATokenOnBHost.connected,
      false,
      "Tenant A staff WebSocket must be rejected on tenant B's host.",
    );
    assert.equal(
      tenantBTokenOnAHost.connected,
      false,
      "Tenant B staff WebSocket must be rejected on tenant A's host.",
    );
    assert.equal(
      tenantTokenOnUnknownHost.connected,
      false,
      "Tenant staff WebSocket must be rejected on an unknown host.",
    );

    const boundary = "----MazettoStagingQA" + suffix;
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64",
    );
    const multipartBody = Buffer.concat([
      Buffer.from(
        "--" +
          boundary +
          "\r\n" +
          'Content-Disposition: form-data; name="file"; filename="qa.png"\r\n' +
          "Content-Type: image/png\r\n\r\n",
      ),
      imageBytes,
      Buffer.from("\r\n--" + boundary + "--\r\n"),
    ]);
    const uploadImage = (host, token) =>
      request("/uploads/image?folder=products", {
        host,
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "multipart/form-data; boundary=" + boundary,
          "Content-Length": String(multipartBody.length),
        },
        body: multipartBody,
      });
    const crossUpload = await uploadImage(
      tenantAHost,
      loginB.body.data.tokens.accessToken,
    );
    assert.ok(
      [401, 403].includes(crossUpload.status),
      "Tenant B staff token must not upload through tenant A host.",
    );
    const uploadA = await uploadImage(
      tenantAHost,
      loginA.body.data.tokens.accessToken,
    );
    assert.equal(uploadA.status, 201, "Tenant A image upload should succeed.");
    const mediaObjectA = uploadA.body.data.objectName;
    fixture.mediaObjects.push({
      tenantId: tenantA.id,
      objectName: mediaObjectA,
    });
    const uploadB = await uploadImage(
      tenantBHost,
      loginB.body.data.tokens.accessToken,
    );
    assert.equal(uploadB.status, 201, "Tenant B image upload should succeed.");
    const mediaObjectB = uploadB.body.data.objectName;
    fixture.mediaObjects.push({
      tenantId: tenantB.id,
      objectName: mediaObjectB,
    });
    assert.ok(
      mediaObjectA.startsWith("tenants/" + tenantA.id + "/products/"),
      "Tenant A upload must use the A storage prefix.",
    );
    assert.ok(
      mediaObjectB.startsWith("tenants/" + tenantB.id + "/products/"),
      "Tenant B upload must use the B storage prefix.",
    );
    assert.notEqual(mediaObjectA, mediaObjectB);
    await Promise.all([
      mediaClient.statObject(EXPECTED_MEDIA_BUCKET, mediaObjectA),
      mediaClient.statObject(EXPECTED_MEDIA_BUCKET, mediaObjectB),
    ]);

    const writeB = await request(`/settings/${DELIVERY_SETTING}`, {
      host: tenantBHost,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginB.body.data.tokens.accessToken}`,
      },
      body: { value: "2500" },
    });
    assert.equal(writeB.status, 200);
    const afterWriteA = await request("/settings/public", {
      host: tenantAHost,
    });
    const afterWriteB = await request("/settings/public", {
      host: tenantBHost,
    });
    assert.equal(afterWriteA.body.data.customerDeliveryFee, 1100);
    assert.equal(afterWriteB.body.data.customerDeliveryFee, 2500);

    const verify = (host, code, name) =>
      request("/customer/auth/verify-code", {
        host,
        method: "POST",
        body: { phone: SHARED_PHONE, code, name },
      });
    const crossOtp = await verify(tenantAHost, CODE_B, "Wrong tenant");
    assert.equal(
      crossOtp.status,
      401,
      "Tenant B OTP must not verify on tenant A.",
    );
    const customerA = await verify(tenantAHost, CODE_A, "Synthetic customer A");
    const customerB = await verify(tenantBHost, CODE_B, "Synthetic customer B");
    assert.equal(customerA.status, 201);
    assert.equal(customerB.status, 201);
    assert.equal(customerA.body.data.customer.tenantId, tenantA.id);
    assert.equal(customerB.body.data.customer.tenantId, tenantB.id);
    assert.notEqual(
      customerA.body.data.customer.id,
      customerB.body.data.customer.id,
    );

    const customerMe = (host, token) =>
      request("/customer/auth/me", {
        host,
        headers: { Authorization: `Bearer ${token}` },
      });
    assert.equal(
      (await customerMe(tenantBHost, customerA.body.data.tokens.accessToken))
        .status,
      401,
      "Tenant A customer sessions must not authenticate on tenant B.",
    );
    assert.equal(
      (await customerMe(tenantAHost, customerB.body.data.tokens.accessToken))
        .status,
      401,
      "Tenant B customer sessions must not authenticate on tenant A.",
    );

    const refresh = (host, token) =>
      request("/customer/auth/refresh", {
        host,
        method: "POST",
        body: { refreshToken: token },
      });
    assert.equal(
      (await refresh(tenantBHost, customerA.body.data.tokens.refreshToken))
        .status,
      401,
    );
    const refreshedB = await refresh(
      tenantBHost,
      customerB.body.data.tokens.refreshToken,
    );
    assert.equal(refreshedB.status, 201);
    assert.equal(refreshedB.body.data.customer.tenantId, tenantB.id);

    const customerSocketA = await connectStaffSocket(
      tenantAHost, customerA.body.data.tokens.accessToken, "customer",
    );
    const customerSocketB = await connectStaffSocket(
      tenantBHost, customerB.body.data.tokens.accessToken, "customer",
    );
    assert.equal(customerSocketA.connected, true);
    assert.equal(customerSocketB.connected, true);
    fixture.socketClients.push(customerSocketA.socket, customerSocketB.socket);
    const customerLogoutA = await request("/customer/auth/logout", {
      host: tenantAHost,
      method: "POST",
      body: { refreshToken: customerA.body.data.tokens.refreshToken },
    });
    assert.equal(customerLogoutA.status, 201);
    assert.equal(await waitForSocketDisconnect(customerSocketA.socket), true);
    assert.equal(customerSocketB.socket.connected, true);
    const revokedCustomerReconnect = await connectStaffSocket(
      tenantAHost, customerA.body.data.tokens.accessToken, "customer",
    );
    assert.equal(revokedCustomerReconnect.connected, false);

    console.log(
      "Staging A/B proof passed: tenant membership/cache separation, live order delivery/reconnect, customer logout revocation, host/domain, reports/audit, OTP sessions, and tenant media isolation.",
    );
  } catch (error) {
    failure = error;
  } finally {
    for (const socket of fixture.socketClients) socket.close();
    if (guardPassed) {
      for (const mediaObject of fixture.mediaObjects) {
        const safePrefix = "tenants/" + mediaObject.tenantId + "/products/";
        if (
          typeof mediaObject.objectName !== "string" ||
          !mediaObject.objectName.startsWith(safePrefix) ||
          mediaObject.objectName.split("/").length !== 4
        ) {
          cleanupFailure = new Error(
            "Staging media cleanup refused an object outside the synthetic tenant prefix.",
          );
          continue;
        }
        try {
          await mediaClient.removeObject(
            EXPECTED_MEDIA_BUCKET,
            mediaObject.objectName,
          );
          let removed = false;
          try {
            await mediaClient.statObject(
              EXPECTED_MEDIA_BUCKET,
              mediaObject.objectName,
            );
          } catch (error) {
            const code = error && typeof error === "object" ? error.code : null;
            removed = ["NoSuchKey", "NotFound", "NoSuchObject"].includes(code);
          }
          if (!removed) {
            cleanupFailure = new Error(
              "Staging media cleanup could not verify removal of a synthetic object.",
            );
          }
        } catch {
          cleanupFailure = new Error(
            "Staging media fixture cleanup failed; inspect only the recorded synthetic object prefixes.",
          );
        }
      }
      try {
        const tenantIds = [fixture.tenantAId, fixture.tenantBId].filter(
          Boolean,
        );
        if (fixture.auditLogIds.length) {
          await prisma.auditLog.deleteMany({
            where: { id: { in: fixture.auditLogIds } },
          });
        }
        if (fixture.userIds.length) {
          await prisma.auditLog.deleteMany({ where: { userId: { in: fixture.userIds } } });
        }
        await prisma.customer.deleteMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
        });
        await prisma.customerVerificationChallenge.deleteMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
        });
        if (fixture.orderIds.length) {
          await prisma.outboxEvent.deleteMany({
            where: { aggregateType: "ORDER", aggregateId: { in: fixture.orderIds } },
          });
          await prisma.orderEvent.deleteMany({
            where: { orderId: { in: fixture.orderIds } },
          });
          await prisma.order.deleteMany({
            where: { id: { in: fixture.orderIds } },
          });
        }
        await prisma.setting.deleteMany({
          where: { tenantId: { in: tenantIds }, key: DELIVERY_SETTING },
        });
        if (fixture.userIds.length) {
          await prisma.tenantMembership.deleteMany({
            where: { userId: { in: fixture.userIds } },
          });
          await prisma.userRole.deleteMany({
            where: { userId: { in: fixture.userIds } },
          });
        }
        if (fixture.employeeIds.length) {
          await prisma.employee.deleteMany({
            where: { id: { in: fixture.employeeIds } },
          });
        }
        if (fixture.userIds.length) {
          await prisma.user.deleteMany({
            where: { id: { in: fixture.userIds } },
          });
        }
        if (fixture.domainIds.length) {
          await prisma.tenantDomain.deleteMany({
            where: { id: { in: fixture.domainIds } },
          });
        }
        if (fixture.outboxEventIds.length) {
          await prisma.outboxEvent.deleteMany({
            where: { id: { in: fixture.outboxEventIds } },
          });
        }
        if (fixture.deviceIds.length) {
          await prisma.device.deleteMany({ where: { id: { in: fixture.deviceIds } } });
        }
        if (fixture.branchIds.length) {
          await prisma.branch.deleteMany({
            where: { id: { in: fixture.branchIds } },
          });
        }
        if (fixture.roleId)
          await prisma.role.deleteMany({ where: { id: fixture.roleId } });
        if (fixture.socketRoleId)
          await prisma.role.deleteMany({ where: { id: fixture.socketRoleId } });
        if (fixture.tenantAOnlyRoleId)
          await prisma.role.deleteMany({ where: { id: fixture.tenantAOnlyRoleId } });
        if (fixture.permissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.permissionId },
          });
        if (fixture.uploadPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.uploadPermissionId },
          });
        if (fixture.realtimePermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.realtimePermissionId },
          });
        if (fixture.auditPermissionId)
          await prisma.permission.deleteMany({ where: { id: fixture.auditPermissionId } });
        if (fixture.reportPermissionId)
          await prisma.permission.deleteMany({ where: { id: fixture.reportPermissionId } });
        if (fixture.orderCreatePermissionId)
          await prisma.permission.deleteMany({ where: { id: fixture.orderCreatePermissionId } });
        if (fixture.tenantAOnlyPermissionId)
          await prisma.permission.deleteMany({ where: { id: fixture.tenantAOnlyPermissionId } });
        if (fixture.tenantBId) {
          await prisma.restaurantTenant.deleteMany({
            where: { id: fixture.tenantBId },
          });
        }
        const remaining = await Promise.all([
          prisma.restaurantTenant.count(),
          prisma.branch.count(),
          prisma.device.count(),
          prisma.user.count(),
          prisma.employee.count(),
          prisma.tenantMembership.count(),
          prisma.tenantDomain.count(),
          prisma.customer.count(),
          prisma.customerVerificationChallenge.count(),
          prisma.setting.count(),
          prisma.order.count(),
          prisma.orderEvent.count(),
          prisma.role.count(),
          prisma.permission.count(),
          prisma.outboxEvent.count(),
          prisma.auditLog.count(),
        ]);
        assert.deepEqual(
          remaining,
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, fixture.auditBaselineCount],
          "All staging fixtures must be removed.",
        );
      } catch {
        cleanupFailure = new Error(
          "Staging fixture cleanup failed; inspect the staging database before any further test.",
        );
      }
    }
    await prisma.$disconnect();
    await pool.end();
  }

  if (cleanupFailure) throw cleanupFailure;
  if (failure) {
    const message = String(failure.message ?? failure).replace(
      databaseUrl.password,
      "[redacted]",
    );
    throw new Error(message.slice(0, 1200));
  }
}

main().catch((error) => {
  console.error(`Staging A/B QA failed: ${error.message}`);
  process.exitCode = 1;
});
