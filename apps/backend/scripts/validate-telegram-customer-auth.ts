import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as assert from "node:assert/strict";
import * as bcrypt from "bcryptjs";
import { CustomersService } from "../src/modules/customers/customers.service";
import { TelegramController } from "../src/modules/telegram/telegram.controller";
import { TelegramCustomerAuthService } from "../src/modules/telegram/telegram-customer-auth.service";
import { TelegramOrderNotificationService } from "../src/modules/telegram/telegram-order-notification.service";

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  passwordHash: string | null;
  telegramUserId: string | null;
  telegramChatId: string | null;
  telegramLinkedAt: Date | null;
  bonusBalance: string;
  createdAt: Date;
  updatedAt: Date;
};

type ChallengeRecord = {
  id: string;
  customerId: string | null;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  customerId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SentTelegramPayload = {
  chat_id: string;
  text?: string;
  reply_markup?: {
    keyboard?: { text: string; request_contact?: boolean }[][];
    remove_keyboard?: boolean;
  };
};

class InMemoryPrisma {
  customers: CustomerRecord[] = [];
  challenges: ChallengeRecord[] = [];
  sessions: SessionRecord[] = [];
  private sequence = 0;

  customer = {
    findUnique: async ({ where, select }: { where: Partial<CustomerRecord>; select?: Record<string, boolean> }) => {
      const record =
        where.phone !== undefined
          ? this.customers.find((customer) => customer.phone === where.phone)
          : this.customers.find((customer) => customer.id === where.id);
      return this.select(record ?? null, select);
    },
    findFirst: async ({ where, select }: { where: { telegramUserId?: string; phone?: { not: string } }; select?: Record<string, boolean> }) => {
      const record = this.customers.find((customer) => {
        if (where.telegramUserId !== undefined && customer.telegramUserId !== where.telegramUserId) {
          return false;
        }

        if (where.phone?.not !== undefined && customer.phone === where.phone.not) {
          return false;
        }

        return true;
      });
      return this.select(record ?? null, select);
    },
    upsert: async ({
      where,
      update,
      create,
      select,
    }: {
      where: { phone: string };
      update: Partial<CustomerRecord>;
      create: Pick<CustomerRecord, "name" | "phone"> & Partial<CustomerRecord>;
      select?: Record<string, boolean>;
    }) => {
      let record = this.customers.find((customer) => customer.phone === where.phone);

      if (record) {
        const conflictingTelegramUserId =
          update.telegramUserId &&
          this.customers.find(
            (customer) =>
              customer.id !== record?.id &&
              customer.telegramUserId === update.telegramUserId,
          );

        if (conflictingTelegramUserId) {
          throw new Error("Unique constraint failed on telegramUserId");
        }

        record = { ...record, ...update, updatedAt: new Date() };
        this.customers = this.customers.map((customer) =>
          customer.id === record?.id ? record as CustomerRecord : customer,
        );
      } else {
        if (this.customers.some((customer) => customer.phone === create.phone)) {
          throw new Error("Unique constraint failed on phone");
        }

        if (
          create.telegramUserId &&
          this.customers.some(
            (customer) => customer.telegramUserId === create.telegramUserId,
          )
        ) {
          throw new Error("Unique constraint failed on telegramUserId");
        }

        record = {
          id: this.id("customer"),
          name: create.name,
          phone: create.phone,
          email: create.email ?? null,
          passwordHash: create.passwordHash ?? null,
          telegramUserId: create.telegramUserId ?? null,
          telegramChatId: create.telegramChatId ?? null,
          telegramLinkedAt: create.telegramLinkedAt ?? null,
          bonusBalance: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.customers.push(record);
      }

      return this.select(record, select);
    },
  };

  customerVerificationChallenge = {
    count: async ({ where }: { where: { phone: string; createdAt?: { gte: Date } } }) =>
      this.challenges.filter(
        (challenge) =>
          challenge.phone === where.phone &&
          (!where.createdAt?.gte || challenge.createdAt >= where.createdAt.gte),
      ).length,
    create: async ({
      data,
      select,
    }: {
      data: {
        customerId: string | null;
        phone: string;
        codeHash: string;
        expiresAt: Date;
      };
      select?: Record<string, boolean>;
    }) => {
      const record: ChallengeRecord = {
        id: this.id("challenge"),
        customerId: data.customerId,
        phone: data.phone,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        consumedAt: null,
        attempts: 0,
        createdAt: new Date(Date.now() + this.sequence),
        updatedAt: new Date(),
      };
      this.challenges.push(record);
      return this.select(record, select);
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where: { phone: string; consumedAt: null; expiresAt: { gt: Date } };
      orderBy: { createdAt: "desc" };
    }) => {
      void orderBy;
      return (
        this.challenges
          .filter(
            (challenge) =>
              challenge.phone === where.phone &&
              challenge.consumedAt === where.consumedAt &&
              challenge.expiresAt > where.expiresAt.gt,
          )
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ??
        null
      );
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Pick<ChallengeRecord, "attempts" | "consumedAt" | "customerId">>;
    }) => {
      const record = this.challenges.find((challenge) => challenge.id === where.id);
      assert.ok(record, "challenge must exist");
      Object.assign(record, data, { updatedAt: new Date() });
      return record;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { phone: string; consumedAt: null; expiresAt: { gt: Date } };
      data: { consumedAt: Date };
    }) => {
      let count = 0;
      for (const challenge of this.challenges) {
        if (
          challenge.phone === where.phone &&
          challenge.consumedAt === where.consumedAt &&
          challenge.expiresAt > where.expiresAt.gt
        ) {
          challenge.consumedAt = data.consumedAt;
          challenge.updatedAt = new Date();
          count += 1;
        }
      }

      return { count };
    },
  };

  customerSession = {
    create: async ({ data, select }: { data: Pick<SessionRecord, "customerId" | "refreshTokenHash" | "expiresAt">; select?: Record<string, boolean> }) => {
      const record: SessionRecord = {
        id: this.id("session"),
        customerId: data.customerId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.sessions.push(record);
      return this.select(record, select);
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<SessionRecord> }) => {
      const record = this.sessions.find((session) => session.id === where.id);
      assert.ok(record, "session must exist");
      Object.assign(record, data, { updatedAt: new Date() });
      return record;
    },
    findFirst: async ({ where }: { where: { id: string; customerId: string; revokedAt: null; expiresAt: { gt: Date } } }) =>
      this.sessions.find(
        (session) =>
          session.id === where.id &&
          session.customerId === where.customerId &&
          session.revokedAt === where.revokedAt &&
          session.expiresAt > where.expiresAt.gt,
      ) ?? null,
  };

  $transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private id(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  private select<TRecord extends Record<string, unknown>>(
    record: TRecord | null,
    select?: Record<string, boolean>,
  ): Partial<TRecord> | TRecord | null {
    if (!record || !select) {
      return record;
    }

    return Object.fromEntries(
      Object.entries(select)
        .filter(([, enabled]) => enabled)
        .map(([key]) => [key, record[key]]),
    ) as Partial<TRecord>;
  }
}

