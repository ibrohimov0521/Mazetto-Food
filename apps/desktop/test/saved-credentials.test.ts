import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSavedCredentialIdentifier,
  parseSavedDesktopCredentials,
  resolveDesktopLoginPassword,
  removeSavedDesktopCredential,
  shouldOfferDesktopCredentialSave,
  upsertSavedDesktopCredential,
} from "../src/saved-credentials.js";

test("saved desktop credentials deduplicate case-insensitive email identifiers", () => {
  const credentials = upsertSavedDesktopCredential(
    [{ identifier: "Owner@Example.test", password: "old" }],
    "owner@example.test",
    "new",
  );

  assert.deepEqual(credentials, [
    { identifier: "owner@example.test", password: "new" },
  ]);
});

test("credential parsing ignores malformed entries and caps retained accounts", () => {
  const serialized = JSON.stringify([
    { identifier: "cashier@example.test", password: "secret" },
    { identifier: "CASHIER@example.test", password: "duplicate" },
    { identifier: "", password: "invalid" },
    ...Array.from({ length: 12 }, (_, index) => ({
      identifier: `user${index}@example.test`,
      password: `secret-${index}`,
    })),
  ]);

  const credentials = parseSavedDesktopCredentials(serialized);

  assert.equal(credentials.length, 10);
  assert.deepEqual(credentials[0], {
    identifier: "cashier@example.test",
    password: "secret",
  });
  assert.deepEqual(parseSavedDesktopCredentials("not-json"), []);
});

test("phone identifiers normalize spacing and saved accounts can be removed", () => {
  assert.equal(
    normalizeSavedCredentialIdentifier("+998 (90) 123-45-67"),
    "+998901234567",
  );
  assert.deepEqual(
    removeSavedDesktopCredential(
      [
        { identifier: "+998 90 123 45 67", password: "secret" },
        { identifier: "other@example.test", password: "secret" },
      ],
      "+998901234567",
    ),
    [{ identifier: "other@example.test", password: "secret" }],
  );
});

test("credential save prompt is skipped only when the same password is already saved", () => {
  const credentials = [
    { identifier: "Owner@Example.test", password: "secret" },
  ];

  assert.equal(
    shouldOfferDesktopCredentialSave(
      credentials,
      "owner@example.test",
      "secret",
    ),
    false,
  );
  assert.equal(
    shouldOfferDesktopCredentialSave(
      credentials,
      "owner@example.test",
      "new-secret",
    ),
    true,
  );
  assert.equal(
    shouldOfferDesktopCredentialSave([], "new@example.test", "secret"),
    true,
  );
});
test("saved desktop password is resolved inside the main process by identifier", () => {
  const credentials = [
    { identifier: "Owner@Example.test", password: "owner-secret" },
    { identifier: "+998 90 123 45 67", password: "cashier-secret" },
  ];

  assert.equal(
    resolveDesktopLoginPassword(credentials, "owner@example.test", "", true),
    "owner-secret",
  );
  assert.equal(
    resolveDesktopLoginPassword(credentials, "+998901234567", "", true),
    "cashier-secret",
  );
  assert.equal(
    resolveDesktopLoginPassword(
      credentials,
      "owner@example.test",
      "typed",
      false,
    ),
    "typed",
  );
  assert.throws(
    () =>
      resolveDesktopLoginPassword(credentials, "other@example.test", "", true),
    /Saqlangan hisob topilmadi/,
  );
});
