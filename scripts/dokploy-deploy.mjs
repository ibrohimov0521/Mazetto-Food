#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

/*
 * O'zgargan ilovalarni Dokploy API orqali deploy qiladi va har birining
 * tugashini kutadi.
 *
 * FAQAT QO'LDA. Avval buni .github/workflows/deploy.yml chaqirardi; o'sha
 * workflow olib tashlandi va production'ga endi faqat reliz egasi o'z
 * mashinasidan chiqaradi (docs/RELEASE_RULES.md):
 *
 *   DOKPLOY_URL=https://... DOKPLOY_API_KEY=... DOKPLOY_APP_BACKEND=<id> \
 *     node scripts/dokploy-deploy.mjs --sha <to'liq sha> backend pos-web
 *
 * Ilovalar NAVBAT bilan deploy qilinadi, backend birinchi — web'lar uning
 * API'siga tayanadi.
 *
 * Dokploy aniq commit'ni emas, branch'ning O'SHA PAYTDAGI uchini yig'adi.
 * Shuning uchun har ilovadan oldin `main` hamon shu commit'da ekani
 * tekshiriladi va oldinga ketgan bo'lsa to'xtaydi: aks holda CI'si hali
 * tugamagan kod chiqib ketardi. Yangi commit o'z CI'sidan keyin baribir
 * deploy qilinadi.
 */

const ORDER = ["backend", "customer-web", "pos-web", "telegram-bot", "media"];

const APP_ID_ENV = {
  backend: "DOKPLOY_APP_BACKEND",
  "customer-web": "DOKPLOY_APP_CUSTOMER_WEB",
  "pos-web": "DOKPLOY_APP_POS_WEB",
  "telegram-bot": "DOKPLOY_APP_TELEGRAM_BOT",
  media: "DOKPLOY_APP_MEDIA",
};

// Restoran kompyuterida ishlaydi — Dokploy uni hech qachon deploy qilmaydi.
const ON_PREMISE = ["print-agent"];

const POLL_MS = Number(process.env.DOKPLOY_POLL_MS ?? 10000);
const APP_TIMEOUT_MS = Number(process.env.DOKPLOY_APP_TIMEOUT_MS ?? 1200000);

/*
 * Xato `process.exit()` bilan emas, istisno bilan qaytariladi: Windows'da
 * ochiq fetch ulanishi turganda `process.exit()` Node'ni qulatadi
 * (scripts/release-gate.mjs dagi izoh).
 */
class DeployFailed extends Error {}

const baseUrl = (process.env.DOKPLOY_URL ?? "").replace(/\/+$/, "");
const apiKey = process.env.DOKPLOY_API_KEY ?? "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendTo(fileEnv, line) {
  if (process.env[fileEnv]) {
    appendFileSync(process.env[fileEnv], `${line}\n`);
  }
}

const output = (key, value) => appendTo("GITHUB_OUTPUT", `${key}=${value}`);
const summary = (line) => appendTo("GITHUB_STEP_SUMMARY", line);

