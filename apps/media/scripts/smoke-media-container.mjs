import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const tempRoot = mkdtempSync(path.join(tmpdir(), "mazetto-media-smoke-"));
const imageTag = "mazetto-media:upload-smoke";
const uploadName = "00000000-0000-4000-8000-000000000001.png";
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64",
);
let containerId = "";
let baseUrl = "";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

async function status(url, options = {}) {
  const response = await fetch(url, options);
  await response.body?.cancel();
  return response.status;
}

try {
  run("node", ["apps/media/scripts/prepare-media-release.mjs", "--target", tempRoot]);
  run("docker", ["build", "-f", "apps/media/Dockerfile", "-t", imageTag, "."], {
    stdio: "ignore",
  });
  containerId = run("docker", [
    "run",
    "-d",
    "-p",
    "127.0.0.1::80",
    "-v",
    tempRoot + ":/media",
    imageTag,
  ]).trim();
  const portBinding = run("docker", ["port", containerId, "80/tcp"]).trim();
  const hostPort = portBinding.match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!hostPort) throw new Error("Docker host port could not be resolved: " + portBinding);
  baseUrl = "http://127.0.0.1:" + hostPort;

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const running = run("docker", [
    "inspect",
    "--format",
    "{{.State.Running}}",
    containerId,
  ]).trim();

  if (running !== "true") {
    const logResult = spawnSync("docker", ["logs", containerId], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const state = run("docker", [
      "inspect",
      "--format",
      "{{json .State}}",
      containerId,
    ]);
    const logs =
      String(logResult.stdout ?? "") + String(logResult.stderr ?? "");
    throw new Error(
      "Media container ishga tushmadi. State: " + state + " Logs: " + logs,
    );
  }

  const uploadUrl =
    baseUrl + "/__upload/products/" + uploadName;
  const uploadStatus = await status(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: tinyPng,
  });

  console.log("private_upload=" + uploadStatus);
  if (uploadStatus !== 201 && uploadStatus !== 204) {
    throw new Error("private upload expected 201 or 204, got " + uploadStatus);
  }

  const tenantUploadName = "00000000-0000-4000-8000-000000000002.png";
  const tenantUploadUrl =
    baseUrl + "/__upload/tenants/audit_tenant/products/" +
    tenantUploadName;
  const tenantUploadStatus = await status(tenantUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: tinyPng,
  });

  console.log("tenant_private_upload=" + tenantUploadStatus);
  if (tenantUploadStatus !== 201 && tenantUploadStatus !== 204) {
    throw new Error(
      "tenant upload expected 201 or 204, got " + tenantUploadStatus,
    );
  }

  const blockedStatus = await status(
    baseUrl + "/__upload/tenants/audit_tenant/products/00000000-0000-4000-8000-000000000003.png",
    {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        "CF-Ray": "external-request",
      },
      body: tinyPng,
    },
  );

  console.log("external_upload=" + blockedStatus);
  if (blockedStatus !== 403) {
    throw new Error("external upload expected 403, got " + blockedStatus);
  }

  const checks = [
    ["health", baseUrl + "/healthz", 204],
    ["uploaded_product", baseUrl + "/products/" + uploadName, 200],
    ["uploaded_tenant_product", baseUrl + "/tenants/audit_tenant/products/" + tenantUploadName, 200],
    ["category_lavash", baseUrl + "/categories/lavash.webp", 200],
    ["product_big_lavash", baseUrl + "/products/big-lavash.webp", 200],
    ["missing_file", baseUrl + "/products/not-found.webp", 404],
  ];

  for (const [name, url, expected] of checks) {
    const actual = await status(url);
    console.log(name + "=" + actual);
    if (actual !== expected) {
      throw new Error(name + " expected " + expected + ", got " + actual);
    }
  }

  console.log("Mazetto media upload smoke passed");
} finally {
  if (containerId) {
    spawnSync("docker", ["rm", "-f", containerId], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  }
  spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      tempRoot + ":/media",
      "--entrypoint",
      "sh",
      imageTag,
      "-c",
      "chown -R 0:0 /media && chmod -R u+rwX /media",
    ],
    { cwd: repoRoot, stdio: "ignore" },
  );
  try {
    rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    // GitHub runner vaqtinchalik katalogni job tugagach o'zi tozalaydi.
  }
}