const sentTelegramPayloads: SentTelegramPayload[] = [];

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  sentTelegramPayloads.push(JSON.parse(String(init?.body)) as SentTelegramPayload);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

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
  for (const payload of sentTelegramPayloads.toReversed()) {
    const match = (payload.text ?? "").match(/\b\d{6}\b/);

    if (match?.[0]) {
      return match[0];
    }
  }

  assert.fail("telegram message must include a 6 digit code");
}

function createServices(
  prisma = new InMemoryPrisma(),
  orderingOverrides: Partial<{
    handleCustomerCallback: () => Promise<boolean>;
    sendCategoryMenu: () => Promise<void>;
    sendCartFromMessage: () => Promise<void>;
    sendBranches: () => Promise<void>;
    sendMainMenuFromMessage: () => Promise<void>;
  }> = {},
) {
  const telegramCustomerOrderingService = {
    handleCustomerCallback: async () => true,
    sendCategoryMenu: async () => undefined,
    sendCartFromMessage: async () => undefined,
    sendBranches: async () => undefined,
    sendMainMenuFromMessage: async () => undefined,
    ...orderingOverrides,
  };
  const telegramCustomerAuthService = new TelegramCustomerAuthService(
    prisma as never,
    telegramCustomerOrderingService as never,
  );
  const customersService = new CustomersService(
    prisma as never,
    {} as never,
    new JwtService(),
    {} as never,
    telegramCustomerAuthService,
    {} as never,
  );

  return { prisma, telegramCustomerAuthService, customersService };
}

