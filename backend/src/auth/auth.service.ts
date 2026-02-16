import { randomBytes, timingSafeEqual } from "crypto";

import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from "../common/exceptions/domain-errors";

import type { AuditService } from "../audit/audit.service";
import type { UsersService } from "../users/users.service";

import type { Response } from "express";
import type { StringValue } from "ms";

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

type JwtPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthUser> {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.usersService.createUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });

    await this.auditService.log({
      action: "AUTH_REGISTER",
      actorUserId: user.id,
      targetUserId: user.id,
      metadata: { email: user.email },
    });

    return this.toAuthUser(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthUser> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    await this.auditService.log({
      action: "AUTH_LOGIN",
      actorUserId: user.id,
      targetUserId: user.id,
      metadata: { email: user.email },
    });

    return this.toAuthUser(user);
  }

  async getCurrentUser(userId: string): Promise<AuthUser | null> {
    const user = await this.usersService.findById(userId);
    return user ? this.toAuthUser(user) : null;
  }

  setAuthCookie(response: Response, user: AuthUser) {
    const jwtSecret =
      this.configService.get<string>("JWT_SECRET") || "change-me";
    const jwtExpiresIn =
      (this.configService.get<string>("JWT_EXPIRES_IN") as
        | StringValue
        | number
        | undefined) || "7d";
    const authCookieName =
      this.configService.get<string>("AUTH_COOKIE_NAME") || "excplus-auth";
    const authCookieSecure =
      this.configService.get<boolean>("AUTH_COOKIE_SECURE") || false;
    const authCookieSameSite =
      (this.configService.get<string>("AUTH_COOKIE_SAME_SITE") as
        | "lax"
        | "strict"
        | "none"
        | undefined) || "lax";
    const authCookieDomain =
      this.configService.get<string>("AUTH_COOKIE_DOMAIN") || undefined;

    const token = jwt.sign({ sub: user.id, email: user.email }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    response.cookie(authCookieName, token, {
      httpOnly: true,
      secure: authCookieSecure,
      sameSite: authCookieSameSite,
      domain: authCookieDomain,
      path: "/",
    });
  }

  clearAuthCookie(response: Response) {
    const authCookieName =
      this.configService.get<string>("AUTH_COOKIE_NAME") || "excplus-auth";
    const authCookieDomain =
      this.configService.get<string>("AUTH_COOKIE_DOMAIN") || undefined;

    response.clearCookie(authCookieName, {
      path: "/",
      domain: authCookieDomain,
    });
  }

  verifyTokenFromCookie(cookieValue: string | undefined): JwtPayload | null {
    if (!cookieValue) {
      return null;
    }

    const jwtSecret =
      this.configService.get<string>("JWT_SECRET") || "change-me";

    try {
      const decoded = jwt.verify(cookieValue, jwtSecret) as JwtPayload;
      if (!decoded?.sub || !decoded?.email) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  getAuthCookieName() {
    return this.configService.get<string>("AUTH_COOKIE_NAME") || "excplus-auth";
  }

  getCsrfCookieName() {
    return this.configService.get<string>("CSRF_COOKIE_NAME") || "excplus-csrf";
  }

  getCsrfHeaderName() {
    return this.configService.get<string>("CSRF_HEADER_NAME") || "x-csrf-token";
  }

  setCsrfCookie(response: Response, token: string) {
    const cookieName = this.getCsrfCookieName();
    const authCookieSecure =
      this.configService.get<boolean>("AUTH_COOKIE_SECURE") || false;
    const authCookieSameSite =
      (this.configService.get<string>("AUTH_COOKIE_SAME_SITE") as
        | "lax"
        | "strict"
        | "none"
        | undefined) || "lax";
    const authCookieDomain =
      this.configService.get<string>("AUTH_COOKIE_DOMAIN") || undefined;

    response.cookie(cookieName, token, {
      httpOnly: false,
      secure: authCookieSecure,
      sameSite: authCookieSameSite,
      domain: authCookieDomain,
      path: "/",
    });
  }

  generateCsrfToken() {
    return randomBytes(32).toString("hex");
  }

  verifyCsrfToken(
    cookieToken: string | undefined,
    headerToken: string | undefined,
  ) {
    if (!cookieToken || !headerToken) {
      return false;
    }

    try {
      const cookieBuffer = Buffer.from(cookieToken);
      const headerBuffer = Buffer.from(headerToken);
      if (cookieBuffer.length !== headerBuffer.length) {
        return false;
      }
      return timingSafeEqual(cookieBuffer, headerBuffer);
    } catch {
      return false;
    }
  }

  async logLogout(userId: string | null, email?: string) {
    await this.auditService.log({
      action: "AUTH_LOGOUT",
      actorUserId: userId,
      targetUserId: userId,
      metadata: email ? { email } : undefined,
    });
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    displayName: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
