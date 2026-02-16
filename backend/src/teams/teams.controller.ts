import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AuthUser } from "../common/decorators/auth-user.decorator";
import { AuthCookieGuard } from "../common/guards/auth-cookie.guard";

import type { AuthUserContext } from "../common/decorators/auth-user.decorator";

import type { AddMemberDto } from "./dto/add-member.dto";
import type { CreateTeamDto } from "./dto/create-team.dto";
import type { UpdateMemberDto } from "./dto/update-member.dto";
import type { TeamsService } from "./teams.service";

@ApiTags("teams")
@Controller("teams")
@UseGuards(AuthCookieGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: "List teams for current user" })
  @ApiResponse({ status: 200, description: "Teams listed" })
  async listTeams(@AuthUser() authUser: AuthUserContext) {
    const teams = await this.teamsService.listTeams({
      userId: authUser.userId,
    });
    return { teams };
  }

  @Post()
  @ApiOperation({ summary: "Create team" })
  @ApiResponse({ status: 201, description: "Team created" })
  async createTeam(
    @AuthUser() authUser: AuthUserContext,
    @Body() input: CreateTeamDto,
  ) {
    const team = await this.teamsService.createTeam(
      { userId: authUser.userId },
      { name: input.name.trim() },
    );

    return { team };
  }

  @Get(":id/members")
  @ApiOperation({ summary: "List team members" })
  @ApiResponse({ status: 200, description: "Team members listed" })
  async listMembers(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") teamId: string,
  ) {
    const members = await this.teamsService.listMembers(
      { userId: authUser.userId },
      teamId,
    );

    return { members };
  }

  @Post(":id/members")
  @ApiOperation({ summary: "Add team member" })
  @ApiResponse({ status: 200, description: "Member added" })
  async addMember(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") teamId: string,
    @Body() input: AddMemberDto,
  ) {
    const member = await this.teamsService.addMember(
      { userId: authUser.userId },
      teamId,
      {
        email: input.email.trim().toLowerCase(),
        role: input.role || "member",
      },
    );

    return { member };
  }

  @Patch(":id/members/:userId")
  @ApiOperation({ summary: "Update team member role" })
  @ApiResponse({ status: 200, description: "Member role updated" })
  async updateMemberRole(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") teamId: string,
    @Param("userId") userId: string,
    @Body() input: UpdateMemberDto,
  ) {
    const member = await this.teamsService.updateMemberRole(
      { userId: authUser.userId },
      teamId,
      userId,
      input.role,
    );

    return { member };
  }

  @Delete(":id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove team member" })
  @ApiResponse({ status: 204, description: "Member removed" })
  async removeMember(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") teamId: string,
    @Param("userId") userId: string,
  ) {
    await this.teamsService.removeMember(
      { userId: authUser.userId },
      teamId,
      userId,
    );
  }
}
