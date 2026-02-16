import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";

import { AiController } from "./ai.controller";
import { AiRateLimitService } from "./ai-rate-limit.service";
import { AiService } from "./ai.service";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible.provider";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AiController],
  providers: [AiService, AiRateLimitService, OpenAiCompatibleProvider],
})
export class AiModule {}
