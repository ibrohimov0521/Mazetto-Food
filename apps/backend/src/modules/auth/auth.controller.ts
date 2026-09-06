import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuthService } from "./auth.service";
import type { AuthResponse } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthResponse> {
    return this.authService.login(dto, this.getClientAddress(request));
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  logout(@Body() dto: RefreshTokenDto): Promise<{ revoked: boolean }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Get("me")
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private getClientAddress(request: Request): string {
    const cloudflareIp = request.headers["cf-connecting-ip"];

    if (typeof cloudflareIp === "string" && cloudflareIp.trim()) {
      return cloudflareIp.trim();
    }

    const forwardedFor = request.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
      return forwardedFor.split(",")[0]?.trim() || "unknown";
    }

    if (Array.isArray(forwardedFor) && forwardedFor[0]?.trim()) {
      return forwardedFor[0].split(",")[0]?.trim() || "unknown";
    }

    return request.ip || request.socket.remoteAddress || "unknown";
  }
}
