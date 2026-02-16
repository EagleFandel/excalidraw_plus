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
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AuthUser } from "../common/decorators/auth-user.decorator";
import { InvalidInputError } from "../common/exceptions/domain-errors";
import { AuthCookieGuard } from "../common/guards/auth-cookie.guard";

import type { AuthUserContext } from "../common/decorators/auth-user.decorator";

import type { CreateFileDto } from "./dto/create-file.dto";
import type { FavoriteDto } from "./dto/favorite.dto";
import type { ListFilesQuery } from "./dto/list-files.query";
import type { SaveFileDto } from "./dto/save-file.dto";
import type { FilesService } from "./files.service";

@ApiTags("files")
@Controller("files")
@UseGuards(AuthCookieGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: "List files" })
  @ApiQuery({ name: "scope", required: false, enum: ["personal", "team"] })
  @ApiQuery({ name: "teamId", required: false, type: String })
  @ApiQuery({
    name: "includeTrashed",
    required: false,
    enum: ["true", "false"],
  })
  @ApiQuery({ name: "favoritesOnly", required: false, enum: ["true", "false"] })
  @ApiResponse({ status: 200, description: "Files listed" })
  async listFiles(
    @AuthUser() authUser: AuthUserContext,
    @Query() query: ListFilesQuery,
  ) {
    if (query.scope === "team" && !query.teamId) {
      throw new InvalidInputError("teamId is required");
    }

    const files = await this.filesService.listFiles(
      { userId: authUser.userId },
      {
        scope: query.scope,
        teamId: query.teamId,
        includeTrashed: query.includeTrashed === "true",
        favoritesOnly: query.favoritesOnly === "true",
      },
    );

    return { files };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create file" })
  @ApiResponse({ status: 201, description: "File created" })
  async createFile(
    @AuthUser() authUser: AuthUserContext,
    @Body() input: CreateFileDto,
  ) {
    const file = await this.filesService.createPersonalFile(
      { userId: authUser.userId },
      {
        title: input.title,
        teamId: input.scope === "team" ? input.teamId || null : null,
        scene: input.scene
          ? {
              elements: input.scene.elements,
              appState: input.scene.appState || {},
              files: input.scene.files || {},
            }
          : undefined,
      },
    );

    return { file };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get file by id" })
  @ApiResponse({ status: 200, description: "File details" })
  async getFile(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
  ) {
    const file = await this.filesService.getFile(
      { userId: authUser.userId },
      fileId,
    );
    return { file };
  }

  @Put(":id")
  @ApiOperation({ summary: "Save file" })
  @ApiResponse({ status: 200, description: "File saved" })
  @ApiResponse({ status: 409, description: "Version conflict" })
  async saveFile(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
    @Body() input: SaveFileDto,
  ) {
    const file = await this.filesService.saveFile(
      { userId: authUser.userId },
      {
        fileId,
        version: input.version,
        title: input.title,
        scene: {
          elements: input.scene.elements,
          appState: input.scene.appState || {},
          files: input.scene.files || {},
        },
      },
    );

    return { file };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Move file to trash" })
  @ApiResponse({ status: 204, description: "File trashed" })
  async trashFile(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
  ) {
    await this.filesService.trashFile({ userId: authUser.userId }, fileId);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Restore trashed file" })
  @ApiResponse({ status: 200, description: "File restored" })
  async restoreFile(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
  ) {
    const file = await this.filesService.restoreFile(
      { userId: authUser.userId },
      fileId,
    );
    return { file };
  }

  @Delete(":id/permanent")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Permanently delete file" })
  @ApiResponse({ status: 204, description: "File deleted permanently" })
  async permanentlyDelete(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
  ) {
    await this.filesService.permanentlyDeleteFile(
      { userId: authUser.userId },
      fileId,
    );
  }

  @Patch(":id/favorite")
  @ApiOperation({ summary: "Set file favorite flag" })
  @ApiResponse({ status: 200, description: "File favorite status updated" })
  async setFavorite(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
    @Body() input: FavoriteDto,
  ) {
    const file = await this.filesService.setFavorite(
      { userId: authUser.userId },
      fileId,
      input.isFavorite,
    );

    return { file };
  }
}
