import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import type { PutAssetDto } from "./dto/put-asset.dto";
import type { PutSceneDto } from "./dto/put-scene.dto";
import type { CollabService } from "./collab.service";

@ApiTags("collab")
@Controller("collab")
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  @Get("rooms/:roomId/scene")
  @ApiOperation({ summary: "Get encrypted room scene snapshot" })
  @ApiResponse({ status: 200, description: "Scene snapshot payload" })
  async getScene(@Param("roomId") roomId: string) {
    const scene = await this.collabService.getScene(roomId);
    return { scene };
  }

  @Put("rooms/:roomId/scene")
  @ApiOperation({ summary: "Save encrypted room scene snapshot" })
  @ApiResponse({ status: 200, description: "Scene snapshot saved" })
  async putScene(@Param("roomId") roomId: string, @Body() input: PutSceneDto) {
    const scene = await this.collabService.putScene(roomId, {
      sceneVersion: input.sceneVersion,
      ivBase64: input.iv,
      ciphertextBase64: input.ciphertext,
    });

    return { scene };
  }

  @Get("rooms/:roomId/files/:fileId")
  @ApiOperation({ summary: "Get encrypted collaboration file payload" })
  @ApiResponse({ status: 200, description: "File payload" })
  async getAsset(
    @Param("roomId") roomId: string,
    @Param("fileId") fileId: string,
  ) {
    const file = await this.collabService.getAsset(roomId, fileId);
    return { file };
  }

  @Put("rooms/:roomId/files/:fileId")
  @ApiOperation({ summary: "Save encrypted collaboration file payload" })
  @ApiResponse({ status: 200, description: "File payload saved" })
  async putAsset(
    @Param("roomId") roomId: string,
    @Param("fileId") fileId: string,
    @Body() input: PutAssetDto,
  ) {
    const file = await this.collabService.putAsset(roomId, fileId, {
      blobBase64: input.blob,
    });

    return { file };
  }
}
