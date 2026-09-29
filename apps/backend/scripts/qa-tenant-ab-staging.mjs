import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { Pool } from "pg";
import { URL } from "node:url";
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
  const email = `qa-ab-${suffix}@bestteam.invalid`;
  const password = randomBytes(24).toString("base64url");
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const fixture = {
    tenantAId: null,
    tenantBId: null,
    branchIds: [],
    domainIds: [],
    userId: null,
    roleId: null,
    permissionId: null,
    membershipIds: [],
    mediaObjects: [],
    uploadPermissionId: null,
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
      userCount,
      membershipCount,
      domainCount,
      customerCount,
      challengeCount,
      settingCount,
      roleCount,
      permissionCount,
    ] = await Promise.all([
      prisma.restaurantTenant.count(),
      prisma.branch.count(),
      prisma.user.count(),
      prisma.tenantMembership.count(),
      prisma.tenantDomain.count(),
      prisma.customer.count(),
      prisma.customerVerificationChallenge.count(),
      prisma.setting.count(),
      prisma.role.count(),
      prisma.permission.count(),
    ]);
    assert.deepEqual(
      {
        tenantCount,
        branchCount,
        userCount,
        membershipCount,
        domainCount,
        customerCount,
        challengeCount,
        settingCount,
        roleCount,
        permissionCount,
      },
      {
        tenantCount: 1,
        branchCount: 0,
        userCount: 0,
        membershipCount: 0,
        domainCount: 0,
        customerCount: 0,
        challengeCount: 0,
        settingCount: 0,
        roleCount: 0,
        permissionCount: 0,
      },
      "Staging must be an empty baseline before the disposable A/B fixture is created.",
    );
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
    const uploadPermission = await prisma.permission.create({
      data: { code: "MENU_EDIT", name: "Disposable staging media upload" },
    });
    fixture.uploadPermissionId = uploadPermission.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: uploadPermission.id },
    });

    const user = await prisma.user.create({
      data: { email, passwordHash: await hash(password, 10), isActive: true },
    });
    fixture.userId = user.id;
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    for (const tenantId of [tenantA.id, tenantB.id]) {
      const membership = await prisma.tenantMembership.create({
        data: { tenantId, userId: user.id, status: "ACTIVE" },
      });
      fixture.membershipIds.push(membership.id);
      await prisma.tenantMembershipRole.create({
        data: { membershipId: membership.id, roleId: role.id },
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

    const health = await request("/health");
    assert.equal(
      health.status,
      200,
      "The staging API must be healthy before A/B checks.",
    );

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

    const login = async (host) =>
      request("/auth/login", {
        host,
        method: "POST",
        body: { identifier: email, password },
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

    console.log(
      "Staging A/B proof passed: host/domain, branch/settings/auth, OTP/customer sessions, and tenant-prefixed media uploads.",
    );
  } catch (error) {
    failure = error;
  } finally {
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
        await prisma.customer.deleteMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
        });
        await prisma.customerVerificationChallenge.deleteMany({
          where: { tenantId: { in: tenantIds }, phone: SHARED_PHONE },
        });
        await prisma.setting.deleteMany({
          where: { tenantId: { in: tenantIds }, key: DELIVERY_SETTING },
        });
        if (fixture.userId) {
          await prisma.tenantMembership.deleteMany({
            where: { userId: fixture.userId },
          });
          await prisma.userRole.deleteMany({
            where: { userId: fixture.userId },
          });
          await prisma.user.deleteMany({ where: { id: fixture.userId } });
        }
        if (fixture.domainIds.length) {
          await prisma.tenantDomain.deleteMany({
            where: { id: { in: fixture.domainIds } },
          });
        }
        if (fixture.branchIds.length) {
          await prisma.branch.deleteMany({
            where: { id: { in: fixture.branchIds } },
          });
        }
        if (fixture.roleId)
          await prisma.role.deleteMany({ where: { id: fixture.roleId } });
        if (fixture.permissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.permissionId },
          });
        if (fixture.uploadPermissionId)
          await prisma.permission.deleteMany({
            where: { id: fixture.uploadPermissionId },
          });
        if (fixture.tenantBId) {
          await prisma.restaurantTenant.deleteMany({
            where: { id: fixture.tenantBId },
          });
        }
        const remaining = await Promise.all([
          prisma.restaurantTenant.count(),
          prisma.branch.count(),
          prisma.user.count(),
          prisma.tenantMembership.count(),
          prisma.tenantDomain.count(),
          prisma.customer.count(),
          prisma.customerVerificationChallenge.count(),
          prisma.setting.count(),
          prisma.role.count(),
          prisma.permission.count(),
        ]);
        assert.deepEqual(
          remaining,
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