async function run(): Promise<void> {
  process.env.CUSTOMER_JWT_ACCESS_SECRET = "customer-access-test-secret";
  process.env.CUSTOMER_JWT_REFRESH_SECRET = "customer-refresh-test-secret";
  process.env.CUSTOMER_JWT_ACCESS_EXPIRES_IN_SECONDS = "900";
  process.env.CUSTOMER_JWT_REFRESH_EXPIRES_IN_SECONDS = "604800";

  await testMissingBotToken();
  await testUnlinkedRequestCode();
  await testStartFlow();
  await testForeignContactRejected();
  await testSelfContactAcceptedAndVerify();
  await testCodeRotationReuseExpiryAndAttempts();
  await testRequestCodeRateLimit();
  await testWebhookSecretAndStaffRegression();
  await testOrderingCallbackErrorsDoNotSendAuthError();

  console.log("Telegram customer auth validation passed");
}

async function testOrderingCallbackErrorsDoNotSendAuthError(): Promise<void> {
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  sentTelegramPayloads.length = 0;
  const { telegramCustomerAuthService } = createServices(
    new InMemoryPrisma(),
    {
      handleCustomerCallback: async () => {
        throw new BadRequestException("Branch is not accepting orders now");
      },
    },
  );
  const controller = new TelegramController(
    telegramCustomerAuthService,
    { handleWebhook: async () => ({ ok: true, handled: true }) } as never,
  );

  const result = await controller.handleWebhook("test-secret", {
    callback_query: {
      id: "callback-note-skip",
      data: "cust:note:skip",
      from: { id: 8001 },
      message: { chat: { id: 7001 }, message_id: 9001 },
    },
  });

  assert.equal(result.handled, true);
  assert.match(sentTelegramPayloads.at(-1)?.text ?? "", /Filial hozir buyurtma qabul qilmayapti/);
  assert.doesNotMatch(sentTelegramPayloads.at(-1)?.text ?? "", /Telefon raqamni bog'lashda xatolik/);
}

async function testMissingBotToken(): Promise<void> {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CUSTOMER_BOT_URL;
  const { customersService } = createServices();
  const result = await customersService.requestCode({ phone: "+998 90 111 22 33" });
  assert.equal(result.delivery.status, "PENDING_INTEGRATION");
}

async function testUnlinkedRequestCode(): Promise<void> {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CUSTOMER_BOT_URL = "https://t.me/mazetto_test_bot";
  const { customersService } = createServices();
  const result = await customersService.requestCode({ phone: "998901112233" });
  assert.equal(result.challenge.phone, "+998901112233");
  assert.equal(result.delivery.status, "TELEGRAM_LINK_REQUIRED");
  assert.equal(result.delivery.botUrl, "https://t.me/mazetto_test_bot");
}

async function testStartFlow(): Promise<void> {
  sentTelegramPayloads.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const { telegramCustomerAuthService } = createServices();
  const result = await telegramCustomerAuthService.handleWebhookUpdate({
    message: {
      chat: { id: 1001 },
      from: { id: 2001, first_name: "Ali" },
      text: "/start",
    },
  });

  assert.equal(result.handled, true);
  assert.match(sentTelegramPayloads[0]?.text ?? "", /telefon raqamingizni yuboring/i);
  assert.equal(
    sentTelegramPayloads[0]?.reply_markup?.keyboard?.[0]?.[0]?.request_contact,
    true,
  );
}

async function testForeignContactRejected(): Promise<void> {
  sentTelegramPayloads.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const { prisma, telegramCustomerAuthService } = createServices();
  await telegramCustomerAuthService.handleWebhookUpdate({
    message: {
      chat: { id: 1002 },
      from: { id: 2002, first_name: "Vali" },
      contact: { user_id: 9999, phone_number: "+998901112244" },
    },
  });

  assert.equal(prisma.customers.length, 0);
  assert.match(sentTelegramPayloads[0]?.text ?? "", /o'zingizning telefon/i);
}

async function testSelfContactAcceptedAndVerify(): Promise<void> {
  sentTelegramPayloads.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const { prisma, telegramCustomerAuthService, customersService } = createServices();
  await telegramCustomerAuthService.handleWebhookUpdate({
    message: {
      chat: { id: 1003 },
      from: { id: 2003, first_name: "Sardor" },
      contact: { user_id: 2003, phone_number: "998901112255", first_name: "Sardor" },
    },
  });
  const code = latestCode();

  assert.equal(prisma.customers.length, 1);
  assert.equal(prisma.customers[0]?.phone, "+998901112255");
  assert.equal(prisma.customers[0]?.telegramUserId, "2003");
  assert.equal(prisma.customers[0]?.telegramChatId, "1003");
  assert.notEqual(prisma.challenges[0]?.codeHash, code);

  const auth = await customersService.verifyCode({
    phone: "+998 90 111 22 55",
    code,
    name: "Sardor",
  });
  assert.ok(auth.tokens.accessToken);
  assert.ok(auth.tokens.refreshToken);
  assert.equal(prisma.challenges[0]?.consumedAt instanceof Date, true);
}

async function testCodeRotationReuseExpiryAndAttempts(): Promise<void> {
  sentTelegramPayloads.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const { prisma, telegramCustomerAuthService, customersService } = createServices();
  await telegramCustomerAuthService.handleWebhookUpdate({
    message: {
      chat: { id: 1004 },
      from: { id: 2004, first_name: "Madina" },
      contact: { user_id: 2004, phone_number: "998901112266" },
    },
  });
  const firstCode = latestCode();

  const second = await customersService.requestCode({ phone: "+998901112266" });
  assert.equal(second.delivery.status, "SENT");
  const secondCode = latestCode();
  assert.notEqual(firstCode, secondCode);
  await expectRejects(
    () => customersService.verifyCode({ phone: "+998901112266", code: firstCode }),
    "old code must be rejected after resend",
  );
  await expectRejects(
    () => customersService.verifyCode({ phone: "+998901112266", code: "000000" }),
    "wrong code must be rejected",
  );
  const auth = await customersService.verifyCode({
    phone: "+998901112266",
    code: secondCode,
  });
  assert.ok(auth.tokens.accessToken);
  await expectRejects(
    () => customersService.verifyCode({ phone: "+998901112266", code: secondCode }),
    "reused code must be rejected",
  );

  const expiredCodeHash = await bcrypt.hash("123456", 12);
  await prisma.customerVerificationChallenge.create({
    data: {
      customerId: prisma.customers[0]?.id ?? null,
      phone: "+998901112277",
      codeHash: expiredCodeHash,
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await expectRejects(
    () => customersService.verifyCode({ phone: "+998901112277", code: "123456" }),
    "expired code must be rejected",
  );

  const attemptsCodeHash = await bcrypt.hash("654321", 12);
  await prisma.customerVerificationChallenge.create({
    data: {
      customerId: prisma.customers[0]?.id ?? null,
      phone: "+998901112288",
      codeHash: attemptsCodeHash,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectRejects(
      () => customersService.verifyCode({ phone: "+998901112288", code: "111111" }),
      "wrong attempt must be rejected",
    );
  }
  await expectRejects(
    () => customersService.verifyCode({ phone: "+998901112288", code: "654321" }),
    "code must be rejected after excessive attempts",
  );
}

async function testRequestCodeRateLimit(): Promise<void> {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const { customersService } = createServices();
  await customersService.requestCode({ phone: "+998901112299" });
  await customersService.requestCode({ phone: "+998901112299" });
  await customersService.requestCode({ phone: "+998901112299" });
  await expectRejects(
    () => customersService.requestCode({ phone: "+998901112299" }),
    "fourth request-code in the same minute must be rejected",
  );
}

async function testWebhookSecretAndStaffRegression(): Promise<void> {
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
  const { telegramCustomerAuthService } = createServices();
  const staffService = {
    called: 0,
    handleWebhook: async (secret: string, update: unknown) => {
      staffService.called += 1;
      return {
        ok: true,
        handled: true,
        secret,
        update,
        staff: true,
      };
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

  const startResult = await controller.handleWebhook("test-secret", {
    message: {
      chat: { id: 7001 },
      from: { id: 8001, first_name: "Test" },
      text: "/start",
    },
  });
  assert.equal(startResult.handled, true);
  assert.equal(staffService.called, 0);

  const result = await controller.handleWebhook("test-secret", {
    callback_query: {
      id: "callback-1",
      data: "mazetto_order:READY:order_1",
    },
  });
  assert.equal((result as { staff?: boolean }).staff, true);

  const realStaffService = new TelegramOrderNotificationService(
    {} as never,
    {} as never,
  );
  const parser = realStaffService as unknown as {
    parseCallbackData(data: string): { action: string; orderId: string };
  };
  assert.deepEqual(parser.parseCallbackData("mazetto_order:READY:order_1"), {
    action: "mark_ready",
    orderId: "order_1",
  });
}

void run();
