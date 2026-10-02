export type SavedDesktopCredential = {
  identifier: string;
  password: string;
};

const MAX_SAVED_DESKTOP_CREDENTIALS = 10;
const MAX_CREDENTIAL_IDENTIFIER_LENGTH = 254;
const MAX_CREDENTIAL_PASSWORD_LENGTH = 4096;

export function normalizeSavedCredentialIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes("@")
    ? trimmed.toLowerCase()
    : trimmed.replace(/[\s()-]/g, "");
}

export function parseSavedDesktopCredentials(
  serialized: string | null,
): SavedDesktopCredential[] {
  if (!serialized) return [];

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];

    const credentials: SavedDesktopCredential[] = [];
    const seen = new Set<string>();
    for (const value of parsed) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Record<string, unknown>;
      if (
        typeof entry.identifier !== "string" ||
        typeof entry.password !== "string"
      ) {
        continue;
      }
      const identifier = entry.identifier.trim();
      const normalized = normalizeSavedCredentialIdentifier(identifier);
      if (
        !normalized ||
        identifier.length > MAX_CREDENTIAL_IDENTIFIER_LENGTH ||
        !entry.password ||
        entry.password.length > MAX_CREDENTIAL_PASSWORD_LENGTH ||
        seen.has(normalized)
      ) {
        continue;
      }
      seen.add(normalized);
      credentials.push({ identifier, password: entry.password });
      if (credentials.length === MAX_SAVED_DESKTOP_CREDENTIALS) break;
    }
    return credentials;
  } catch {
    return [];
  }
}

export function upsertSavedDesktopCredential(
  credentials: SavedDesktopCredential[],
  identifier: string,
  password: string,
): SavedDesktopCredential[] {
  const normalized = normalizeSavedCredentialIdentifier(identifier);
  const trimmedIdentifier = identifier.trim();
  if (
    !normalized ||
    trimmedIdentifier.length > MAX_CREDENTIAL_IDENTIFIER_LENGTH ||
    !password ||
    password.length > MAX_CREDENTIAL_PASSWORD_LENGTH
  ) {
    throw new Error("Login yoki parol uzunligi noto'g'ri");
  }

  return [
    { identifier: trimmedIdentifier, password },
    ...credentials.filter(
      (entry) =>
        normalizeSavedCredentialIdentifier(entry.identifier) !== normalized,
    ),
  ].slice(0, MAX_SAVED_DESKTOP_CREDENTIALS);
}

export function removeSavedDesktopCredential(
  credentials: SavedDesktopCredential[],
  identifier: string,
): SavedDesktopCredential[] {
  const normalized = normalizeSavedCredentialIdentifier(identifier);
  return credentials.filter(
    (entry) =>
      normalizeSavedCredentialIdentifier(entry.identifier) !== normalized,
  );
}
