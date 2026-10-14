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
const KITCHEN_POS_SETTING = "kitchen_pos_orders_enabled";
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
  assert.ok(
    ["postgres:", "postgresql:"].includes(databaseUrl.protocol),
    "Refusing a non-PostgreSQL staging URL.",
  );
  assert.equal(
    databaseUrl.hostname,
    EXPECTED_DATABASE_HOST,
    "Refusing an unknown database host.",
  );
  assert.equal(
    databaseUrl.port,
    "5432",
    "Refusing an unknown staging database port.",
  );
  const targetOverrideParams = new Set([
    "database",
    "dbname",
    "host",
    "hostaddr",
    "port",
    "service",
  ]);
  assert.equal(
    [...databaseUrl.searchParams.keys()].some((key) =>
      targetOverrideParams.has(key.toLowerCase()),
    ),
    false,
    "Refusing a staging URL with connection-target overrides.",
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
  if (payload !== undefined && !requestHeaders["Content-Length"]) {
    requestHeaders["Content-Length"] = String(Buffer.byteLength(payload));
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
            reject(
              new Error(
                `The staging API returned a non-JSON response for ${method} ${url.pathname} (HTTP ${response.statusCode}).`,
              ),
            );
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
    notificationOutboxBaselineCount: null,
    domainIds: [],
    userIds: [],
    employeeIds: [],
    roleId: null,
    socketRoleId: null,
    permissionId: null,
    catalogPermissionIds: [],
    categoryIds: [],
    productIds: [],
    variantIds: [],
    recipeIds: [],
    heroSlideIds: [],
    promotionIds: [],
    auditPermissionId: null,
    reportPermissionId: null,
    membershipIds: [],
    mediaObjects: [],
    uploadPermissionId: null,
    outboxEventIds: [],
    orderIds: [],
    shiftIds: [],
    paymentMethodIds: [],
    receiptPermissionIds: [],
    realtimePermissionId: null,
    orderCreatePermissionId: null,
    orderMutationPermissionIds: [],
    kitchenViewPermissionId: null,
    posUsePermissionId: null,
    shiftOpenPermissionId: null,
    shiftViewPermissionId: null,
    shiftClosePermissionId: null,
    paymentCreatePermissionId: null,
    paymentRefundPermissionId: null,
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
      shiftCount,
      cashTransactionCount,
      paymentMethodCount,
      paymentCount,
      paymentRefundCount,
      paymentOperationCount,
      revenueRecordCount,
      receiptCount,
      printJobCount,
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
      prisma.shift.count(),
      prisma.cashTransaction.count(),
      prisma.paymentMethod.count(),
      prisma.payment.count(),
      prisma.paymentRefund.count(),
      prisma.paymentOperation.count(),
      prisma.revenueRecord.count(),
      prisma.receipt.count(),
      prisma.printJob.count(),
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
        shiftCount,
        cashTransactionCount,
        paymentMethodCount,
        paymentRefundCount,
        paymentCount,
        paymentOperationCount,
        revenueRecordCount,
        receiptCount,
        printJobCount,
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
        shiftCount: 0,
        cashTransactionCount: 0,
        paymentRefundCount: 0,
        paymentMethodCount: 0,
        paymentCount: 0,
        paymentOperationCount: 0,
        revenueRecordCount: 0,
        receiptCount: 0,
        printJobCount: 0,
      },
      "Staging must be an empty baseline before the disposable A/B fixture is created.",
    );
    fixture.auditBaselineCount = await prisma.auditLog.count();
    fixture.notificationOutboxBaselineCount =
      await prisma.notificationOutbox.count();
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
    const categoryA = await prisma.category.create({
      data: {
        branchId: branchA.id,
        code: "QA_CATEGORY_A_" + suffix,
        name: "Disposable staging A catalog " + suffix,
      },
    });
    fixture.categoryIds.push(categoryA.id);
    const productA = await prisma.product.create({
      data: {
        branchId: branchA.id,
        categoryId: categoryA.id,
        code: "QA_PRODUCT_A_" + suffix,
        name: "Disposable staging A product " + suffix,
        sellingPrice: "1000",
      },
    });
    fixture.productIds.push(productA.id);
    const variantA = await prisma.productVariant.create({
      data: {
        productId: productA.id,
        code: "DEFAULT",
        name: "Default",
        sellingPrice: "1000",
        isDefault: true,
      },
    });
    fixture.variantIds.push(variantA.id);
    const foreignCategory = await prisma.category.create({
      data: {
        branchId: branchB.id,
        code: "QA_CATALOG_" + suffix,
        name: "Disposable staging catalog " + suffix,
      },
    });
    fixture.categoryIds.push(foreignCategory.id);
    const foreignProduct = await prisma.product.create({
      data: {
        branchId: branchB.id,
        categoryId: foreignCategory.id,
        code: "QA_PRODUCT_" + suffix,
        name: "Disposable staging product " + suffix,
        sellingPrice: "1000",
      },
    });
    fixture.productIds.push(foreignProduct.id);
    const foreignVariant = await prisma.productVariant.create({
      data: {
        productId: foreignProduct.id,
        code: "DEFAULT",
        name: "Default",
        sellingPrice: "1000",
        isDefault: true,
      },
    });
    fixture.variantIds.push(foreignVariant.id);
    const foreignRecipe = await prisma.recipe.create({
      data: { variantId: foreignVariant.id },
    });
    fixture.recipeIds.push(foreignRecipe.id);
    const foreignHeroSlide = await prisma.homepageHeroSlide.create({
      data: {
        title: "QA foreign slide " + suffix,
        productId: foreignProduct.id,
      },
    });
    fixture.heroSlideIds.push(foreignHeroSlide.id);
    const foreignPromotion = await prisma.promotion.create({
      data: {
        title: "QA foreign promotion " + suffix,
        productId: foreignProduct.id,
        categoryId: foreignCategory.id,
      },
    });
    fixture.promotionIds.push(foreignPromotion.id);

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
    for (const [code, name] of [
      ["HOMEPAGE_MANAGE", "Disposable staging homepage access"],
      ["INVENTORY_VIEW", "Disposable staging inventory access"],
      ["RECIPE_MANAGE", "Disposable staging recipe access"],
    ]) {
      const catalogPermission = await prisma.permission.create({
        data: { code, name },
      });
      fixture.catalogPermissionIds.push(catalogPermission.id);
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: catalogPermission.id },
      });
    }
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
    for (const [code, name] of [
      ["ORDER_UPDATE", "Disposable staging order update"],
      ["ORDER_SEND_KITCHEN", "Disposable staging kitchen handoff"],
    ]) {
      const permission = await prisma.permission.create({
        data: { code, name },
      });
      fixture.orderMutationPermissionIds.push(permission.id);
    }
    const kitchenViewPermission = await prisma.permission.create({
      data: { code: "KITCHEN_VIEW", name: "Disposable staging kitchen view" },
    });
    fixture.kitchenViewPermissionId = kitchenViewPermission.id;
    const posUsePermission = await prisma.permission.create({
      data: { code: "POS_USE", name: "Disposable staging POS checkout" },
    });
    fixture.posUsePermissionId = posUsePermission.id;
    const shiftOpenPermission = await prisma.permission.create({
      data: { code: "SHIFT_OPEN", name: "Disposable staging shift open" },
    });
    fixture.shiftOpenPermissionId = shiftOpenPermission.id;

    const shiftViewPermission = await prisma.permission.create({
      data: {
        code: "SHIFT_VIEW_BRANCH",
        name: "Disposable staging shift view",
      },
    });
    const shiftClosePermission = await prisma.permission.create({
      data: {
        code: "SHIFT_CLOSE",
        name: "Disposable staging shift close",
      },
    });
    fixture.shiftClosePermissionId = shiftClosePermission.id;
    fixture.shiftViewPermissionId = shiftViewPermission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: shiftViewPermission.id },
    });
    for (const [code, name] of [
      ["RECEIPT_VIEW", "Disposable staging receipt view"],
      ["RECEIPT_PRINT", "Disposable staging receipt reprint"],
    ]) {
      const permission = await prisma.permission.create({
        data: { code, name },
      });
      fixture.receiptPermissionIds.push(permission.id);
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const paymentCreatePermission = await prisma.permission.create({
      data: {
        code: "PAYMENT_CREATE",
        name: "Disposable staging cash payment",
      },
    });
    fixture.paymentCreatePermissionId = paymentCreatePermission.id;
    const paymentRefundPermission = await prisma.permission.create({
      data: {
        code: "PAYMENT_REFUND",
        name: "Disposable staging cash refund",
      },
    });
    fixture.paymentRefundPermissionId = paymentRefundPermission.id;
    const tenantAOnlyPermission = await prisma.permission.create({
      data: {
        code: `QA_TENANT_A_ONLY_${suffix}`,
        name: "Disposable tenant A role marker",
      },
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
      data: {
        roleId: tenantAOnlyRole.id,
        permissionId: tenantAOnlyPermission.id,
      },
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
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: kitchenViewPermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: posUsePermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: shiftOpenPermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: shiftClosePermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: paymentCreatePermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: shiftViewPermission.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: socketRole.id, permissionId: paymentRefundPermission.id },
    });
    for (const permissionId of fixture.receiptPermissionIds) {
      await prisma.rolePermission.create({
        data: { roleId: socketRole.id, permissionId },
      });
    }
    for (const permissionId of fixture.orderMutationPermissionIds) {
      await prisma.rolePermission.create({
        data: { roleId: socketRole.id, permissionId },
      });
    }

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
        enrollmentCodeHash: createHash("sha256")
          .update(deviceCodeA)
          .digest("hex"),
        enrollmentExpiresAt,
      },
    });
    fixture.deviceIds.push(deviceA.id);
    const deviceB = await prisma.device.create({
      data: {
        branchId: branchB.id,
        name: "Disposable staging POS B",
        type: "POS_TERMINAL",
        enrollmentCodeHash: createHash("sha256")
          .update(deviceCodeB)
          .digest("hex"),
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
      (await enroll(tenantAHost, "qa-hardware-a-" + suffix, deviceCodeB))
        .status,
      400,
      "Tenant A must not claim tenant B enrollment code.",
    );
    assert.equal(
      (await enroll(tenantBHost, "qa-hardware-b-" + suffix, deviceCodeA))
        .status,
      400,
      "Tenant B must not claim tenant A enrollment code.",
    );
    assert.equal(
      (await enroll(pendingHost, "qa-hardware-p-" + suffix, deviceCodeB))
        .status,
      403,
      "Pending domain must not enroll a device.",
    );
    assert.equal(
      (
        await enroll(
          "unknown-" + suffix + ".invalid",
          "qa-hardware-u-" + suffix,
          deviceCodeB,
        )
      ).status,
      403,
      "Unknown domain must not enroll a device.",
    );
    const enrolledA = await enroll(
      tenantAHost,
      "qa-hardware-a-" + suffix,
      deviceCodeA,
    );
    const enrolledB = await enroll(
      tenantBHost,
      "qa-hardware-b-" + suffix,
      deviceCodeB,
    );
    assert.equal(enrolledA.status, 201);
    assert.equal(enrolledB.status, 201);
    assert.equal(
      (await enroll(tenantAHost, "qa-hardware-a-" + suffix, deviceCodeA))
        .status,
      400,
      "Enrollment code must be consumed after one successful claim.",
    );
    const enrolledDeviceRows = await prisma.device.findMany({
      where: { id: { in: [deviceA.id, deviceB.id] } },
      select: {
        id: true,
        branchId: true,
        hardwareId: true,
        enrolledAt: true,
        deviceAuthTokenHash: true,
        enrollmentCodeHash: true,
      },
    });
    const enrolledById = new Map(
      enrolledDeviceRows.map((device) => [device.id, device]),
    );
    assert.equal(enrolledById.get(deviceA.id)?.branchId, branchA.id);
    assert.equal(
      enrolledById.get(deviceA.id)?.hardwareId,
      "qa-hardware-a-" + suffix,
    );
    assert.ok(enrolledById.get(deviceA.id)?.enrolledAt);
    assert.ok(enrolledById.get(deviceA.id)?.deviceAuthTokenHash);
    assert.equal(enrolledById.get(deviceA.id)?.enrollmentCodeHash, null);
    assert.equal(enrolledById.get(deviceB.id)?.branchId, branchB.id);
    assert.equal(
      enrolledById.get(deviceB.id)?.hardwareId,
      "qa-hardware-b-" + suffix,
    );
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
    const catalogTenantGuardMessage =
      "Tenant context is required; exactly one active restaurant must be available";
    const catalogGuardChecks = await Promise.all([
      request("/customer/home", { host: tenantAHost }),
      request("/recipes", {
        host: tenantAHost,
        headers: {
          Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
        },
      }),
      request("/homepage/hero-slides", {
        host: tenantAHost,
        headers: {
          Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
        },
      }),
      request("/homepage/promotions", {
        host: tenantAHost,
        headers: {
          Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
        },
      }),
    ]);
    for (const response of catalogGuardChecks) {
      assert.equal(response.status, 403);
      assert.equal(response.body.error?.message, catalogTenantGuardMessage);
    }
    const authMeA = await request("/auth/me", {
      host: tenantAHost,
      headers: {
        Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
      },
    });
    const authMeB = await request("/auth/me", {
      host: tenantBHost,
      headers: {
        Authorization: "Bearer " + loginB.body.data.tokens.accessToken,
      },
    });
    assert.equal(authMeA.status, 200);
    assert.equal(authMeB.status, 200);
    assert.ok(authMeA.body.data.roles.includes(tenantAOnlyRole.code));
    assert.ok(!authMeB.body.data.roles.includes(tenantAOnlyRole.code));

    await prisma.restaurantTenant.update({
      where: { id: tenantB.id },
      data: { status: "PROVISIONING" },
    });
    const tenantAHeaders = {
      Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
    };
    const [customerHome, recipes, recipeDetail, homepageSlides, promotions] =
      await Promise.all([
        request("/customer/home", { host: tenantAHost }),
        request("/recipes", { host: tenantAHost, headers: tenantAHeaders }),
        request("/recipes/variants/" + encodeURIComponent(foreignVariant.id), {
          host: tenantAHost,
          headers: tenantAHeaders,
        }),
        request("/homepage/hero-slides", {
          host: tenantAHost,
          headers: tenantAHeaders,
        }),
        request("/homepage/promotions", {
          host: tenantAHost,
          headers: tenantAHeaders,
        }),
      ]);
    assert.equal(customerHome.status, 200);
    assert.ok(
      !customerHome.body.data.heroSlides.some(
        (slide) => slide.id === foreignHeroSlide.id,
      ),
    );
    assert.ok(
      !customerHome.body.data.promotions.some(
        (promotion) => promotion.id === foreignPromotion.id,
      ),
    );
    assert.equal(recipes.status, 200);
    assert.ok(
      !recipes.body.data.some((recipe) => recipe.id === foreignRecipe.id),
    );
    assert.equal(recipeDetail.status, 404);
    assert.equal(homepageSlides.status, 200);
    assert.ok(
      !homepageSlides.body.data.some(
        (slide) => slide.id === foreignHeroSlide.id,
      ),
    );
    assert.equal(promotions.status, 200);
    assert.ok(
      !promotions.body.data.some(
        (promotion) => promotion.id === foreignPromotion.id,
      ),
    );

    const foreignWrites = await Promise.all([
      request("/homepage/hero-slides", {
        host: tenantAHost,
        method: "POST",
        headers: tenantAHeaders,
        body: { title: "QA rejected hero", productId: foreignProduct.id },
      }),
      request("/homepage/promotions", {
        host: tenantAHost,
        method: "POST",
        headers: tenantAHeaders,
        body: {
          title: "QA rejected promotion",
          categoryId: foreignCategory.id,
        },
      }),
      request(
        "/homepage/hero-slides/" + encodeURIComponent(foreignHeroSlide.id),
        {
          host: tenantAHost,
          method: "DELETE",
          headers: tenantAHeaders,
        },
      ),
      request("/homepage/hero-slides/bulk", {
        host: tenantAHost,
        method: "DELETE",
        headers: tenantAHeaders,
        body: { ids: [foreignHeroSlide.id] },
      }),
      request(
        "/homepage/promotions/" + encodeURIComponent(foreignPromotion.id),
        {
          host: tenantAHost,
          method: "DELETE",
          headers: tenantAHeaders,
        },
      ),
      request("/homepage/promotions/bulk", {
        host: tenantAHost,
        method: "DELETE",
        headers: tenantAHeaders,
        body: { ids: [foreignPromotion.id] },
      }),
      request("/recipes", {
        host: tenantAHost,
        method: "PUT",
        headers: tenantAHeaders,
        body: { variantId: foreignVariant.id, items: [] },
      }),
    ]);
    assert.ok(
      foreignWrites.every((response) => response.status === 404),
      JSON.stringify(
        foreignWrites.map(({ status, body }) => ({
          status,
          message: body?.error?.message,
        })),
      ),
    );
    const retainedCatalogFixtures = await Promise.all([
      prisma.homepageHeroSlide.count({ where: { id: foreignHeroSlide.id } }),
      prisma.promotion.count({ where: { id: foreignPromotion.id } }),
      prisma.recipe.count({ where: { id: foreignRecipe.id } }),
    ]);
    assert.deepEqual(retainedCatalogFixtures, [1, 1, 1]);
    await prisma.restaurantTenant.update({
      where: { id: tenantB.id },
      data: { status: "ACTIVE" },
    });

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
      headers: {
        Authorization: "Bearer " + socketLoginA.body.data.tokens.accessToken,
      },
      body: {
        branchId: branchA.id,
        type: "TAKEAWAY",
        customerName: orderAName,
      },
    });
    const createdOrderA = await prisma.order.findFirst({
      where: { branchId: branchA.id, customerName: orderAName },
      select: { id: true, version: true, source: true },
    });
    const orderAId =
      createdOrderA?.id ?? orderA.body.data?.id ?? orderA.body.data?.order?.id;
    if (typeof orderAId === "string") fixture.orderIds.push(orderAId);
    assert.equal(orderA.status, 201);
    assert.equal(typeof orderAId, "string");
    assert.equal(createdOrderA?.source, "POS");

    const staffHeaders = {
      Authorization: "Bearer " + socketLoginA.body.data.tokens.accessToken,
      "X-Correlation-ID": "qa-order-guard-" + suffix,
    };
    const initialAdd = await request(`/orders/${orderAId}/items`, {
      host: tenantAHost,
      method: "POST",
      headers: {
        ...staffHeaders,
        "Idempotency-Key": "qa-initial-add-" + suffix,
      },
      body: { productId: productA.id, variantId: variantA.id, quantity: 1 },
    });
    assert.equal(initialAdd.status, 201);
    const beforeHandoff = await prisma.order.findUniqueOrThrow({
      where: { id: orderAId },
      select: { version: true },
    });
    const accepted = await request(`/orders/${orderAId}/actions/accept`, {
      host: tenantAHost,
      method: "POST",
      headers: {
        ...staffHeaders,
        "Idempotency-Key": "qa-kitchen-accept-" + suffix,
      },
      body: { expectedVersion: beforeHandoff.version },
    });
    assert.equal(accepted.status, 201);
    const afterHandoff = await prisma.order.findUniqueOrThrow({
      where: { id: orderAId },
      select: { version: true },
    });
    const handoffItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: orderAId },
      select: { id: true, quantity: true },
    });
    assert.equal(
      await prisma.kitchenTicket.count({ where: { orderId: orderAId } }),
      1,
    );
    const lateAdd = await request(`/orders/${orderAId}/items`, {
      host: tenantAHost,
      method: "POST",
      headers: {
        ...staffHeaders,
        "Idempotency-Key": "qa-late-add-" + suffix,
      },
      body: { productId: productA.id, variantId: variantA.id, quantity: 1 },
    });
    assert.equal(lateAdd.status, 400);
    const lateEdit = await request(
      `/orders/${orderAId}/items/${handoffItem.id}`,
      {
        host: tenantAHost,
        method: "PATCH",
        headers: {
          ...staffHeaders,
          "Idempotency-Key": "qa-late-edit-" + suffix,
        },
        body: { quantity: 2, expectedVersion: afterHandoff.version },
      },
    );
    assert.equal(lateEdit.status, 400);
    assert.equal(
      (
        await prisma.orderItem.findUniqueOrThrow({
          where: { id: handoffItem.id },
        })
      ).quantity.toNumber(),
      1,
    );
    assert.equal(
      await prisma.kitchenTicket.count({ where: { orderId: orderAId } }),
      1,
    );

    const orderBName = "Realtime QA B " + suffix;
    const readKitchenSetting = async (host, accessToken) => {
      const response = await request("/settings", {
        host,
        headers: { Authorization: "Bearer " + accessToken },
      });
      assert.equal(response.status, 200);
      const entry = response.body.data.find(
        (setting) => setting.key === KITCHEN_POS_SETTING,
      );
      assert.ok(entry, "Kitchen POS visibility setting must be listed.");
      return String(entry.value).toLowerCase() === "true";
    };
    const writeKitchenSetting = (host, accessToken, enabled) =>
      request("/settings/" + KITCHEN_POS_SETTING, {
        host,
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken },
        body: { value: String(enabled) },
      });
    const readKitchenOrderIds = async (host, accessToken) => {
      const response = await request("/kitchen/orders", {
        host,
        headers: { Authorization: "Bearer " + accessToken },
      });
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.body.data.items));
      return response.body.data.items.map((ticket) => ticket.orderId);
    };

    assert.equal(
      await readKitchenSetting(
        tenantAHost,
        loginA.body.data.tokens.accessToken,
      ),
      false,
      "Tenant A kitchen POS visibility must default to disabled.",
    );
    assert.equal(
      await readKitchenSetting(
        tenantBHost,
        loginB.body.data.tokens.accessToken,
      ),
      false,
      "Tenant B kitchen POS visibility must default to disabled.",
    );
    assert.equal(
      (
        await readKitchenOrderIds(
          tenantAHost,
          socketLoginA.body.data.tokens.accessToken,
        )
      ).includes(orderAId),
      false,
      "A POS ticket must be hidden from the kitchen by default.",
    );

    const enableKitchenPos = await writeKitchenSetting(
      tenantAHost,
      loginA.body.data.tokens.accessToken,
      true,
    );
    assert.equal(enableKitchenPos.status, 200);
    assert.equal(
      await readKitchenSetting(
        tenantAHost,
        loginA.body.data.tokens.accessToken,
      ),
      true,
      "Tenant A must read back its enabled kitchen setting immediately.",
    );
    assert.equal(
      await readKitchenSetting(
        tenantBHost,
        loginB.body.data.tokens.accessToken,
      ),
      false,
      "Changing tenant A must not enable POS tickets for tenant B.",
    );
    assert.ok(
      (
        await readKitchenOrderIds(
          tenantAHost,
          socketLoginA.body.data.tokens.accessToken,
        )
      ).includes(orderAId),
      "The POS ticket must become visible after enabling the setting.",
    );
    assert.equal(
      (
        await readKitchenOrderIds(
          tenantBHost,
          socketLoginB.body.data.tokens.accessToken,
        )
      ).includes(orderAId),
      false,
      "Tenant B kitchen must never see tenant A's POS ticket.",
    );

    const disableKitchenPos = await writeKitchenSetting(
      tenantAHost,
      loginA.body.data.tokens.accessToken,
      false,
    );
    assert.equal(disableKitchenPos.status, 200);
    assert.equal(
      (
        await readKitchenOrderIds(
          tenantAHost,
          socketLoginA.body.data.tokens.accessToken,
        )
      ).includes(orderAId),
      false,
      "The POS ticket must be hidden again after disabling the setting.",
    );

    const cashierToken = socketLoginA.body.data.tokens.accessToken;
    const cashierHeaders = { Authorization: "Bearer " + cashierToken };
    const openShiftResponse = await request("/shifts/open", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: { branchId: branchA.id, openingBalance: 0 },
    });
    const cashierShift = await prisma.shift.findFirst({
      where: {
        branchId: branchA.id,
        employeeId: fixture.employeeIds[0],
        status: "OPEN",
      },
      orderBy: { openedAt: "desc" },
    });
    if (cashierShift) fixture.shiftIds.push(cashierShift.id);
    assert.equal(openShiftResponse.status, 201);
    assert.ok(cashierShift, "The staging cashier shift must be created.");
    assert.equal(cashierShift.openingBalance.toString(), "0");
    const openingCashRows = await prisma.cashTransaction.findMany({
      where: { shiftId: cashierShift.id },
      select: { type: true, amount: true, orderId: true },
    });
    assert.equal(openingCashRows.length, 1);
    assert.equal(openingCashRows[0].type, "OPENING_BALANCE");
    assert.equal(openingCashRows[0].amount.toString(), "0");
    assert.equal(openingCashRows[0].orderId, null);

    const payLaterKey = "qa-dine-in-pay-later-" + suffix;
    const payLaterBody = {
      idempotencyKey: payLaterKey,
      type: "DINE_IN",
      payLater: true,
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
    };
    const payLaterResponse = await request("/pos/orders", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: payLaterBody,
    });
    const payLaterOperation = await prisma.paymentOperation.findUnique({
      where: { idempotencyKey: "POS_CHECKOUT:" + payLaterKey },
      select: { orderId: true },
    });
    if (payLaterOperation) fixture.orderIds.push(payLaterOperation.orderId);
    assert.equal(payLaterResponse.status, 201);
    assert.ok(payLaterOperation, "The POS idempotency record must be stored.");
    const payLaterOrder = await prisma.order.findUnique({
      where: { id: payLaterOperation.orderId },
      select: {
        id: true,
        type: true,
        source: true,
        paymentStatus: true,
        shiftId: true,
        version: true,
      },
    });
    assert.ok(payLaterOrder);
    assert.equal(payLaterOrder.type, "DINE_IN");
    assert.equal(payLaterOrder.source, "POS");
    assert.equal(payLaterOrder.paymentStatus, "PENDING");
    assert.equal(payLaterOrder.shiftId, cashierShift.id);
    assert.equal(payLaterResponse.body.data.order.id, payLaterOrder.id);
    assert.equal(payLaterResponse.body.data.payment.method, "PENDING");

    const payLaterReplay = await request("/pos/orders", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: payLaterBody,
    });
    assert.equal(payLaterReplay.status, 201);
    assert.equal(payLaterReplay.body.data.order.id, payLaterOrder.id);
    assert.equal(
      await prisma.paymentOperation.count({
        where: { orderId: payLaterOrder.id },
      }),
      1,
    );
    assert.equal(
      await prisma.payment.count({ where: { orderId: payLaterOrder.id } }),
      0,
      "An unpaid dine-in order must not create a payment.",
    );
    assert.equal(
      await prisma.revenueRecord.count({
        where: {
          OR: [{ orderId: payLaterOrder.id }, { shiftId: cashierShift.id }],
        },
      }),
      0,
      "An unpaid dine-in order must not create a revenue record.",
    );
    assert.equal(
      await prisma.cashTransaction.count({
        where: { orderId: payLaterOrder.id },
      }),
      0,
      "An unpaid dine-in order must not create a cash transaction.",
    );
    const payLaterReceipts = await prisma.receipt.findMany({
      where: { orderId: payLaterOrder.id },
      select: { documentType: true },
    });
    assert.deepEqual(
      payLaterReceipts.map((receipt) => receipt.documentType).sort(),
      ["KITCHEN"],
      "A pending dine-in order should create only the kitchen ticket, not a customer receipt.",
    );
    const shiftAfterPayLater = await prisma.shift.findUnique({
      where: { id: cashierShift.id },
      select: { salesTotal: true, cashTotal: true },
    });
    assert.equal(
      shiftAfterPayLater.salesTotal.toString(),
      "0",
      "Pending dine-in must not add sales revenue to the shift.",
    );
    assert.equal(
      shiftAfterPayLater.cashTotal.toString(),
      "0",
      "Pending dine-in must not add cash to the shift.",
    );
    assert.equal(
      await prisma.cashTransaction.count({
        where: { shiftId: cashierShift.id },
      }),
      1,
      "A pending dine-in sale must leave only the zero opening-balance row in the till.",
    );

    const cancelOrderKey = "qa-cancel-unpaid-" + suffix;
    const cancelOrderHeaders = {
      ...cashierHeaders,
      "Idempotency-Key": cancelOrderKey,
    };
    const cancelOrderBody = {
      expectedVersion: payLaterOrder.version,
      reasonCode: "CASHIER_CANCELLED",
    };
    const cancelOrderPath =
      "/orders/" + encodeURIComponent(payLaterOrder.id) + "/actions/cancel";
    const cancelOrderResponse = await request(cancelOrderPath, {
      host: tenantAHost,
      method: "POST",
      headers: cancelOrderHeaders,
      body: cancelOrderBody,
    });
    assert.equal(cancelOrderResponse.status, 201);
    assert.equal(cancelOrderResponse.body.data.id, payLaterOrder.id);
    assert.equal(cancelOrderResponse.body.data.status, "CANCELLED");
    const cancelOrderReplay = await request(cancelOrderPath, {
      host: tenantAHost,
      method: "POST",
      headers: cancelOrderHeaders,
      body: cancelOrderBody,
    });
    assert.equal(cancelOrderReplay.status, 201);
    assert.equal(cancelOrderReplay.body.data.id, payLaterOrder.id);
    assert.equal(cancelOrderReplay.body.data.status, "CANCELLED");
    const cancelledOrderRecord = await prisma.order.findUnique({
      where: { id: payLaterOrder.id },
      select: { status: true, cancellationReason: true, version: true },
    });
    assert.ok(cancelledOrderRecord);
    assert.equal(cancelledOrderRecord.status, "CANCELLED");
    assert.equal(cancelledOrderRecord.cancellationReason, null);
    assert.equal(cancelledOrderRecord.version, payLaterOrder.version + 1);
    assert.equal(
      await prisma.orderEvent.count({
        where: {
          orderId: payLaterOrder.id,
          eventType: "OrderCancelled",
          idempotencyKey: cancelOrderKey,
        },
      }),
      1,
      "Cancellation replay must persist one idempotent CANCELLED order event.",
    );
    assert.equal(
      await prisma.payment.count({ where: { orderId: payLaterOrder.id } }),
      0,
    );
    assert.equal(
      await prisma.revenueRecord.count({
        where: { orderId: payLaterOrder.id },
      }),
      0,
    );
    assert.equal(
      await prisma.cashTransaction.count({
        where: { orderId: payLaterOrder.id },
      }),
      0,
    );
    assert.equal(
      await prisma.kitchenTicket.count({
        where: { orderId: payLaterOrder.id },
      }),
      1,
      "Cancelling must preserve exactly one kitchen ticket for the order.",
    );
    const shiftAfterCancel = await prisma.shift.findUnique({
      where: { id: cashierShift.id },
      select: { salesTotal: true, cashTotal: true },
    });
    assert.equal(shiftAfterCancel.salesTotal.toString(), "0");
    assert.equal(shiftAfterCancel.cashTotal.toString(), "0");
    const orderB = await request("/orders", {
      host: tenantBHost,
      method: "POST",
      headers: {
        Authorization: "Bearer " + socketLoginB.body.data.tokens.accessToken,
      },
      body: {
        branchId: branchB.id,
        type: "TAKEAWAY",
        customerName: orderBName,
      },
    });
    const createdOrderB = await prisma.order.findFirst({
      where: { branchId: branchB.id, customerName: orderBName },
      select: { id: true },
    });
    const orderBId =
      createdOrderB?.id ?? orderB.body.data?.id ?? orderB.body.data?.order?.id;
    if (typeof orderBId === "string") fixture.orderIds.push(orderBId);
    assert.equal(orderB.status, 201);
    assert.equal(typeof orderBId, "string");
    await waitUntil(
      () =>
        receivedA.some((event) => event.orderId === orderAId) &&
        receivedB.some((event) => event.orderId === orderBId),
      5000,
      "Each tenant staff socket must receive its own live order event.",
    );
    assert.deepEqual(
      [...new Set(receivedA.map((event) => event.orderId))].sort(),
      [orderAId, payLaterOrder.id].sort(),
    );
    assert.deepEqual(
      [...new Set(receivedB.map((event) => event.orderId))],
      [orderBId],
    );

    socketA.close();
    const reconnectedA = await connectStaffSocket(
      tenantAHost,
      socketLoginA.body.data.tokens.accessToken,
    );
    assert.equal(reconnectedA.connected, true);
    fixture.socketClients.push(reconnectedA.socket);
    const replayedA = await realtimeEvents(
      tenantAHost,
      socketLoginA.body.data.tokens.accessToken,
      "?cursor=" + encodeURIComponent(realtimeA.body.data.cursor) + "&limit=50",
    );
    assert.equal(replayedA.status, 200);
    assert.deepEqual(
      [
        ...new Set(
          replayedA.body.data.events.map((event) => event.aggregateId),
        ),
      ].sort(),
      [orderAId, payLaterOrder.id].sort(),
    );

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

    const qaCashMethod = await prisma.paymentMethod.create({
      data: {
        branchId: branchA.id,
        code: "CASH",
        name: "Disposable staging cash",
        isActive: true,
      },
    });
    fixture.paymentMethodIds.push(qaCashMethod.id);

    const cashSaleKey = "qa-pos-cash-sale-" + suffix;
    const cashSaleBody = {
      idempotencyKey: cashSaleKey,
      type: "TAKEAWAY",
      payments: [{ paymentMethodCode: "CASH", amount: 1000 }],
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
    };
    const cashSaleResponse = await request("/pos/orders", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: cashSaleBody,
    });
    const cashSaleOperation = await prisma.paymentOperation.findUnique({
      where: { idempotencyKey: "POS_CHECKOUT:" + cashSaleKey },
      select: { orderId: true },
    });
    if (cashSaleOperation) fixture.orderIds.push(cashSaleOperation.orderId);
    assert.equal(cashSaleResponse.status, 201);
    assert.ok(cashSaleOperation, "The cash sale operation must be stored.");
    const cashSaleOrder = await prisma.order.findUnique({
      where: { id: cashSaleOperation.orderId },
      select: {
        id: true,
        type: true,
        source: true,
        paymentStatus: true,
        shiftId: true,
      },
    });
    assert.ok(cashSaleOrder);
    assert.equal(cashSaleOrder.type, "TAKEAWAY");
    assert.equal(cashSaleOrder.source, "POS");
    assert.equal(cashSaleOrder.paymentStatus, "PAID");
    assert.equal(cashSaleOrder.shiftId, cashierShift.id);
    assert.equal(cashSaleResponse.body.data.order.id, cashSaleOrder.id);
    assert.equal(cashSaleResponse.body.data.payment.method, "CASH");
    const receiptDetailsResponse = await request(
      "/receipts/order/" + encodeURIComponent(cashSaleOrder.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(receiptDetailsResponse.status, 200);
    const cashReceipt = receiptDetailsResponse.body.data;
    assert.equal(cashReceipt.orderId, cashSaleOrder.id);
    const reprintJobCountBefore = await prisma.printJob.count({
      where: { receiptId: cashReceipt.id },
    });
    const cashierReprintResponse = await request(
      "/receipts/" + encodeURIComponent(cashReceipt.id) + "/reprint",
      { host: tenantAHost, method: "POST", headers: cashierHeaders },
    );
    assert.equal(cashierReprintResponse.status, 201);
    const cashierReprintJobCount = await prisma.printJob.count({
      where: { receiptId: cashReceipt.id },
    });
    assert.equal(cashierReprintJobCount, reprintJobCountBefore + 1);
    const adminReprintResponse = await request(
      "/receipts/" + encodeURIComponent(cashReceipt.id) + "/reprint",
      {
        host: tenantAHost,
        method: "POST",
        headers: {
          Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
        },
      },
    );
    assert.equal(adminReprintResponse.status, 201);
    assert.equal(
      await prisma.printJob.count({ where: { receiptId: cashReceipt.id } }),
      reprintJobCountBefore + 2,
    );
    const crossTenantReprint = await request(
      "/receipts/" + encodeURIComponent(cashReceipt.id) + "/reprint",
      {
        host: tenantBHost,
        method: "POST",
        headers: {
          Authorization: "Bearer " + loginB.body.data.tokens.accessToken,
        },
      },
    );
    assert.equal(crossTenantReprint.status, 404);

    const cashSaleReplay = await request("/pos/orders", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: cashSaleBody,
    });
    assert.equal(cashSaleReplay.status, 201);
    assert.equal(cashSaleReplay.body.data.order.id, cashSaleOrder.id);
    const historySaleKey = "qa-pos-history-cancel-" + suffix;
    const historySaleBody = {
      idempotencyKey: historySaleKey,
      type: "TAKEAWAY",
      payments: [{ paymentMethodCode: "CASH", amount: 2000 }],
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 2 }],
    };
    const historySaleResponse = await request("/pos/orders", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: historySaleBody,
    });
    const historySaleOperation = await prisma.paymentOperation.findUnique({
      where: { idempotencyKey: "POS_CHECKOUT:" + historySaleKey },
      select: { orderId: true },
    });
    if (historySaleOperation)
      fixture.orderIds.push(historySaleOperation.orderId);
    assert.equal(historySaleResponse.status, 201);
    assert.ok(historySaleOperation);
    const historyCashOrder = await prisma.order.findUnique({
      where: { id: historySaleOperation.orderId },
      select: {
        id: true,
        version: true,
        total: true,
        items: { select: { id: true, quantity: true, productName: true } },
      },
    });
    assert.ok(historyCashOrder);
    assert.equal(historyCashOrder.total.toString(), "2000");
    assert.equal(historyCashOrder.items.length, 1);
    assert.equal(historyCashOrder.items[0].quantity.toString(), "2");
    const cashierOrderDetail = await request(
      "/orders/" + encodeURIComponent(historyCashOrder.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(cashierOrderDetail.status, 200);
    assert.equal(cashierOrderDetail.body.data.items.length, 1);
    const historyItemId = cashierOrderDetail.body.data.items[0].id;
    const historyListPath =
      "/cash-register/shift/" +
      encodeURIComponent(cashierShift.id) +
      "/orders?search=" +
      encodeURIComponent(productA.name) +
      "&sort=amount-high&limit=100&offset=0";
    const cashierHistorySearch = await request(historyListPath, {
      host: tenantAHost,
      headers: cashierHeaders,
    });
    assert.equal(cashierHistorySearch.status, 200);
    assert.equal(cashierHistorySearch.body.data[0].id, historyCashOrder.id);
    assert.ok(
      cashierHistorySearch.body.data.some(
        (order) => order.id === cashSaleOrder.id,
      ),
    );
    const adminShiftDetail = await request(
      "/cash-register/shifts/" + encodeURIComponent(cashierShift.id),
      {
        host: tenantAHost,
        headers: {
          Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
        },
      },
    );
    assert.equal(adminShiftDetail.status, 200);
    assert.equal(adminShiftDetail.body.data.id, cashierShift.id);
    const adminHistorySearch = await request(historyListPath, {
      host: tenantAHost,
      headers: {
        Authorization: "Bearer " + loginA.body.data.tokens.accessToken,
      },
    });
    assert.equal(adminHistorySearch.status, 200);
    assert.ok(
      adminHistorySearch.body.data.some(
        (order) => order.id === historyCashOrder.id,
      ),
    );
    const foreignShiftDetail = await request(
      "/cash-register/shifts/" + encodeURIComponent(cashierShift.id),
      {
        host: tenantBHost,
        headers: {
          Authorization: "Bearer " + loginB.body.data.tokens.accessToken,
        },
      },
    );
    assert.equal(foreignShiftDetail.status, 404);
    const cancelHistoryItemKey = "qa-cancel-history-item-" + suffix;
    const cancelHistoryItemBody = {
      expectedVersion: historyCashOrder.version,
      shiftId: cashierShift.id,
      reasonCode: "CASHIER_ITEM_CANCELLED",
    };
    const cancelHistoryItemPath =
      "/orders/" +
      encodeURIComponent(historyCashOrder.id) +
      "/items/" +
      encodeURIComponent(historyItemId) +
      "/actions/cancel";
    const cancelHistoryItemHeaders = {
      ...cashierHeaders,
      "Idempotency-Key": cancelHistoryItemKey,
    };
    const cancelHistoryItemResponse = await request(cancelHistoryItemPath, {
      host: tenantAHost,
      method: "POST",
      headers: cancelHistoryItemHeaders,
      body: cancelHistoryItemBody,
    });
    assert.equal(cancelHistoryItemResponse.status, 201);
    const cancelHistoryItemReplay = await request(cancelHistoryItemPath, {
      host: tenantAHost,
      method: "POST",
      headers: cancelHistoryItemHeaders,
      body: cancelHistoryItemBody,
    });
    assert.equal(cancelHistoryItemReplay.status, 201);
    assert.equal(cancelHistoryItemReplay.body.data.id, historyCashOrder.id);
    const itemRefunds = await prisma.paymentRefund.findMany({
      where: { orderItemId: historyItemId },
      select: { amount: true, shiftId: true },
    });
    assert.equal(itemRefunds.length, 1);
    assert.equal(itemRefunds[0].amount.toString(), "2000");
    assert.equal(itemRefunds[0].shiftId, cashierShift.id);
    const itemRefundCashRows = await prisma.cashTransaction.findMany({
      where: { orderId: historyCashOrder.id, type: "REFUND" },
      select: { amount: true },
    });
    assert.equal(itemRefundCashRows.length, 1);
    assert.equal(itemRefundCashRows[0].amount.toString(), "2000");
    const itemRefundRevenue = await prisma.revenueRecord.findMany({
      where: { orderId: historyCashOrder.id, source: "ADJUSTMENT" },
      select: { amount: true },
    });
    assert.equal(itemRefundRevenue.length, 1);
    assert.equal(itemRefundRevenue[0].amount.toString(), "-2000");
    const cancelledHistoryItem = await prisma.orderItem.findUnique({
      where: { id: historyItemId },
      select: { status: true, cancellationReason: true },
    });
    assert.equal(cancelledHistoryItem.status, "CANCELLED");
    assert.equal(cancelledHistoryItem.cancellationReason, null);
    const cancelledHistoryOrders = await request(
      "/cash-register/shift/" +
        encodeURIComponent(cashierShift.id) +
        "/orders?status=CANCELLED&limit=100&offset=0",
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(cancelledHistoryOrders.status, 200);
    assert.deepEqual(
      cancelledHistoryOrders.body.data.map((order) => order.id),
      [payLaterOrder.id],
    );
    const cashierShiftDetail = await request(
      "/cash-register/shifts/" + encodeURIComponent(cashierShift.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(cashierShiftDetail.status, 200);
    assert.equal(cashierShiftDetail.body.data.id, cashierShift.id);
    const cashSalePayments = await prisma.payment.findMany({
      where: { orderId: cashSaleOrder.id },
      select: { id: true, amount: true, status: true, methodCode: true },
    });
    assert.equal(cashSalePayments.length, 1);
    assert.equal(cashSalePayments[0].amount.toString(), "1000");
    assert.equal(cashSalePayments[0].status, "SUCCESS");
    assert.equal(cashSalePayments[0].methodCode, "CASH");
    const cashSaleRevenue = await prisma.revenueRecord.findMany({
      where: { orderId: cashSaleOrder.id },
      select: { amount: true, shiftId: true, source: true, paymentId: true },
    });
    assert.equal(cashSaleRevenue.length, 1);
    assert.equal(cashSaleRevenue[0].amount.toString(), "1000");
    assert.equal(cashSaleRevenue[0].shiftId, cashierShift.id);
    assert.equal(cashSaleRevenue[0].source, "ORDER");
    assert.equal(cashSaleRevenue[0].paymentId, cashSalePayments[0].id);
    const cashSaleTransactions = await prisma.cashTransaction.findMany({
      where: { orderId: cashSaleOrder.id },
      select: { type: true, amount: true, shiftId: true, paymentId: true },
    });
    assert.equal(cashSaleTransactions.length, 1);
    assert.equal(cashSaleTransactions[0].type, "SALE");
    assert.equal(cashSaleTransactions[0].amount.toString(), "1000");
    assert.equal(cashSaleTransactions[0].shiftId, cashierShift.id);
    assert.equal(cashSaleTransactions[0].paymentId, cashSalePayments[0].id);
    const cashSaleReceipts = await prisma.receipt.findMany({
      where: { orderId: cashSaleOrder.id },
      select: { documentType: true },
    });
    assert.deepEqual(
      cashSaleReceipts.map((receipt) => receipt.documentType).sort(),
      ["KITCHEN", "RECEIPT"],
    );
    assert.equal(
      await prisma.paymentOperation.count({
        where: { orderId: cashSaleOrder.id },
      }),
      1,
    );
    const shiftListResponse = await request(
      "/shifts?branchId=" + encodeURIComponent(branchA.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(shiftListResponse.status, 200);
    const liveCashierShift = shiftListResponse.body.data.find(
      (shift) => shift.id === cashierShift.id,
    );
    assert.ok(liveCashierShift);
    assert.equal(Number(liveCashierShift.currentCash), 1000);
    assert.equal(liveCashierShift.orderCount, 3);
    const refundBody = {
      idempotencyKey: "qa-cash-refund-" + suffix,
      shiftId: cashierShift.id,
      amount: 400,
      reason: "QA staging partial refund",
    };
    const refundResponse = await request(
      "/payments/" + cashSalePayments[0].id + "/refund",
      {
        host: tenantAHost,
        method: "POST",
        headers: cashierHeaders,
        body: refundBody,
      },
    );
    assert.equal(refundResponse.status, 201);
    const refundReplay = await request(
      "/payments/" + cashSalePayments[0].id + "/refund",
      {
        host: tenantAHost,
        method: "POST",
        headers: cashierHeaders,
        body: refundBody,
      },
    );
    assert.equal(refundReplay.status, 201);
    assert.equal(refundReplay.body.data.id, refundResponse.body.data.id);
    const refunds = await prisma.paymentRefund.findMany({
      where: { paymentId: cashSalePayments[0].id },
      select: { amount: true, shiftId: true, idempotencyKey: true },
    });
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].amount.toString(), "400");
    assert.equal(refunds[0].shiftId, cashierShift.id);
    const refundedPayment = await prisma.payment.findUnique({
      where: { id: cashSalePayments[0].id },
      select: { status: true },
    });
    assert.equal(refundedPayment.status, "PARTIALLY_REFUNDED");
    const refundedOrder = await prisma.order.findUnique({
      where: { id: cashSaleOrder.id },
      select: { paymentStatus: true },
    });
    assert.equal(refundedOrder.paymentStatus, "PENDING");
    const postRefundTransactions = await prisma.cashTransaction.findMany({
      where: { orderId: cashSaleOrder.id },
      select: { type: true, amount: true },
    });
    assert.deepEqual(
      postRefundTransactions
        .map((row) => [row.type, row.amount.toString()])
        .sort(),
      [
        ["REFUND", "400"],
        ["SALE", "1000"],
      ],
    );
    const postRefundRevenue = await prisma.revenueRecord.findMany({
      where: { orderId: cashSaleOrder.id },
      select: { source: true, amount: true },
    });
    assert.deepEqual(
      postRefundRevenue
        .map((row) => [row.source, row.amount.toString()])
        .sort(),
      [
        ["ADJUSTMENT", "-400"],
        ["ORDER", "1000"],
      ],
    );
    assert.equal(
      await prisma.receipt.count({
        where: {
          orderId: cashSaleOrder.id,
          documentType: { startsWith: "REFUND:" },
        },
      }),
      1,
    );
    const refundedShiftResponse = await request(
      "/shifts?branchId=" + encodeURIComponent(branchA.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    const refundedShift = refundedShiftResponse.body.data.find(
      (shift) => shift.id === cashierShift.id,
    );
    assert.equal(refundedShiftResponse.status, 200);
    assert.equal(Number(refundedShift.currentCash), 600);
    const shiftOrdersBeforeCloseResponse = await request(
      "/cash-register/shift/" +
        encodeURIComponent(cashierShift.id) +
        "/orders?limit=100&offset=0",
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(shiftOrdersBeforeCloseResponse.status, 200);
    const shiftOrderIdsBeforeClose = new Set(
      shiftOrdersBeforeCloseResponse.body.data.map((order) => order.id),
    );
    assert.deepEqual(
      shiftOrderIdsBeforeClose,
      new Set([
        payLaterOperation.orderId,
        cashSaleOrder.id,
        historyCashOrder.id,
      ]),
    );

    const legacySale = await prisma.cashTransaction.create({
      data: {
        branchId: branchA.id,
        shiftId: cashierShift.id,
        employeeId: fixture.employeeIds[0],
        type: "SALE",
        amount: 125,
      },
    });
    assert.equal(legacySale.orderId, null);
    assert.equal(legacySale.paymentId, null);
    const currentCashWithLegacySaleResponse = await request(
      "/shifts?branchId=" + encodeURIComponent(branchA.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    const currentCashWithLegacySale =
      currentCashWithLegacySaleResponse.body.data.find(
        (shift) => shift.id === cashierShift.id,
      );
    assert.equal(currentCashWithLegacySaleResponse.status, 200);
    assert.equal(Number(currentCashWithLegacySale.currentCash), 725);

    const closeShiftKey = "qa-shift-close-" + suffix;
    const closeShiftHeaders = {
      ...cashierHeaders,
      "Idempotency-Key": closeShiftKey,
    };
    const closeShiftBody = { closingBalance: 725 };
    const closeShiftResponse = await request(
      "/shifts/" + cashierShift.id + "/close",
      {
        host: tenantAHost,
        method: "POST",
        headers: closeShiftHeaders,
        body: closeShiftBody,
      },
    );
    assert.equal(closeShiftResponse.status, 201);
    assert.equal(closeShiftResponse.body.data.id, cashierShift.id);
    assert.equal(closeShiftResponse.body.data.status, "CLOSED");
    const closeShiftReplay = await request(
      "/shifts/" + cashierShift.id + "/close",
      {
        host: tenantAHost,
        method: "POST",
        headers: closeShiftHeaders,
        body: closeShiftBody,
      },
    );
    assert.equal(closeShiftReplay.status, 201);
    assert.equal(closeShiftReplay.body.data.id, cashierShift.id);
    const closedShiftRecord = await prisma.shift.findUnique({
      where: { id: cashierShift.id },
      select: {
        status: true,
        closingBalance: true,
        expectedCash: true,
        cashDifference: true,
        salesTotal: true,
        cashTotal: true,
        refundsTotal: true,
        orderCount: true,
      },
    });
    assert.ok(closedShiftRecord);
    assert.equal(closedShiftRecord.status, "CLOSED");
    assert.equal(closedShiftRecord.closingBalance.toString(), "725");
    assert.equal(closedShiftRecord.expectedCash.toString(), "725");
    assert.equal(closedShiftRecord.cashDifference.toString(), "0");
    assert.equal(closedShiftRecord.salesTotal.toString(), "3125");
    assert.equal(closedShiftRecord.cashTotal.toString(), "3125");
    assert.equal(closedShiftRecord.refundsTotal.toString(), "2400");
    assert.equal(closedShiftRecord.orderCount, 3);
    assert.equal(
      await prisma.cashTransaction.count({
        where: {
          shiftId: cashierShift.id,
          type: "CLOSING_BALANCE",
        },
      }),
      1,
    );
    const shiftOrdersAfterCloseResponse = await request(
      "/cash-register/shift/" +
        encodeURIComponent(cashierShift.id) +
        "/orders?limit=100&offset=0",
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(shiftOrdersAfterCloseResponse.status, 200);
    assert.deepEqual(
      new Set(shiftOrdersAfterCloseResponse.body.data.map((order) => order.id)),
      shiftOrderIdsBeforeClose,
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

    const webOrderKey = "qa-web-cash-order-" + suffix;
    const webOrderBody = {
      idempotencyKey: webOrderKey,
      branchId: branchA.id,
      type: "PICKUP",
      paymentMethod: "CASH",
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
    };
    const customerAHeaders = {
      Authorization: "Bearer " + customerA.body.data.tokens.accessToken,
    };
    const webOrderResponse = await request("/customer/orders", {
      host: tenantAHost,
      method: "POST",
      headers: customerAHeaders,
      body: webOrderBody,
    });
    assert.equal(webOrderResponse.status, 201);
    const webOrderId = webOrderResponse.body.data.order.id;
    assert.equal(typeof webOrderId, "string");
    fixture.orderIds.push(webOrderId);
    const webOrderReplay = await request("/customer/orders", {
      host: tenantAHost,
      method: "POST",
      headers: customerAHeaders,
      body: webOrderBody,
    });
    assert.equal(webOrderReplay.status, 201);
    assert.equal(webOrderReplay.body.data.order.id, webOrderId);
    assert.equal(
      await prisma.customerOrder.count({ where: { orderId: webOrderId } }),
      1,
    );
    assert.equal(
      await prisma.customerOrderAttempt.count({
        where: { customerId: customerA.body.data.customer.id },
      }),
      1,
    );
    const webCustomerOrder = await prisma.customerOrder.findUnique({
      where: { orderId: webOrderId },
      select: { type: true, paymentMethod: true },
    });
    assert.equal(webCustomerOrder.type, "PICKUP");
    assert.equal(webCustomerOrder.paymentMethod, "CASH");
    const webOrderRecord = await prisma.order.findUnique({
      where: { id: webOrderId },
      select: {
        id: true,
        source: true,
        status: true,
        paymentStatus: true,
        total: true,
      },
    });
    assert.ok(webOrderRecord);
    assert.equal(webOrderRecord.source, "WEB");
    assert.equal(webOrderRecord.total.toString(), "1000");
    assert.equal(webOrderRecord.paymentStatus, "PENDING");
    assert.equal(
      await prisma.kitchenTicket.count({ where: { orderId: webOrderId } }),
      1,
    );
    assert.ok(
      (
        await readKitchenOrderIds(
          tenantAHost,
          socketLoginA.body.data.tokens.accessToken,
        )
      ).includes(webOrderId),
      "An online WEB order must appear in the kitchen while POS tickets stay hidden.",
    );
    assert.equal(
      await prisma.payment.count({ where: { orderId: webOrderId } }),
      0,
    );
    assert.equal(
      await prisma.revenueRecord.count({ where: { orderId: webOrderId } }),
      0,
    );
    assert.equal(
      await prisma.cashTransaction.count({ where: { orderId: webOrderId } }),
      0,
    );

    const webShiftOpen = await request("/shifts/open", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: { branchId: branchA.id, openingBalance: 0 },
    });
    assert.equal(webShiftOpen.status, 201);
    const webShift = await prisma.shift.findFirst({
      where: {
        branchId: branchA.id,
        employeeId: fixture.employeeIds[0],
        status: "OPEN",
      },
      orderBy: { openedAt: "desc" },
    });
    assert.ok(webShift);
    fixture.shiftIds.push(webShift.id);
    const webOrderTotal = Number(webOrderRecord.total);
    const webPaymentKey = "qa-web-cash-payment-" + suffix;
    const webPaymentBody = {
      orderId: webOrderId,
      idempotencyKey: webPaymentKey,
      shiftId: webShift.id,
      payments: [{ paymentMethodCode: "CASH", amount: webOrderTotal }],
    };
    const webPaymentResponse = await request("/payments/process", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: webPaymentBody,
    });
    assert.equal(webPaymentResponse.status, 201);
    const webPaymentReplay = await request("/payments/process", {
      host: tenantAHost,
      method: "POST",
      headers: cashierHeaders,
      body: webPaymentBody,
    });
    assert.equal(webPaymentReplay.status, 201);
    const webPaymentRecord = await prisma.payment.findMany({
      where: { orderId: webOrderId },
      select: { id: true, amount: true, status: true },
    });
    assert.equal(webPaymentRecord.length, 1);
    assert.equal(webPaymentRecord[0].amount.toString(), String(webOrderTotal));
    assert.equal(webPaymentRecord[0].status, "SUCCESS");
    assert.equal(
      await prisma.paymentOperation.count({ where: { orderId: webOrderId } }),
      1,
    );
    const webRevenue = await prisma.revenueRecord.findMany({
      where: { orderId: webOrderId },
      select: { amount: true, shiftId: true, source: true },
    });
    assert.equal(webRevenue.length, 1);
    assert.equal(webRevenue[0].amount.toString(), String(webOrderTotal));
    assert.equal(webRevenue[0].shiftId, webShift.id);
    assert.equal(webRevenue[0].source, "ORDER");
    const webCashRows = await prisma.cashTransaction.findMany({
      where: { orderId: webOrderId },
      select: { amount: true, shiftId: true, type: true },
    });
    assert.equal(webCashRows.length, 1);
    assert.equal(webCashRows[0].amount.toString(), String(webOrderTotal));
    assert.equal(webCashRows[0].shiftId, webShift.id);
    assert.equal(webCashRows[0].type, "SALE");
    const paidWebOrder = await prisma.order.findUnique({
      where: { id: webOrderId },
      select: { paymentStatus: true },
    });
    assert.equal(paidWebOrder.paymentStatus, "PAID");
    assert.ok(
      (
        await readKitchenOrderIds(
          tenantAHost,
          socketLoginA.body.data.tokens.accessToken,
        )
      ).includes(webOrderId),
      "Cash payment must not hide the online order from kitchen.",
    );
    const webShiftSummaryResponse = await request(
      "/shifts?branchId=" + encodeURIComponent(branchA.id),
      { host: tenantAHost, headers: cashierHeaders },
    );
    assert.equal(webShiftSummaryResponse.status, 200);
    const webShiftSummary = webShiftSummaryResponse.body.data.find(
      (shift) => shift.id === webShift.id,
    );
    assert.equal(Number(webShiftSummary.currentCash), webOrderTotal);
    const webShiftCloseKey = "qa-web-shift-close-" + suffix;
    const webShiftCloseHeaders = {
      ...cashierHeaders,
      "Idempotency-Key": webShiftCloseKey,
    };
    const webShiftCloseBody = { closingBalance: webOrderTotal };
    const webShiftCloseResponse = await request(
      "/shifts/" + webShift.id + "/close",
      {
        host: tenantAHost,
        method: "POST",
        headers: webShiftCloseHeaders,
        body: webShiftCloseBody,
      },
    );
    assert.equal(webShiftCloseResponse.status, 201);
    const webShiftCloseReplay = await request(
      "/shifts/" + webShift.id + "/close",
      {
        host: tenantAHost,
        method: "POST",
        headers: webShiftCloseHeaders,
        body: webShiftCloseBody,
      },
    );
    assert.equal(webShiftCloseReplay.status, 201);
    const closedWebShift = await prisma.shift.findUnique({
      where: { id: webShift.id },
      select: {
        status: true,
        expectedCash: true,
        cashDifference: true,
        cashTotal: true,
        orderCount: true,
      },
    });
    assert.equal(closedWebShift.status, "CLOSED");
    assert.equal(closedWebShift.expectedCash.toString(), String(webOrderTotal));
    assert.equal(closedWebShift.cashDifference.toString(), "0");
    assert.equal(closedWebShift.cashTotal.toString(), String(webOrderTotal));
    assert.equal(closedWebShift.orderCount, 1);
    assert.equal(
      await prisma.cashTransaction.count({
        where: { shiftId: webShift.id, type: "CLOSING_BALANCE" },
      }),
      1,
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
      tenantAHost,
      customerA.body.data.tokens.accessToken,
      "customer",
    );
    const customerSocketB = await connectStaffSocket(
      tenantBHost,
      customerB.body.data.tokens.accessToken,
      "customer",
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
      tenantAHost,
      customerA.body.data.tokens.accessToken,
      "customer",
    );
    assert.equal(revokedCustomerReconnect.connected, false);

    console.log(
      "Staging A/B proof passed: tenant membership/cache separation, order mutation and cancellation, WEB cash order replay/settlement, immediate POS cash sale and partial refund, shift-close totals, kitchen source visibility, live order delivery/reconnect, customer logout revocation, host/domain, reports/audit, OTP sessions, and tenant media isolation.",
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
          await prisma.auditLog.deleteMany({
            where: { userId: { in: fixture.userIds } },
          });
        }
        const fixtureCustomers = await prisma.customer.findMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
          select: { id: true },
        });
        if (fixtureCustomers.length) {
          await prisma.customerOrder.deleteMany({
            where: { customerId: { in: fixtureCustomers.map(({ id }) => id) } },
          });
        }
        await prisma.customer.deleteMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
        });
        await prisma.customerVerificationChallenge.deleteMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
        });
        if (fixture.branchIds.length) {
          const operations = await prisma.paymentOperation.findMany({
            where: { order: { branchId: { in: fixture.branchIds } } },
            select: { orderId: true },
          });
          fixture.orderIds = [
            ...new Set([
              ...fixture.orderIds,
              ...operations.map((row) => row.orderId),
            ]),
          ];
          if (fixture.orderIds.length) {
            await prisma.notificationOutbox.deleteMany({
              where: {
                tenantId: { in: tenantIds },
                orderId: { in: fixture.orderIds },
              },
            });
          }
          const shifts = await prisma.shift.findMany({
            where: {
              branchId: { in: fixture.branchIds },
              employeeId: { in: fixture.employeeIds },
            },
            select: { id: true },
          });
          fixture.shiftIds = [
            ...new Set([...fixture.shiftIds, ...shifts.map((row) => row.id)]),
          ];
        }
        if (fixture.shiftIds.length) {
          await prisma.paymentRefund.deleteMany({
            where: { shiftId: { in: fixture.shiftIds } },
          });
        }
        if (fixture.orderIds.length) {
          await prisma.printJob.deleteMany({
            where: { receipt: { orderId: { in: fixture.orderIds } } },
          });
          await prisma.receipt.deleteMany({
            where: { orderId: { in: fixture.orderIds } },
          });
          await prisma.revenueRecord.deleteMany({
            where: {
              OR: [
                { orderId: { in: fixture.orderIds } },
                { shiftId: { in: fixture.shiftIds } },
              ],
            },
          });
          await prisma.cashTransaction.deleteMany({
            where: {
              OR: [
                { orderId: { in: fixture.orderIds } },
                { shiftId: { in: fixture.shiftIds } },
              ],
            },
          });
          await prisma.payment.deleteMany({
            where: { orderId: { in: fixture.orderIds } },
          });
          await prisma.paymentOperation.deleteMany({
            where: { orderId: { in: fixture.orderIds } },
          });
        }
        if (fixture.orderIds.length) {
          await prisma.outboxEvent.deleteMany({
            where: {
              aggregateType: "ORDER",
              aggregateId: { in: fixture.orderIds },
            },
          });
          await prisma.orderEvent.deleteMany({
            where: { orderId: { in: fixture.orderIds } },
          });
          await prisma.order.deleteMany({
            where: { id: { in: fixture.orderIds } },
          });
        }
        if (fixture.shiftIds.length) {
          await prisma.shift.deleteMany({
            where: { id: { in: fixture.shiftIds } },
          });
        }
        await prisma.setting.deleteMany({
          where: { tenantId: { in: tenantIds }, key: DELIVERY_SETTING },
        });
        await prisma.setting.deleteMany({
          where: { tenantId: { in: tenantIds }, key: KITCHEN_POS_SETTING },
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
          await prisma.device.deleteMany({
            where: { id: { in: fixture.deviceIds } },
          });
        }
        if (fixture.recipeIds.length)
          await prisma.recipe.deleteMany({
            where: { id: { in: fixture.recipeIds } },
          });
        if (fixture.heroSlideIds.length)
          await prisma.homepageHeroSlide.deleteMany({
            where: { id: { in: fixture.heroSlideIds } },
          });
        if (fixture.promotionIds.length)
          await prisma.promotion.deleteMany({
            where: { id: { in: fixture.promotionIds } },
          });
        if (fixture.paymentMethodIds.length) {
          await prisma.paymentMethod.deleteMany({
            where: { id: { in: fixture.paymentMethodIds } },
          });
        }
        if (fixture.variantIds.length)
          await prisma.productVariant.deleteMany({
            where: { id: { in: fixture.variantIds } },
          });
        if (fixture.productIds.length)
          await prisma.product.deleteMany({
            where: { id: { in: fixture.productIds } },
          });
        if (fixture.categoryIds.length)
          await prisma.category.deleteMany({
            where: { id: { in: fixture.categoryIds } },
          });
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
          await prisma.role.deleteMany({
            where: { id: fixture.tenantAOnlyRoleId },
          });
        if (fixture.permissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.permissionId },
          });
        if (fixture.catalogPermissionIds.length) {
          await prisma.permission.deleteMany({
            where: { id: { in: fixture.catalogPermissionIds } },
          });
        }
        if (fixture.uploadPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.uploadPermissionId },
          });
        if (fixture.realtimePermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.realtimePermissionId },
          });
        if (fixture.auditPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.auditPermissionId },
          });
        if (fixture.reportPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.reportPermissionId },
          });
        if (fixture.orderCreatePermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.orderCreatePermissionId },
          });
        if (fixture.orderMutationPermissionIds.length)
          await prisma.permission.deleteMany({
            where: { id: { in: fixture.orderMutationPermissionIds } },
          });
        if (fixture.receiptPermissionIds.length) {
          await prisma.permission.deleteMany({
            where: { id: { in: fixture.receiptPermissionIds } },
          });
        }
        if (fixture.kitchenViewPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.kitchenViewPermissionId },
          });
        if (fixture.posUsePermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.posUsePermissionId },
          });
        if (fixture.shiftOpenPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.shiftOpenPermissionId },
          });
        if (fixture.shiftViewPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.shiftViewPermissionId },
          });
        if (fixture.paymentRefundPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.paymentRefundPermissionId },
          });
        if (fixture.shiftClosePermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.shiftClosePermissionId },
          });
        if (fixture.paymentCreatePermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.paymentCreatePermissionId },
          });
        if (fixture.tenantAOnlyPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.tenantAOnlyPermissionId },
          });
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
          prisma.shift.count(),
          prisma.cashTransaction.count(),
          prisma.paymentMethod.count(),
          prisma.payment.count(),
          prisma.paymentRefund.count(),
          prisma.paymentOperation.count(),
          prisma.revenueRecord.count(),
          prisma.receipt.count(),
          prisma.printJob.count(),
          prisma.auditLog.count(),
        ]);
        assert.deepEqual(
          remaining,
          [
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            fixture.auditBaselineCount,
          ],
          "All staging fixtures must be removed.",
        );
        assert.equal(await prisma.customerOrder.count(), 0);
        assert.equal(await prisma.customerOrderAttempt.count(), 0);
        assert.equal(
          await prisma.notificationOutbox.count(),
          fixture.notificationOutboxBaselineCount,
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
