#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

/*
 * RELIZ TOPSHIRIG'I. `main` ga tushgan har bir commit uchun GitHub issue
 * tayyorlaydi: uni .github/workflows/release-handoff.yml ochadi va reliz
 * egasiga (docs/RELEASE_RULES.md) biriktiradi.
 *
 * NIMA UCHUN BOR. Ilgari `main` yashil bo'lgach deploy.yml commit'ni o'zi
 * Dokploy'ga chiqarardi. Endi production'ga chiqarish QAT'IY qo'lda: reliz
 * egasi commit'ni o'z mashinasiga tortib oladi, to'liq tekshiradi va o'zi
 * deploy qiladi. Avtomatika qolgan yagona joyi — XABAR BERISH: hech bir
 * o'zgarish "kimdir ko'rar" bo'lib qolib ketmasin.
 *
 * Skript hech qachon yiqilmaydi. Uning vazifasi xabar yetkazish; reliz
 * darvozasi qizil bo'lsa ham issue ochilishi kerak, aks holda `main`
 * buzilgani haqida hech kim xabar topmaydi. Shuning uchun `release-gate`
 * chiqishi MATN sifatida issue ichiga solinadi, uning chiqish kodi esa
 * faqat sarlavhadagi belgiga ta'sir qiladi.
 *
 *   node scripts/release-handoff.mjs --sha <sha> --ci <conclusion> \
 *        --ci-url <url> --out <fayl>
 *
 * `--out` ga issue matni yoziladi. Sarlavha va yorliq GITHUB_OUTPUT ga
 * chiqadi (`title`, `state`), bo'lmasa stdout ga.
 */

const PRODUCTION_TAG = "production";
const RULES = "docs/RELEASE_RULES.md";

