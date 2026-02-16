import { Injectable } from "@nestjs/common";

import { UnauthorizedError } from "../exceptions/domain-errors";

import type { CanActivate, ExecutionContext } from "@nestjs/common";

import type { AuthService } from "../../auth/auth.service";

type RequestWithCookies = {
  cookies?: Record<string, string | undefined>;
  authUserId?: string;
};

@Injectable()
export class AuthCookieGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const cookieName = this.authService.getAuthCookieName();
    const token = request.cookies?.[cookieName];
    const payload = this.authService.verifyTokenFromCookie(token);

    if (!payload) {
      throw new UnauthorizedError("Authentication required");
    }

    request.authUserId = payload.sub;
    return true;
  }
}
