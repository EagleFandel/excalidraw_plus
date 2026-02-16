import { Injectable } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";

type AuditAction =
  | "AUTH_REGISTER"
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "TEAM_MEMBER_ADD"
  | "TEAM_MEMBER_ROLE_UPDATE"
  | "TEAM_MEMBER_REMOVE"
  | "FILE_DELETE_SOFT"
  | "FILE_DELETE_PERMANENT"
  | "COLLAB_SCENE_SAVE"
  | "COLLAB_ASSET_SAVE"
  | "AI_DIAGRAM_TO_CODE"
  | "AI_TEXT_TO_DIAGRAM";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    action: AuditAction;
    actorUserId?: string | null;
    targetUserId?: string | null;
    fileId?: string | null;
    teamId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId || null,
        targetUserId: input.targetUserId || null,
        fileId: input.fileId || null,
        teamId: input.teamId || null,
        metadata: (input.metadata || {}) as unknown as object,
      },
    });
  }
}
