import { Injectable } from "@nestjs/common";

import {
  FileNotFoundError,
  ForbiddenError,
  VersionConflictError,
} from "../common/exceptions/domain-errors";

import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { TeamsService } from "../teams/teams.service";

import type { File, FileContent, Prisma } from "@prisma/client";

const DEFAULT_SCENE: FileScenePayload = {
  elements: [],
  appState: {},
  files: {},
};

export type FileScenePayload = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type AuthContext = {
  userId: string;
};

type FileScope = "personal" | "team";

type FileWithOptionalContent = File & {
  content: Pick<FileContent, "scene"> | null;
};

const mapFileRecord = (file: FileWithOptionalContent, includeScene = false) => {
  const base = {
    id: file.id,
    title: file.title,
    version: file.version,
    ownerUserId: file.ownerUserId,
    teamId: file.teamId,
    lastOpenedAt: file.lastOpenedAt?.toISOString() || null,
    isFavorite: file.isFavorite,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };

  if (!includeScene) {
    return base;
  }

  return {
    ...base,
    scene: file.content
      ? (file.content.scene as FileScenePayload)
      : DEFAULT_SCENE,
  };
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
    private readonly auditService: AuditService,
  ) {}

  async listPersonalFiles(ctx: AuthContext) {
    const files = await this.prisma.file.findMany({
      where: {
        ownerUserId: ctx.userId,
        teamId: null,
        isTrashed: false,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return files.map((file) => mapFileRecord({ ...file, content: null }));
  }

  async createPersonalFile(
    ctx: AuthContext,
    input?: {
      title?: string;
      scene?: FileScenePayload;
      teamId?: string | null;
    },
  ) {
    const title = input?.title?.trim() || "Untitled";
    const scene: FileScenePayload = input?.scene || DEFAULT_SCENE;
    const teamId = input?.teamId || null;

    if (teamId) {
      const role = await this.teamsService.getTeamRole(ctx.userId, teamId);
      if (!role) {
        throw new ForbiddenError();
      }
    }

    const file = await this.prisma.file.create({
      data: {
        title,
        ownerUserId: ctx.userId,
        teamId,
        content: {
          create: {
            scene: scene as Prisma.InputJsonValue,
          },
        },
      },
      include: {
        content: true,
      },
    });

    return mapFileRecord(file, true);
  }

  async getFile(ctx: AuthContext, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        content: true,
      },
    });

    if (!file || file.isTrashed) {
      throw new FileNotFoundError();
    }

    await this.assertAccess(ctx.userId, file.ownerUserId, file.teamId, "read");

    await this.prisma.file.update({
      where: {
        id: fileId,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });

    return mapFileRecord(file, true);
  }

  async saveFile(
    ctx: AuthContext,
    input: {
      fileId: string;
      version: number;
      title?: string;
      scene: FileScenePayload;
    },
  ) {
    const existing = await this.prisma.file.findUnique({
      where: {
        id: input.fileId,
      },
    });

    if (!existing || existing.isTrashed) {
      throw new FileNotFoundError();
    }

    await this.assertAccess(
      ctx.userId,
      existing.ownerUserId,
      existing.teamId,
      "write",
    );

    if (existing.version !== input.version) {
      throw new VersionConflictError(existing.version);
    }

    const nextVersion = existing.version + 1;

    const file = await this.prisma.file.update({
      where: {
        id: input.fileId,
      },
      data: {
        title: input.title?.trim() || existing.title,
        version: nextVersion,
        content: {
          upsert: {
            create: {
              scene: input.scene as Prisma.InputJsonValue,
            },
            update: {
              scene: input.scene as Prisma.InputJsonValue,
            },
          },
        },
      },
      include: {
        content: true,
      },
    });

    return mapFileRecord(file, true);
  }

  async trashFile(ctx: AuthContext, fileId: string) {
    const existing = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!existing || existing.isTrashed) {
      throw new FileNotFoundError();
    }

    await this.assertAccess(
      ctx.userId,
      existing.ownerUserId,
      existing.teamId,
      "write",
    );

    await this.prisma.file.update({
      where: {
        id: fileId,
      },
      data: {
        isTrashed: true,
        trashedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: "FILE_DELETE_SOFT",
      actorUserId: ctx.userId,
      fileId,
      teamId: existing.teamId,
      metadata: {
        ownerUserId: existing.ownerUserId,
      },
    });
  }

  async listFiles(
    ctx: AuthContext,
    input?: {
      scope?: FileScope;
      includeTrashed?: boolean;
      teamId?: string;
      favoritesOnly?: boolean;
    },
  ) {
    const scope = input?.scope || "personal";
    const includeTrashed = input?.includeTrashed || false;

    if (scope === "team") {
      const teamId = input?.teamId;
      if (!teamId) {
        throw new ForbiddenError();
      }

      const role = await this.teamsService.getTeamRole(ctx.userId, teamId);
      if (!role) {
        throw new ForbiddenError();
      }

      const files = await this.prisma.file.findMany({
        where: {
          teamId,
          isTrashed: includeTrashed ? undefined : false,
          isFavorite: input?.favoritesOnly ? true : undefined,
        },
        orderBy: [{ lastOpenedAt: "desc" }, { updatedAt: "desc" }],
      });

      return files.map((file) => mapFileRecord({ ...file, content: null }));
    }

    const files = await this.prisma.file.findMany({
      where: {
        ownerUserId: ctx.userId,
        teamId: null,
        isTrashed: includeTrashed ? undefined : false,
        isFavorite: input?.favoritesOnly ? true : undefined,
      },
      orderBy: [{ lastOpenedAt: "desc" }, { updatedAt: "desc" }],
    });

    return files.map((file) => mapFileRecord({ ...file, content: null }));
  }

  async restoreFile(ctx: AuthContext, fileId: string) {
    const existing = await this.prisma.file.findUnique({
      where: {
        id: fileId,
      },
    });

    if (!existing || !existing.isTrashed) {
      throw new FileNotFoundError();
    }

    await this.assertAccess(
      ctx.userId,
      existing.ownerUserId,
      existing.teamId,
      "write",
    );

    const file = await this.prisma.file.update({
      where: {
        id: fileId,
      },
      data: {
        isTrashed: false,
        trashedAt: null,
      },
      include: {
        content: true,
      },
    });

    return mapFileRecord(file, true);
  }

  async permanentlyDeleteFile(ctx: AuthContext, fileId: string) {
    const existing = await this.prisma.file.findUnique({
      where: {
        id: fileId,
      },
    });

    if (!existing || !existing.isTrashed) {
      throw new FileNotFoundError();
    }

    await this.assertAccess(
      ctx.userId,
      existing.ownerUserId,
      existing.teamId,
      "write",
    );

    await this.auditService.log({
      action: "FILE_DELETE_PERMANENT",
      actorUserId: ctx.userId,
      fileId,
      teamId: existing.teamId,
      metadata: {
        ownerUserId: existing.ownerUserId,
      },
    });

    await this.prisma.file.delete({
      where: {
        id: fileId,
      },
    });
  }

  async setFavorite(ctx: AuthContext, fileId: string, isFavorite: boolean) {
    const existing = await this.prisma.file.findUnique({
      where: {
        id: fileId,
      },
    });

    if (!existing || existing.isTrashed) {
      throw new FileNotFoundError();
    }

    await this.assertAccess(
      ctx.userId,
      existing.ownerUserId,
      existing.teamId,
      "write",
    );

    const file = await this.prisma.file.update({
      where: {
        id: fileId,
      },
      data: {
        isFavorite,
      },
      include: {
        content: true,
      },
    });

    return mapFileRecord(file, true);
  }

  private async assertAccess(
    userId: string,
    ownerUserId: string,
    teamId: string | null,
    mode: "read" | "write",
  ) {
    if (!teamId) {
      if (ownerUserId !== userId) {
        throw new ForbiddenError();
      }
      return;
    }

    const role = await this.teamsService.getTeamRole(userId, teamId);
    if (!role) {
      throw new ForbiddenError();
    }

    if (mode === "write" && !["owner", "admin", "member"].includes(role)) {
      throw new ForbiddenError();
    }
  }
}
