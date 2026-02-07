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

import { AuthUser, AuthUserContext } from "../common/decorators/auth-user.decorator";
import { InvalidInputError } from "../common/exceptions/domain-errors";
import { AuthCookieGuard } from "../common/guards/auth-cookie.guard";

import { CreateFileDto } from "./dto/create-file.dto";
import { FavoriteDto } from "./dto/favorite.dto";
import { ListFilesQuery } from "./dto/list-files.query";
import { SaveFileDto } from "./dto/save-file.dto";
import { FilesService } from "./files.service";

@Controller("files")
@UseGuards(AuthCookieGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
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
  async createFile(
    @AuthUser() authUser: AuthUserContext,
    @Body() input: CreateFileDto,
  ) {
    const file = await this.filesService.createPersonalFile(
      { userId: authUser.userId },
      {
        title: input.title,
        teamId: input.scope === "team" ? (input.teamId || null) : null,
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
  async getFile(@AuthUser() authUser: AuthUserContext, @Param("id") fileId: string) {
    const file = await this.filesService.getFile({ userId: authUser.userId }, fileId);
    return { file };
  }

  @Put(":id")
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
  async trashFile(@AuthUser() authUser: AuthUserContext, @Param("id") fileId: string) {
    await this.filesService.trashFile({ userId: authUser.userId }, fileId);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  async restoreFile(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
  ) {
    const file = await this.filesService.restoreFile({ userId: authUser.userId }, fileId);
    return { file };
  }

  @Delete(":id/permanent")
  @HttpCode(HttpStatus.NO_CONTENT)
  async permanentlyDelete(
    @AuthUser() authUser: AuthUserContext,
    @Param("id") fileId: string,
  ) {
    await this.filesService.permanentlyDeleteFile({ userId: authUser.userId }, fileId);
  }

  @Patch(":id/favorite")
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