function git(...args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function arg(name, fallback = "") {
  const at = process.argv.indexOf(`--${name}`);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  return value && !value.startsWith("--") ? value : fallback;
}

/*
 * `release-gate.mjs` ning O'ZI chaqiriladi, mantiq takrorlanmaydi. U
 * commit `origin/main` da ekanini, `verify` yashil tugaganini tekshiradi va
 * `production` tegidan beri qaysi ilova o'zgargani bilan yangi
 * migratsiyalarni chiqaradi — reliz egasiga kerak bo'lgan hammasi.
 *
 * Rad etganda chiqish kodi 1 bo'ladi va execFileSync istisno tashlaydi;
 * matn o'sha istisnoning `stdout` ida bo'ladi.
 */
function releaseGate(sha) {
  try {
    const stdout = execFileSync("node", ["scripts/release-gate.mjs", sha], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { passed: true, output: stdout.trim() };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    return {
      passed: false,
      output: output || `release-gate yurmadi: ${error.message}`,
    };
  }
}

function pendingCommits(sha) {
  const base = git(
    "rev-parse",
    "--verify",
    `refs/tags/${PRODUCTION_TAG}^{commit}`,
  );

  if (!base) {
    return {
      base: "",
      list: `\`${PRODUCTION_TAG}\` tegi yo'q — production'da qaysi commit turgani belgilanmagan. ${RULES}, "Production tegi" bo'limi.`,
    };
  }

  const log = git("log", "--reverse", "--format=- `%h` %s", `${base}..${sha}`);

  return {
    base,
    list: log || "Yangi commit yo'q — production allaqachon shu commit'da.",
  };
}

/*
 * Issue matnidagi havolalar TO'LIQ bo'lishi kerak. Issue tanasidagi nisbiy
 * havola (`../blob/main/...`) repo sahifasidagidek yechilmaydi va bosilganda
 * 404 ga olib boradi. Actions ichida manzil env'dan yig'iladi; lokal
 * sinovda env yo'q, shunda havola o'rniga oddiy yo'l qoladi.
 */
const repoUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : "";

function doc(path) {
  return repoUrl
    ? `[\`${path}\`](${repoUrl}/blob/main/${path})`
    : `\`${path}\``;
}

const sha = arg("sha", git("rev-parse", "HEAD"));
const short = sha.slice(0, 7);
const ci = arg("ci", "unknown");
const ciUrl = arg("ci-url");
const green = ci === "success";

const subject = git("log", "-1", "--format=%s", sha) || "(sarlavha topilmadi)";
const author = git("log", "-1", "--format=%an", sha) || "(noma'lum)";
const when = git("log", "-1", "--format=%cI", sha);

const gate = releaseGate(sha);
const pending = pendingCommits(sha);

/*
 * Sarlavha commit matnidan keladi, ya'ni uni hech kim tekshirmaydi.
 * GITHUB_OUTPUT `nom=qiymat` ni QATOR bo'yicha o'qiydi: qiymat ichidagi yangi
 * qator keyingi output deb talqin qilinadi. `%s` da yangi qator bo'lmaydi,
 * lekin kutilmagan `\r` yoki juda uzun sarlavha uchun baribir tozalanadi.
 */
const title =
  `${green ? "Reliz tekshiruvi" : "main QIZIL"}: ${short} — ${subject}`
    .replace(/[\r\n]+/g, " ")
    .slice(0, 240);

const body = `> Bu issue avtomatik ochildi. **Production'ga chiqarish va quyidagi
> tekshiruvlarning hammasi reliz egasi zimmasida** — boshqa hech kim deploy
> qilmaydi. Qoidalar: ${doc(RULES)}

## Commit

| | |
| --- | --- |
| SHA | \`${sha}\` |
| Sarlavha | ${subject} |
| Muallif | ${author} |
| Sana | ${when} |
| CI \`verify\` | ${green ? "✅ yashil" : `❌ **${ci}**`}${ciUrl ? ` — [natija](${ciUrl})` : ""} |

${
  green
    ? ""
    : `> ⛔ **CI yashil emas. Bu commit production'ga CHIQMAYDI.** Avval \`main\` tuzatilsin.\n\n`
}## Production'ga chiqmagan commitlar

${pending.list}

## Reliz darvozasi — \`pnpm release:gate ${short}\`

${gate.passed ? "" : "> ⚠️ Darvoza hozir RUXSAT BERMAYDI. Sababi quyida.\n\n"}\`\`\`text
${gate.output}
\`\`\`

## Reliz egasi bajaradigan qadamlar

\`\`\`bash
git fetch origin && git checkout main && git pull --ff-only
pnpm install --frozen-lockfile

# LOKAL bazaga, production'ga emas
pnpm --filter backend prisma:migrate:deploy

# typecheck, lint, test, build, validatorlar
pnpm run ci

# commit main'da va CI "verify" yashilmi
pnpm release:gate ${short}

# production HOZIR sog'lommi (relizdan OLDIN)
pnpm release:smoke
\`\`\`

Hammasi o'tsa — deploy. Tartib: ${doc("docs/MAZETTO_RELEASE_READINESS_CHECKLIST.md")}.

## Prodga chiqishdan oldingi tekshiruvlar

Avtomatika tutmaydigan hammasi. Tegishli bo'lmaganini o'chirib yuboring.

- [ ] Lokal mashinada \`pnpm run ci\` to'liq o'tdi
- [ ] \`pnpm release:gate\` ruxsat berdi
- [ ] Relizdan OLDIN \`pnpm release:smoke\` — production hozir sog'lom
- [ ] O'zgarish real brauzerda ko'rildi: dizayn va UX
- [ ] Mobil layout: 360 / 390 / 430 / 768 / 1440 px, gorizontal scroll yo'q
- [ ] POS real qurilmada ochildi (smena, kassa, buyurtma)
- [ ] Yangi env o'zgaruvchi bo'lsa — Dokploy'dagi production env'ga qo'shildi
- [ ] Telegram'ga tegilgan bo'lsa — webhook info tekshirildi
- [ ] Printerga tegilgan bo'lsa — real printerda chek chiqdi
- [ ] Cloudflare / DNS / domen o'zgarishi kerak bo'lsa — bajarildi
- [ ] Real ma'lumotdagi chekka holatlar (bo'sh ro'yxat, yopiq filial, uzun nom)

### Migratsiya bo'lsa — qo'shimcha

- [ ] Migratsiya additive: ustun/jadval o'chirilmaydi, nomi o'zgarmaydi
- [ ] **Production baza backup'i olindi** va \`pg_restore --list\` bilan ochildi
- [ ] Backup yo'li shu issue'ga yozildi
- [ ] \`prisma migrate deploy\` production konteynerida yurgizildi

### Deploy'dan keyin

- [ ] \`pnpm release:smoke\` o'tdi
- [ ] O'zgargan ekran production'da qo'lda ko'rildi
- [ ] \`git tag -f production ${short} && git push -f origin production\`
- [ ] Shu issue yopildi

---
<sub>\`.github/workflows/release-handoff.yml\` tomonidan ochildi.</sub>
`;

const out = arg("out");

if (out) {
  writeFileSync(out, body, "utf8");
} else {
  console.log(body);
}

const outputs = [`title=${title}`, `state=${green ? "green" : "red"}`];

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    outputs.map((line) => `${line}\n`).join(""),
  );
} else {
  console.error(outputs.join("\n"));
}
