import type { AuthenticatedUser } from "../../common/types/authenticated-user";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
};

export type AuthResponse = {
  user: AuthenticatedUser;
  tokens: AuthTokens;
};

export type RefreshTokenPayload = AuthenticatedUser & {
  sessionId: string;
  tokenUse: "refresh";
};
