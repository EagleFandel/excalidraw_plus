import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";

import { CollabController } from "./collab.controller";
import { CollabGateway } from "./collab.gateway";
import { CollabService } from "./collab.service";

@Module({
  imports: [AuditModule],
  controllers: [CollabController],
  providers: [CollabService, CollabGateway],
})
export class CollabModule {}