function git(...gitArgs) {
  return execFileSync("git", gitArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function mainHead() {
  try {
    return git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
  } catch {
    throw new DeployFailed("origin'dagi main uchini o'qib bo'lmadi");
  }
}

async function dokploy(method, path, body) {
  let response;

  try {
    response = await fetch(`${baseUrl}/api/${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new DeployFailed(
      `Dokploy'ga ulanib bo'lmadi (${path}): ${error.cause?.code ?? error.message}`,
    );
  }

  const text = await response.text();

  if (!response.ok) {
    throw new DeployFailed(
      `Dokploy ${path} → ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  // `application.deploy` hech narsa qaytarmaydi.
  if (text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new DeployFailed(
      `Dokploy ${path} JSON qaytarmadi — DOKPLOY_URL to'g'rimi?`,
    );
  }
}

async function deploymentsOf(applicationId) {
  const list = await dokploy(
    "GET",
    `deployment.all?applicationId=${encodeURIComponent(applicationId)}`,
  );

  if (!Array.isArray(list)) {
    throw new DeployFailed(
      "deployment.all ro'yxat qaytarmadi — Dokploy versiyasi mos emasmi?",
    );
  }

  return list;
}

async function deployAndWait(app, applicationId, sha, subject) {
  /*
   * Yangi deploy yozuvi eskilaridan ID bo'yicha ajratiladi, vaqt bo'yicha
   * EMAS: runner va Dokploy server soatlari bir-biridan farq qilishi mumkin.
   */
  const before = new Set(
    (await deploymentsOf(applicationId)).map((item) => item.deploymentId),
  );

  await dokploy("POST", "application.deploy", {
    applicationId,
    title: `CI ${sha.slice(0, 7)}`,
    description: subject,
  });

  const deadline = Date.now() + APP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_MS);

    // `application.deploy` faqat navbatga qo'yadi: yozuv worker ishni
    // boshlagandagina paydo bo'ladi.
    const [latest] = (await deploymentsOf(applicationId))
      .filter((item) => !before.has(item.deploymentId))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    if (!latest || latest.status === "running") {
      continue;
    }

    if (latest.status === "done") {
      return;
    }

    throw new DeployFailed(
      `${app}: Dokploy deploy "${latest.status}" bilan tugadi` +
        (latest.errorMessage ? ` — ${latest.errorMessage}` : ""),
    );
  }

  throw new DeployFailed(
    `${app}: ${Math.round(APP_TIMEOUT_MS / 60000)} daqiqada tugamadi — Dokploy'dagi deploy log'ini ko'ring`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const shaAt = args.indexOf("--sha");
  const sha = shaAt >= 0 ? args[shaAt + 1] : undefined;
  const requested = args.filter(
    (arg, index) => !arg.startsWith("--") && (shaAt < 0 || index !== shaAt + 1),
  );

  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new DeployFailed("--sha ga to'liq (40 belgili) commit SHA kerak");
  }

  if (!baseUrl || !apiKey) {
    throw new DeployFailed("DOKPLOY_URL va DOKPLOY_API_KEY berilishi kerak");
  }

  const unknown = requested.filter(
    (app) => !ORDER.includes(app) && !ON_PREMISE.includes(app),
  );

  if (unknown.length > 0) {
    throw new DeployFailed(`noma'lum ilova: ${unknown.join(", ")}`);
  }

  let subject = "";

  try {
    subject = git("log", "-1", "--format=%s", sha);
  } catch {
    // Commit lokal bo'lmasa deploy sarlavhasiz ketadi.
  }

  const manual = requested.filter((app) => ON_PREMISE.includes(app));
  let deployed = 0;
  let complete = true;

  summary(`### Dokploy deploy — \`${sha.slice(0, 7)}\``);
  summary("");
  summary("| Ilova | Natija |");
  summary("| --- | --- |");

  for (const app of manual) {
    console.log(`  SKIP ${app} — restoranda ishlaydi, qo'lda yangilanadi`);
    summary(`| ${app} | ⏭ restoranda — qo'lda |`);
  }

  for (const app of ORDER.filter((name) => requested.includes(name))) {
    const applicationId = process.env[APP_ID_ENV[app]];

    if (!applicationId) {
      /*
       * ID berilmagan ilova Dokploy boshqarmaydi deb hisoblanadi va qo'lda
       * deploy qilinadi. Backend bundan MUSTASNO: migratsiyalar u bilan
       * keladi, uni o'tkazib yuborib `production` tegini surish keyingi
       * migratsiyani ko'rinmas qilib qo'yardi.
       */
      if (app === "backend") {
        complete = false;
      }

      manual.push(app);
      console.log(`  SKIP ${app} — ${APP_ID_ENV[app]} berilmagan`);
      summary(`| ${app} | ⏭ \`${APP_ID_ENV[app]}\` yo'q — qo'lda |`);
      continue;
    }

    const head = mainHead();

    if (head !== sha) {
      complete = false;
      console.log(
        `  STOP main oldinga ketdi (${head.slice(0, 7)}) — qolganini o'sha commit'ning deploy'i qiladi`,
      );
      summary(
        `| ${app} va keyingilar | ⏸ main oldinga ketdi (${head.slice(0, 7)}) |`,
      );
      break;
    }

    const started = Date.now();
    console.log(`  ...  ${app} navbatga qo'yildi`);

    try {
      await deployAndWait(app, applicationId, sha, subject);
    } catch (error) {
      summary(`| ${app} | ❌ ${error.message} |`);
      throw error;
    }

    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`  OK   ${app} (${seconds}s)`);
    summary(`| ${app} | ✅ ${seconds}s |`);
    deployed += 1;
  }

  if (requested.length === 0) {
    console.log("  Deploy qilinadigan ilova yo'q");
    summary("| — | o'zgargan ilova yo'q |");
  }

  console.log(
    `\n${deployed} ta ilova deploy qilindi` +
      (manual.length > 0 ? `; qo'lda: ${manual.join(", ")}` : ""),
  );

  output("complete", String(complete));
  output("deployed", String(deployed));
  output("manual", manual.join(" "));
}

try {
  await main();
} catch (error) {
  if (!(error instanceof DeployFailed)) {
    throw error;
  }

  console.log(`  FAIL ${error.message}`);
  output("complete", "false");
  process.exitCode = 1;
}
