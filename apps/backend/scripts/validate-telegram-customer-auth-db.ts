import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as assert from "node:assert/strict";
import * as bcrypt from "bcryptjs";
import { Pool } from "pg";
import { CustomersService } from "../src/modules/customers/customers.service";
import { TelegramController } from "../src/modules/telegram/telegram.controller";
import { TelegramCustomerAuthService } from "../src/modules/telegram/telegram-customer-auth.service";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

type SentTelegramPayload = {
  chat_id: string;
  text?: string;
  reply_markup?: {
    keyboard?: { text: string; request_contact?: boolean }[][];
    remove_keyboard?: boolean;
  };
};

const databaseUrl = process.env.DATABASE_URL;
const sentTelegramPayloads: SentTelegramPayload[] = [];
const testPhones = [
  "+998990007001",
  "+998990007002",
  "+998990007003",
  "+998990007004",
  "+998990007005",
  "+998990007006",
  "+998990007007",
];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for DB-backed Telegram auth validation");
}

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  sentTelegramPayloads.push(JSON.parse(String(init?.body)) as SentTelegramPayload);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

async function run(): Promise<void> {
  process.env.CUSTOMER_JWT_ACCESS_SECRET = "customer-access-db-test-secret";
  process.env.CUSTOMER_JWT_REFRESH_SECRET = "customer-refresh-db-test-secret";
  process.env.CUSTOMER_JWT_ACCESS_EXPIRES_IN_SECONDS = "900";
  process.env.CUSTOMER_JWT_REFRESH_EXPIRES_IN_SECONDS = "604800";
  process.env.TELEGRAM_BOT_TOKEN = "mock-telegram-token";
  process.env.TELEGRAM_WEBHOOK_SECRET = "mock-webhook-secret";
  process.env.TELEGRAM_CUSTOMER_BOT_URL = "https://t.me/mazetto_validation_bot";
  delete process.env.TELEGRAM_STAFF_CHAT_ID;

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await cleanup(prisma);
    const services = createServices(prisma);

    await testUnlinkedChallenge(services.customersService);
    await testSelfContactLink(services.telegramCustomerAuthService, prisma);
    await testTelegramUniqueness(services.telegramCustomerAuthService, prisma);
    await testLinkedRequestResendAndVerify(services.customersService, prisma);
    await testExpiredAndAttemptLimit(services.customersService, prisma);
    await testRequestCodeRateLimit(services.customersService);
    await testWebhookSecurityAndStaffRegression(
      services.telegramCustomerAuthService,
    );
    await cleanup(prisma);

    console.log("DB-backed Telegram customer auth validation passed");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function createServices(prisma: PrismaClient) {
  const telegramCustomerAuthService = new TelegramCustomerAuthService(
    prisma as never,
  );
  const customersService = new CustomersService(
    prisma as never,
    {} as never,
    {} as never,
    new JwtService(),
    {} as never,
    telegramCustomerAuthService,
    {} as never,
  );

  return { telegramCustomerAuthService, customersService };
}

async function testUnlinkedChallenge(
  customersService: CustomersService,
): Promise<void> {
  const result = await customersService.requestCode({ phone: "998990007001" });
  assert.equal(result.challenge.phone, "+998990007001");
  assert.equal(result.delivery.status, "TELEGRAM_LINK_REQUIRED");
  assert.equal(result.delivery.botUrl, "https://t.me/mazetto_validation_bot");
}

async function testSelfContactLink(
  telegramCustomerAuthService: TelegramCustomerAuthService,
  prisma: PrismaClient,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  await telegramCustomerAuthService.handleWebhookUpdate({
    message: {
      chat: { id: 87002 },
      from: { id: 97002, first_name: "DB Test" },
      contact: {
        user_id: 97002,
        phone_number: "998990007002",
        first_name: "DB Test",
      },
    },
  });

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { phone: "+998990007002" },
  });
  assert.equal(customer.telegramUserId, "97002");
  assert.equal(customer.telegramChatId, "87002");
  assert.ok(customer.telegramLinkedAt);
  assert.match(latestCode(), /^\d{6}$/);
  assert.equal(
    await prisma.customerVerificationChallenge.count({
      where: { phone: "+998990007002", consumedAt: null },
    }),
    1,
  );
}

async function testTelegramUniqueness(
  telegramCustomerAuthService: TelegramCustomerAuthService,
  prisma: PrismaClient,
): Promise<void> {
  const result = await telegramCustomerAuthService.handleWebhookUpdate({
    message: {
      chat: { id: 87003 },
      from: { id: 97002, first_name: "Hijack" },
      contact: {
        user_id: 97002,
        phone_number: "998990007003",
        first_name: "Hijack",
      },
    },
  });
  assert.equal(result.handled, true);
  assert.equal(
    await prisma.customer.count({
      where: {
        phone: "+998990007003",
        telegramUserId: "97002",
      },
    }),
    0,
    "same telegram user must not claim a different phone",
  );
  assert.equal(
    await prisma.customer.count({
      where: {
        telegramUserId: "97002",
        phone: { not: "+998990007002" },
      },
    }),
    0,
    "no conflicting customer may be linked to the same telegram user",
  );

  await expectRejects(
    () =>
      prisma.customer.create({
        data: {
          name: "Duplicate Telegram",
          phone: "+998990007003",
          telegramUserId: "97002",
        },
      }),
    "real DB unique index must reject duplicate telegramUserId",
  );
}

