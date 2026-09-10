#!/usr/bin/env node
import { execFileSync } from "node:child_process";

/*
 * Reliz darvozasi: production'ga faqat CI'dan YASHIL o'tgan `main` commit'i
 * chiqadi.
 *
 * Branch protection qizil PR'ni merge qilishga yo'l qo'ymaydi, lekin image
 * server'da hamon qo'lda yig'iladi — u yerda "qaysi commit'ni chiqaryapman va
 * u tekshirilganmi?" degan savolga hech narsa javob bermasdi. Image yig'ishdan
 * OLDIN shu skript yurgiziladi:
 *
 *   pnpm release:gate                        # joriy HEAD
 *   pnpm release:gate <sha>                  # aniq commit
 *   pnpm release:gate <sha> --since <prod>   # + production'dagi commit'dan
 *                                            #   beri nima o'zgargani
 *
 * `--since` ga hozir production'da turgan commit beriladi — image tegidagi
 * qisqa SHA, masalan `mazetto-food-backend-pdslpm:0a459a9` → `0a459a9`.
 *
 * Chiqish kodi: 0 — relizga ruxsat, 1 — yo'q.
 */

const CHECK_NAME = "verify";

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

function describeChanges(base, sha) {
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
    `\n${base.slice(0, 7)}..${sha.slice(0, 7)}: ${changed.length} fayl o'zgargan`,
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
}

async function main() {
  const args = process.argv.slice(2);
  const sinceAt = args.indexOf("--since");
  const since = sinceAt >= 0 ? args[sinceAt + 1] : undefined;
  const target =
    args.find(
      (arg, index) =>
        !arg.startsWith("--") && (sinceAt < 0 || index !== sinceAt + 1),
    ) ?? "HEAD";

  if (sinceAt >= 0 && !since) {
    fail("--since dan keyin production'dagi commit berilishi kerak");
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

  if (since) {
    const base = resolveCommit(since);

    if (!base) {
      fail(`--since commit topilmadi: ${since}`);
    }

    describeChanges(base, sha);
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
