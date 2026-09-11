#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

/*
 * Reliz darvozasi: production'ga faqat CI'dan YASHIL o'tgan `main` commit'i
 * chiqadi.
 *
 * Branch protection qizil PR'ni merge qilishga yo'l qo'ymaydi, lekin
 * production'ga chiqarishda "qaysi commit'ni chiqaryapman va u
 * tekshirilganmi?" degan savolga hech narsa javob bermasdi. Reliz egasi uni
 * deploy'dan OLDIN yurgizadi (docs/RELEASE_RULES.md); reliz topshirig'i
 * issue'sini tayyorlaydigan scripts/release-handoff.mjs ham shu skriptni
 * chaqiradi va chiqishini issue ichiga soladi.
 *
 *   pnpm release:gate                        # joriy HEAD
 *   pnpm release:gate <sha>                  # aniq commit
 *   pnpm release:gate <sha> --since <sha2>   # boshqa solishtirish nuqtasi
 *
 * Solishtirish nuqtasi `--since`, berilmasa `production` tegi — production'da
 * turgan oxirgi commit. Undan beri qaysi ilovalar o'zgargani va yangi
 * migratsiyalar chiqariladi.
 *
 * `--github-output` natijani GitHub Actions step output'lariga ham yozadi:
 * sha, since, apps (bo'sh joy bilan), migrations (vergul bilan).
 *
 * Chiqish kodi: 0 — relizga ruxsat, 1 — yo'q.
 */

const CHECK_NAME = "verify";
const PRODUCTION_TAG = "production";

/*
 * Rad etish `process.exit()` bilan EMAS, istisno bilan qilinadi. Windows'da
 * fetch ulanishi hali ochiq turganda `process.exit()` chaqirilsa Node libuv
 * assertion bilan qulaydi va chiqish kodi 1 emas, 127 bo'lib qoladi.
 */
class GateClosed extends Error {}

