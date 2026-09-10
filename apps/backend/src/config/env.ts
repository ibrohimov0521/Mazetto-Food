import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

/*
 * Muhit o'zgaruvchilarini yuklash va tekshirish (7-bosqich Q3.1).
 *
 * IKKI MUAMMONI yopadi.
 *
 * 1. Backend `.env` ni O'ZI YUKLAMASDI. Dev'da uni qo'lda eksport qilish
 *    kerak edi, aks holda ishga tushish "DATABASE_URL is required to
 *    initialize Prisma" bilan tugardi — sababi konfiguratsiya emas, faqat
 *    fayl o'qilmagani ekanini xabar aytmasdi.
 *
 * 2. Qiymatlar TEKSHIRILMASDI. Ular kod bo'ylab tarqoq o'qilardi va noto'g'ri
 *    qiymat faqat o'sha yo'lga birinchi marta kirilganda — ba'zan ishlab
 *    chiqarishda — bilinardi.
 *
 * Endi tekshiruv BOOT paytida bo'ladi va BARCHA muammolarni birdan ko'rsatadi.
 */

/*
 * Qidiruv boshlanadigan papka.
 *
 * `src` NestJS uchun CommonJS'ga kompilyatsiya bo'ladi va u yerda `__dirname`
 * bor; `scripts/` esa `tsconfig.scripts.json` bo'yicha ESM va u yerda
 * `__dirname` YO'Q. Ikkala holatda ham ishlashi uchun mavjudligi tekshiriladi
 * va bo'lmasa joriy ish papkasidan boshlanadi.
 */
function defaultStartDir(): string {
  return typeof __dirname === "string" ? __dirname : process.cwd();
}

// `.env` ni ildizdan qidiramiz: dev'da `apps/backend` dan, konteynerda esa
// odatda fayl umuman bo'lmaydi (env to'g'ridan-to'g'ri beriladi).
export function loadEnvironmentFile(startDir = defaultStartDir()): void {
  let current = resolve(startDir);

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(current, ".env");

    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // Buzuq fayl ishga tushishni to'xtatmaydi — quyidagi sxema baribir
        // yetishmayotgan qiymatlarni aniq xabar bilan ushlaydi.
      }
      return;
    }

    const parent = dirname(current);

    if (parent === current) {
      return;
    }

    current = parent;
  }
}

/*
 * Env BOOLEAN uchun `z.coerce.boolean()` HECH QACHON ishlatilmaydi.
 *
 * U `Boolean(input)` chaqiradi, ya'ni "false" SATRI `true` ga aylanadi —
 * bayroqni env fayli orqali umuman o'chirib bo'lmasdi. Faqat quyidagi aniq
 * so'zlar rost hisoblanadi.
 */
const TRUE_WORDS = new Set(["true", "1", "yes", "ha", "on"]);
const FALSE_WORDS = new Set(["false", "0", "no", "yo'q", "off"]);

const envBoolean = (fallback: boolean) =>
  z.preprocess((raw) => {
    if (raw === undefined || raw === null) {
      return fallback;
    }

    const value = String(raw).trim().toLowerCase();

    if (value === "") {
      return fallback;
    }

    if (TRUE_WORDS.has(value)) {
      return true;
    }

    if (FALSE_WORDS.has(value)) {
      return false;
    }

    return value;
  }, z.boolean());

// Bo'sh satr "berilmagan" bilan bir xil: Docker build-arg va compose
// o'rnatilmagan o'zgaruvchini bo'sh satr sifatida uzatadi.
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const positiveSeconds = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: optionalText,
  JWT_REFRESH_SECRET: optionalText,
  CUSTOMER_JWT_ACCESS_SECRET: optionalText,
  CUSTOMER_JWT_REFRESH_SECRET: optionalText,
  JWT_ACCESS_EXPIRES_IN_SECONDS: positiveSeconds(900),
  JWT_REFRESH_EXPIRES_IN_SECONDS: positiveSeconds(604800),
  CUSTOMER_JWT_ACCESS_EXPIRES_IN_SECONDS: positiveSeconds(900),
  CUSTOMER_JWT_REFRESH_EXPIRES_IN_SECONDS: positiveSeconds(604800),

  // 0 = hech qanday proxy header'iga ishonilmaydi (PHASE 6 H1).
  TRUSTED_PROXY_HOP_COUNT: z.coerce.number().int().min(0).max(10).default(0),
  CORS_ORIGIN: optionalText,

  TELEGRAM_BOT_TOKEN: optionalText,
  TELEGRAM_WEBHOOK_SECRET: optionalText,
  TELEGRAM_STAFF_CHAT_ID: optionalText,
  TELEGRAM_BOT_URL: optionalText,
  TELEGRAM_CUSTOMER_BOT_URL: optionalText,

  // Media saqlash. Berilmasa rasm yuklash o'chiq qoladi, ilova ishlayveradi.
  MINIO_ENDPOINT: optionalText,
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_BUCKET: optionalText,
  MINIO_ROOT_USER: optionalText,
  MINIO_ROOT_PASSWORD: optionalText,
  MINIO_PUBLIC_URL: optionalText,
  MINIO_USE_SSL: envBoolean(false),

  SWAGGER_ENABLED: envBoolean(false),
});

export type BackendEnv = z.infer<typeof envSchema>;

/*
 * Ishlab chiqarishda MAJBURIY bo'lgan sirlar.
 *
 * `auth.config.ts` ularning har birini alohida tekshiradi va birinchisida
 * to'xtaydi. Bu yerda hammasi birdan ko'rsatiladi, ya'ni to'rtta sirni
 * to'rtta qayta ishga tushirish bilan topish shart emas.
 */
const PRODUCTION_REQUIRED = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CUSTOMER_JWT_ACCESS_SECRET",
  "CUSTOMER_JWT_REFRESH_SECRET",
] as const;

export function validateEnvironment(source: NodeJS.ProcessEnv = process.env): BackendEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(env)"}: ${issue.message}`,
    );

    throw new Error(
      `Muhit konfiguratsiyasi noto'g'ri:\n${problems.join("\n")}`,
    );
  }

  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    const missing = PRODUCTION_REQUIRED.filter((name) => !env[name]);

    if (missing.length > 0) {
      throw new Error(
        `Ishlab chiqarishda quyidagilar majburiy:\n${missing
          .map((name) => `  ${name}`)
          .join("\n")}`,
      );
    }
  }

  return env;
}
