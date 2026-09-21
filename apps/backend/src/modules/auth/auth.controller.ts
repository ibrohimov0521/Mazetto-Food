import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { resolveClientAddress } from "../../common/http/client-address";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuthService } from "./auth.service";
import type { AuthResponse } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { clearRefreshCookie, readRefreshToken, setRefreshCookie, STAFF_REFRESH_COOKIE } from "../../common/auth/refresh-cookie";

const STAFF_COOKIE_PATH = "/api/v1/auth";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse> {
    const result = await this.authService.login(dto, resolveClientAddress(request));
    setRefreshCookie(response, STAFF_REFRESH_COOKIE, result.tokens.refreshToken, STAFF_COOKIE_PATH, Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS ?? 604800));
    return result;
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse> {
    const token = readRefreshToken(request, dto.refreshToken, STAFF_REFRESH_COOKIE);
    if (!token) throw new UnauthorizedException("Refresh token is required");
    const result = await this.authService.refresh(token);
    setRefreshCookie(response, STAFF_REFRESH_COOKIE, result.tokens.refreshToken, STAFF_COOKIE_PATH, Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS ?? 604800));
    return result;
  }

  @Public()
  @Post("logout")
  logout(@Body() dto: RefreshTokenDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ revoked: boolean }> | { revoked: false } {
    const token = readRefreshToken(request, dto.refreshToken, STAFF_REFRESH_COOKIE);
    clearRefreshCookie(response, STAFF_REFRESH_COOKIE, STAFF_COOKIE_PATH);
    return token ? this.authService.logout(token) : { revoked: false };
  }

  @Get("me")
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