function fail(message) {
  throw new GateClosed(message);
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveCommit(ref) {
  try {
    return git("rev-parse", "--verify", `${ref}^{commit}`);
  } catch {
    return undefined;
  }
}

async function latestVerifyRun(repo, sha) {
  // Repo public, ya'ni token shart emas (soatiga 60 so'rov). Berilsa ishlatiladi.
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mazetto-release-gate",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let response;

  try {
    response = await fetch(
      `https://api.github.com/repos/${repo}/commits/${sha}/check-runs?check_name=${CHECK_NAME}`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
  } catch (error) {
    fail(`GitHub API'ga ulanib bo'lmadi: ${error.message}`);
  }

  if (!response.ok) {
    fail(`GitHub API ${response.status} qaytardi`);
  }

  const { check_runs: runs = [] } = await response.json();

  // Qayta yurgizilgan bo'lsa eng oxirgisi hal qiladi.
  return runs.sort((a, b) => b.id - a.id)[0];
}

function describeChanges(base, sha, label) {
  const changed = git("diff", "--name-only", base, sha)
    .split("\n")
    .filter(Boolean);

  // Bular o'zgarsa har bir Node ilovasi qayta yig'ilishi kerak.
  const SHARED = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "turbo.json",
  ];
  const shared = changed.some(
    (file) => SHARED.includes(file) || file.startsWith("packages/"),
  );

  const apps = [
    "backend",
    "customer-web",
    "pos-web",
    "telegram-bot",
    "print-agent",
    "media",
  ].filter(
    (app) =>
      changed.some((file) => file.startsWith(`apps/${app}/`)) ||
      (shared && app !== "media"),
  );

  const migrations = [
    ...new Set(
      changed
        .filter((file) => file.startsWith("apps/backend/prisma/migrations/"))
        .map((file) => file.split("/"))
        .filter((parts) => parts.length > 5)
        .map((parts) => parts[4]),
    ),
  ];

  console.log(
    `\n${label} (${base.slice(0, 7)})..${sha.slice(0, 7)}: ${changed.length} fayl o'zgargan`,
  );
  console.log(
    `  Qayta deploy: ${apps.length > 0 ? apps.join(", ") : "hech biri"}`,
  );

  if (migrations.length > 0) {
    console.log(`\n  !    ${migrations.length} ta yangi migratsiya:`);

    for (const name of migrations) {
      console.log(`         ${name}`);
    }

    console.log(
      "       Avval production backup, keyin `prisma migrate deploy`\n" +
        "       (docs/MAZETTO_RELEASE_READINESS_CHECKLIST.md).",
    );
  }

  return { apps, migrations };
}

async function main() {
  const args = process.argv.slice(2);
  const sinceAt = args.indexOf("--since");
  const sinceArg = sinceAt >= 0 ? args[sinceAt + 1] : undefined;
  const githubOutput = args.includes("--github-output");
  const target =
    args.find(
      (arg, index) =>
        !arg.startsWith("--") && (sinceAt < 0 || index !== sinceAt + 1),
    ) ?? "HEAD";

  if (sinceAt >= 0 && (!sinceArg || sinceArg.startsWith("--"))) {
    fail("--since dan keyin solishtiriladigan commit berilishi kerak");
  }

  const sha = resolveCommit(target);

  if (!sha) {
    fail(`commit topilmadi: ${target}`);
  }

  const remote = git("remote", "get-url", "origin");
  const repo =
    process.env.GITHUB_REPOSITORY ??
    remote.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1];

  if (!repo) {
    fail(`origin GitHub repo emas: ${remote}`);
  }

  console.log(`${sha.slice(0, 7)}  ${git("log", "-1", "--format=%s", sha)}\n`);

  /*
   * Faqat `main` dagi commit chiqadi. Branch'dagi commit ham CI'dan yashil
   * o'tgan bo'lishi mumkin, lekin u PR va merge'dan o'tmagan.
   */
  try {
    git("fetch", "--quiet", "origin", "main");
  } catch {
    console.log(
      "  !    origin/main yangilanmadi (tarmoq?) — mahalliy nusxa bilan tekshiriladi",
    );
  }

  try {
    git("merge-base", "--is-ancestor", sha, "origin/main");
  } catch {
    fail("commit origin/main da yo'q — avval PR orqali merge qiling");
  }

  console.log("  OK   commit origin/main tarixida");

  const run = await latestVerifyRun(repo, sha);

  if (!run) {
    fail(
      `"${CHECK_NAME}" bu commit uchun yurmagan — GitHub Actions'ni tekshiring`,
    );
  }

  if (run.status !== "completed") {
    fail(
      `"${CHECK_NAME}" hali tugamagan (${run.status}), kuting: ${run.html_url}`,
    );
  }

  if (run.conclusion !== "success") {
    fail(`"${CHECK_NAME}" natijasi ${run.conclusion}: ${run.html_url}`);
  }

  console.log(`  OK   CI yashil: ${run.html_url}`);

  let base;

  if (sinceArg) {
    base = resolveCommit(sinceArg);

    if (!base) {
      fail(`--since commit topilmadi: ${sinceArg}`);
    }
  } else {
    base = resolveCommit(`refs/tags/${PRODUCTION_TAG}`);

    if (!base) {
      console.log(
        `\n  !    \`${PRODUCTION_TAG}\` tegi yo'q — nima o'zgargani solishtirilmadi`,
      );
    }
  }

  const changes = base
    ? describeChanges(base, sha, sinceArg ?? PRODUCTION_TAG)
    : { apps: [], migrations: [] };

  if (githubOutput && process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `sha=${sha}`,
        `since=${base ?? ""}`,
        `apps=${changes.apps.join(" ")}`,
        `migrations=${changes.migrations.join(",")}`,
      ]
        .map((line) => `${line}\n`)
        .join(""),
    );
  }
}

try {
  await main();
  console.log("\nRelizga ruxsat.");
} catch (error) {
  if (!(error instanceof GateClosed)) {
    throw error;
  }

  console.log(`  YO'Q ${error.message}`);
  console.log("\nRelizga ruxsat YO'Q.");
  process.exitCode = 1;
}
