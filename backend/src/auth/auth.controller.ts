import {
  Body,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

import type { Request, Response } from "express";

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

const getConfigServiceFromContext = (
  context: ExecutionContext,
): ConfigService | null => {
  const request = context.switchToHttp().getRequest<RequestWithCookies & {
    app?: { get?: (token: unknown) => unknown };
  }>();

  const resolved = request.app?.get?.(ConfigService);
  return resolved instanceof ConfigService ? resolved : null;
};

const resolveAuthThrottleLimit = (context: ExecutionContext): number => {
  const configService = getConfigServiceFromContext(context);
  return Number(configService?.get<number>("AUTH_THROTTLE_LIMIT") || 10);
};

const resolveAuthThrottleTtl = (context: ExecutionContext): number => {
  const configService = getConfigServiceFromContext(context);
  return Number(configService?.get<number>("AUTH_THROTTLE_TTL") || 60) * 1000;
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("csrf")
  @ApiOperation({ summary: "Issue CSRF token and cookie" })
  @ApiResponse({ status: 200, description: "CSRF token issued" })
  csrf(@Res({ passthrough: true }) response: Response) {
    const csrfToken = this.authService.generateCsrfToken();
    this.authService.setCsrfCookie(response, csrfToken);
    return { csrfToken };
  }

  @Post("register")
  @Throttle({
    default: {
      limit: resolveAuthThrottleLimit,
      ttl: resolveAuthThrottleTtl,
    },
  })
  @ApiOperation({ summary: "Register account" })
  @ApiResponse({ status: 201, description: "Registered successfully" })
  @ApiResponse({ status: 409, description: "Email already registered" })
  async register(@Body() input: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.authService.register({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      displayName: input.displayName?.trim(),
    });

    this.authService.setAuthCookie(response, user);
    response.status(201);

    return { user };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: resolveAuthThrottleLimit,
      ttl: resolveAuthThrottleTtl,
    },
  })
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Logged in" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.authService.login({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });

    this.authService.setAuthCookie(response, user);
    return { user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: resolveAuthThrottleLimit,
      ttl: resolveAuthThrottleTtl,
    },
  })
  @ApiOperation({ summary: "Logout current user" })
  @ApiResponse({ status: 204, description: "Logged out" })
  async logout(@Res({ passthrough: true }) response: Response) {
    const cookieName = this.authService.getAuthCookieName();
    const token = (response.req as RequestWithCookies)?.cookies?.[cookieName];
    const payload = this.authService.verifyTokenFromCookie(token);

    await this.authService.logLogout(payload?.sub || null, payload?.email);

    this.authService.clearAuthCookie(response);
    this.authService.setCsrfCookie(response, this.authService.generateCsrfToken());
  }

  @Get("me")
  @Throttle({
    default: {
      limit: resolveAuthThrottleLimit,
      ttl: resolveAuthThrottleTtl,
    },
  })
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiResponse({ status: 200, description: "Authenticated user" })
  @ApiResponse({ status: 401, description: "Unauthenticated" })
  async me(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.authService.getAuthCookieName();
    const token = request.cookies?.[cookieName];
    const payload = this.authService.verifyTokenFromCookie(token);

    if (!payload) {
      response.status(401);
      return { user: null };
    }

    const user = await this.authService.getCurrentUser(payload.sub);
    if (!user) {
      this.authService.clearAuthCookie(response);
      response.status(401);
      return { user: null };
    }

    return { user };
  }
}
