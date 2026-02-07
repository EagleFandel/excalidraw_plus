import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { UnauthorizedError } from "../exceptions/domain-errors";

export type AuthUserContext = {
  userId: string;
};

type RequestWithAuth = {
  authUserId?: string;
};

export const AuthUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUserContext => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.authUserId) {
      throw new UnauthorizedError("Authentication required");
    }

    return {
      userId: request.authUserId,
    };
  },
);

