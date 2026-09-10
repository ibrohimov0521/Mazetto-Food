#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

/*
 * Bazani TALAB QILMAYDIGAN validatorlarni birdan yurgizadi (7-bosqich Q3.3).
 *
 * Ilgari ular bittalab qo'lda ishga tushirilardi, ya'ni amalda hech kim
 * hammasini yurgizmasdi. Bazani o'zgartiradigan `*-db` skriptlar ATAYLAB
 * chetda: ular o'z bayrog'ini talab qiladi va tasodifan ishlamasligi kerak.
 */

const SKIP = new Set(["validate-telegram-staff-lifecycle"]);

const names = readdirSync("apps/backend/scripts")
  .filter((file) => file.startsWith("validate-") && file.endsWith(".ts"))
  .map((file) => file.replace(/\.ts$/, ""))
  .filter((name) => !name.endsWith("-db") && !SKIP.has(name))
  .sort();

let failed = 0;

for (const name of names) {
  try {
    /*
     * `node --import tsx` — ATAYLAB `pnpm exec` emas.
     *
     * Windows'da `pnpm` bu `.cmd` fayl, Node esa `.cmd` ni `shell: true`
     * siz ishga tushirishni rad etadi (EINVAL, CVE-2024-27980). `shell: true`
     * esa argumentlarni escape qilmaydi va o'z ogohlantirishini beradi.
     * `node` haqiqiy bajariluvchi fayl, ya'ni ikkala muammo ham yo'q.
     */
    execFileSync("node", ["--import", "tsx", `scripts/${name}.ts`], {
      cwd: "apps/backend",
      stdio: ["ignore", "ignore", "pipe"],
    });
    console.log(`  OK   ${name}`);
  } catch {
    console.log(`  FAIL ${name}`);
    failed += 1;
  }
}

console.log(`\n${names.length - failed}/${names.length} validator o'tdi`);

if (failed > 0) {
  process.exit(1);
}
