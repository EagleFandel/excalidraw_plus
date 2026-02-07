import { Module } from "@nestjs/common";

import { AuthCookieGuard } from "../common/guards/auth-cookie.guard";
import { UsersModule } from "../users/users.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthCookieGuard],
  exports: [AuthService, AuthCookieGuard],
})
export class AuthModule {}