async function testLinkedRequestResendAndVerify(
  customersService: CustomersService,
  prisma: PrismaClient,
): Promise<void> {
  sentTelegramPayloads.length = 0;
  const first = await customersService.requestCode({ phone: "+998990007002" });
  assert.equal(first.delivery.status, "SENT");
  const firstCode = latestCode();

  const second = await customersService.requestCode({ phone: "998990007002" });
  assert.equal(second.delivery.status, "SENT");
  const secondCode = latestCode();
  assert.notEqual(firstCode, secondCode);

  await expectRejects(
    () => customersService.verifyCode({ phone: "+998990007002", code: firstCode }),
    "old code must fail after resend",
  );

  const auth = await customersService.verifyCode({
    phone: "+998 99 000 70 02",
    code: secondCode,
  });
  assert.ok(auth.tokens.accessToken);
  assert.ok(auth.tokens.refreshToken);
  assert.equal(
    await prisma.customerVerificationChallenge.count({
      where: { phone: "+998990007002", consumedAt: null },
    }),
    0,
  );

  await expectRejects(
    () => customersService.verifyCode({ phone: "+998990007002", code: secondCode }),
    "reused code must fail",
  );
}

async function testExpiredAndAttemptLimit(
  customersService: CustomersService,
  prisma: PrismaClient,
): Promise<void> {
  await prisma.customerVerificationChallenge.create({
    data: {
      phone: "+998990007004",
      codeHash: await bcrypt.hash("123456", 12),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await expectRejects(
    () => customersService.verifyCode({ phone: "+998990007004", code: "123456" }),
    "expired code must fail",
  );

  await prisma.customerVerificationChallenge.create({
    data: {
      phone: "+998990007005",
      codeHash: await bcrypt.hash("654321", 12),
      expiresAt: new Date(Date.now() + 600000),
    },
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectRejects(
      () => customersService.verifyCode({ phone: "+998990007005", code: "000000" }),
      "wrong code attempt must fail",
    );
  }

  await expectRejects(
    () => customersService.verifyCode({ phone: "+998990007005", code: "654321" }),
    "code must fail after excessive attempts",
  );
}

async function testRequestCodeRateLimit(
  customersService: CustomersService,
): Promise<void> {
  await customersService.requestCode({ phone: "+998990007006" });
  await customersService.requestCode({ phone: "+998990007006" });
  await customersService.requestCode({ phone: "+998990007006" });
  await expectRejects(
    () => customersService.requestCode({ phone: "+998990007006" }),
    "rate limit must persist in DB",
  );
}

async function testWebhookSecurityAndStaffRegression(
  telegramCustomerAuthService: TelegramCustomerAuthService,
): Promise<void> {
  const staffService = {
    called: 0,
    handleWebhook: async (secret: string, update: unknown) => {
      staffService.called += 1;
      return { ok: true, handled: true, secret, update, staff: true };
    },
  };
  const controller = new TelegramController(
    telegramCustomerAuthService,
    staffService as never,
  );

  await assert.rejects(
    () => controller.handleWebhook("wrong-secret", {}),
    UnauthorizedException,
  );

  const startResult = await controller.handleWebhook("mock-webhook-secret", {
    message: {
      chat: { id: 87007 },
      from: { id: 97007, first_name: "Start" },
      text: "/start",
    },
  });
  assert.equal(startResult.handled, true);
  assert.equal(staffService.called, 0);

  const callbackResult = await controller.handleWebhook("mock-webhook-secret", {
    callback_query: {
      id: "callback-db-1",
      data: "mazetto_order:READY:order_db_1",
    },
  });
  assert.equal((callbackResult as { staff?: boolean }).staff, true);

  const realStaffService = new TelegramOrderNotificationService(
    {} as never,
    {} as never,
  );
  const parser = realStaffService as unknown as {
    parseCallbackData(data: string): { orderId: string; status: string };
  };
  assert.deepEqual(parser.parseCallbackData("mazetto_order:READY:order_db_1"), {
    orderId: "order_db_1",
    status: "READY",
  });
}

async function expectRejects(
  action: () => Promise<unknown>,
  message: string,
): Promise<void> {
  let rejected = false;

  try {
    await action();
  } catch {
    rejected = true;
  }

  assert.equal(rejected, true, message);
}

function latestCode(): string {
  const text = sentTelegramPayloads.at(-1)?.text ?? "";
  const match = text.match(/\b\d{6}\b/);
  assert.ok(match?.[0], "telegram message must include a 6 digit code");
  return match[0];
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  await prisma.customerSession.deleteMany({
    where: { customer: { phone: { in: testPhones } } },
  });
  await prisma.customerVerificationChallenge.deleteMany({
    where: { phone: { in: testPhones } },
  });
  await prisma.customer.deleteMany({
    where: {
      OR: [
        { phone: { in: testPhones } },
        { telegramUserId: { in: ["97002", "97007"] } },
      ],
    },
  });
}

void run();
