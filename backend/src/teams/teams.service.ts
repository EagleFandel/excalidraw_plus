import { Injectable } from "@nestjs/common";

import {
  ForbiddenError,
  TeamNotFoundError,
} from "../common/exceptions/domain-errors";

import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../prisma/prisma.service";

import type { TeamRole } from "@prisma/client";

export type AuthContext = {
  userId: string;
};

const mapTeam = (team: {
  id: string;
  name: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: team.id,
  name: team.name,
  createdByUserId: team.createdByUserId,
  createdAt: team.createdAt.toISOString(),
  updatedAt: team.updatedAt.toISOString(),
});

const mapTeamMember = (member: {
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}) => ({
  teamId: member.teamId,
  userId: member.userId,
  role: member.role,
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString(),
  user: {
    id: member.user.id,
    email: member.user.email,
    displayName: member.user.displayName,
  },
});

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listTeams(ctx: AuthContext) {
    const members = await this.prisma.teamMember.findMany({
      where: {
        userId: ctx.userId,
      },
      include: {
        team: true,
      },
      orderBy: {
        team: {
          updatedAt: "desc",
        },
      },
    });

    return members.map((member) => ({
      ...mapTeam(member.team),
      role: member.role,
    }));
  }

  async createTeam(ctx: AuthContext, input: { name: string }) {
    const team = await this.prisma.team.create({
      data: {
        name: input.name,
        createdByUserId: ctx.userId,
        members: {
          create: {
            userId: ctx.userId,
            role: "owner",
          },
        },
      },
    });

    return {
      ...mapTeam(team),
      role: "owner" as const,
    };
  }

  async listMembers(ctx: AuthContext, teamId: string) {
    await this.assertTeamMembership(ctx.userId, teamId);

    const members = await this.prisma.teamMember.findMany({
      where: {
        teamId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return members.map(mapTeamMember);
  }

  async addMember(
    ctx: AuthContext,
    teamId: string,
    input: {
      email: string;
      role: TeamRole;
    },
  ) {
    const actorRole = await this.assertTeamAdmin(ctx.userId, teamId);
    if (!actorRole) {
      throw new ForbiddenError("Only owner/admin can manage members");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: input.email,
          mode: "insensitive",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!user) {
      throw new TeamNotFoundError("Team or user not found");
    }

    const member = await this.prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId,
          userId: user.id,
        },
      },
      create: {
        teamId,
        userId: user.id,
        role: input.role,
      },
      update: {
        role: input.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    await this.auditService.log({
      action: "TEAM_MEMBER_ADD",
      actorUserId: ctx.userId,
      targetUserId: user.id,
      teamId,
      metadata: { role: member.role },
    });

    return mapTeamMember(member);
  }

  async updateMemberRole(
    ctx: AuthContext,
    teamId: string,
    userId: string,
    role: TeamRole,
  ) {
    const actorRole = await this.assertTeamAdmin(ctx.userId, teamId);
    if (!actorRole) {
      throw new ForbiddenError("Role change is not allowed");
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!existing) {
      throw new TeamNotFoundError("Team or member not found");
    }

    if (existing.role === "owner" && role !== "owner") {
      const ownerCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: "owner",
        },
      });

      if (ownerCount <= 1) {
        throw new ForbiddenError("Role change is not allowed");
      }
    }

    const member = await this.prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: {
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    await this.auditService.log({
      action: "TEAM_MEMBER_ROLE_UPDATE",
      actorUserId: ctx.userId,
      targetUserId: userId,
      teamId,
      metadata: { role },
    });

    return mapTeamMember(member);
  }

  async removeMember(ctx: AuthContext, teamId: string, userId: string) {
    const actorRole = await this.assertTeamAdmin(ctx.userId, teamId);
    if (!actorRole) {
      throw new ForbiddenError("Member removal is not allowed");
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!existing) {
      throw new TeamNotFoundError("Team or member not found");
    }

    if (existing.role === "owner") {
      const ownerCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: "owner",
        },
      });

      if (ownerCount <= 1) {
        throw new ForbiddenError("Member removal is not allowed");
      }
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    await this.auditService.log({
      action: "TEAM_MEMBER_REMOVE",
      actorUserId: ctx.userId,
      targetUserId: userId,
      teamId,
      metadata: { removedRole: existing.role },
    });
  }

  async getTeamRole(userId: string, teamId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    return member?.role || null;
  }

  private async assertTeamMembership(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      throw new TeamNotFoundError("Team not found");
    }

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenError("No access to this team");
    }

    return member.role;
  }

  private async assertTeamAdmin(userId: string, teamId: string) {
    const role = await this.assertTeamMembership(userId, teamId);

    if (role !== "owner" && role !== "admin") {
      return null;
    }

    return role;
  }
}
