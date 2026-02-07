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

import { AuthUser, AuthUserContext } from "../common/decorators/auth-user.decorator";
import { AuthCookieGuard } from "../common/guards/auth-cookie.guard";

import { AddMemberDto } from "./dto/add-member.dto";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { TeamsService } from "./teams.service";

@Controller("teams")
@UseGuards(AuthCookieGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async listTeams(@AuthUser() authUser: AuthUserContext) {
    const teams = await this.teamsService.listTeams({ userId: authUser.userId });
    return { teams };
  }

  @Post()
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
  async removeMember(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") teamId: string,
    @Param("userId") userId: string,
  ) {
    await this.teamsService.removeMember({ userId: authUser.userId }, teamId, userId);
  }
}

