import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AiModule } from "./ai/ai.module";
import { CollabModule } from "./collab/collab.module";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { ProxyThrottlerGuard } from "./common/guards/proxy-throttler.guard";
import { HealthModule } from "./health/health.module";
import { validateEnv } from "./config/env.validation";
import { FilesModule } from "./files/files.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TeamsModule } from "./teams/teams.module";
import { UsersModule } from "./users/users.module";
import { MetricsController } from "./common/metrics/metrics.controller";
import { MetricsService } from "./common/metrics/metrics.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: "default",
          ttl: Number(configService.get<number>("THROTTLE_TTL") || 60) * 1000,
          limit: Number(configService.get<number>("THROTTLE_LIMIT") || 120),
        },
      ],
    }),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    TeamsModule,
    FilesModule,
    HealthModule,
    CollabModule,
    AiModule,
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    CsrfGuard,
    {
      provide: APP_GUARD,
      useClass: ProxyThrottlerGuard,
    },
  ],
})
export class AppModule {}
