import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { validateEnv } from "./config/env.validation";
import { FilesModule } from "./files/files.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TeamsModule } from "./teams/teams.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    TeamsModule,
    FilesModule,
    HealthModule,
  ],
})
export class AppModule {}

