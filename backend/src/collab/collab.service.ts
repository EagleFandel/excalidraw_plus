import { Injectable } from "@nestjs/common";

import {
  CollabAssetNotFoundError,
  InvalidInputError,
  PayloadTooLargeError,
} from "../common/exceptions/domain-errors";

import type { ConfigService } from "@nestjs/config";

import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../prisma/prisma.service";

type SceneRecord = {
  roomId: string;
  sceneVersion: number;
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

type AssetRecord = {
  roomId: string;
  fileId: string;
  blob: string;
  sizeBytes: number;
  updatedAt: string;
};

const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const FILE_ID_REGEX = /^[a-zA-Z0-9_-]{1,256}$/;

const assertMatch = (value: string, regex: RegExp, fieldName: string) => {
  if (!regex.test(value)) {
    throw new InvalidInputError(`Invalid ${fieldName}`);
  }
};

const parseBase64 = (value: string, fieldName: string): Buffer => {
  try {
    const buffer = Buffer.from(value, "base64");
    if (!buffer.length) {
      throw new InvalidInputError(`Invalid ${fieldName}`);
    }
    return buffer;
  } catch {
    throw new InvalidInputError(`Invalid ${fieldName}`);
  }
};

@Injectable()
export class CollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getScene(roomId: string): Promise<SceneRecord | null> {
    assertMatch(roomId, ROOM_ID_REGEX, "room id");

    const scene = await this.prisma.collabSceneSnapshot.findUnique({
      where: { roomId },
    });

    if (!scene) {
      return null;
    }

    return {
      roomId: scene.roomId,
      sceneVersion: scene.sceneVersion,
      iv: Buffer.from(scene.iv).toString("base64"),
      ciphertext: Buffer.from(scene.ciphertext).toString("base64"),
      updatedAt: scene.updatedAt.toISOString(),
    };
  }

  async putScene(
    roomId: string,
    input: { sceneVersion: number; ivBase64: string; ciphertextBase64: string },
  ): Promise<SceneRecord> {
    assertMatch(roomId, ROOM_ID_REGEX, "room id");

    const iv = parseBase64(input.ivBase64, "iv");
    const ciphertext = parseBase64(input.ciphertextBase64, "ciphertext");
    const maxSceneBytes = Number(
      this.configService.get<number>("COLLAB_MAX_SCENE_BYTES") ||
        2 * 1024 * 1024,
    );

    if (ciphertext.length > maxSceneBytes) {
      throw new PayloadTooLargeError(
        `Scene payload exceeds ${String(maxSceneBytes)} bytes`,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.collabRoom.upsert({
        where: { id: roomId },
        create: { id: roomId, lastActivityAt: now },
        update: { lastActivityAt: now },
      });

      await transaction.collabSceneSnapshot.upsert({
        where: { roomId },
        create: {
          roomId,
          sceneVersion: input.sceneVersion,
          iv,
          ciphertext,
        },
        update: {
          sceneVersion: input.sceneVersion,
          iv,
          ciphertext,
        },
      });
    });

    await this.auditService.log({
      action: "COLLAB_SCENE_SAVE",
      metadata: {
        roomId,
        sceneVersion: input.sceneVersion,
        bytes: ciphertext.length,
      },
    });

    return (await this.getScene(roomId)) as SceneRecord;
  }

  async getAsset(roomId: string, fileId: string): Promise<AssetRecord> {
    assertMatch(roomId, ROOM_ID_REGEX, "room id");
    assertMatch(fileId, FILE_ID_REGEX, "file id");

    const asset = await this.prisma.collabAsset.findUnique({
      where: {
        roomId_fileId: { roomId, fileId },
      },
    });

    if (!asset) {
      throw new CollabAssetNotFoundError();
    }

    return {
      roomId: asset.roomId,
      fileId: asset.fileId,
      blob: Buffer.from(asset.blob).toString("base64"),
      sizeBytes: asset.sizeBytes,
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  async putAsset(
    roomId: string,
    fileId: string,
    input: { blobBase64: string },
  ): Promise<AssetRecord> {
    assertMatch(roomId, ROOM_ID_REGEX, "room id");
    assertMatch(fileId, FILE_ID_REGEX, "file id");

    const blob = parseBase64(input.blobBase64, "blob");
    const maxFileBytes = Number(
      this.configService.get<number>("COLLAB_MAX_FILE_BYTES") ||
        4 * 1024 * 1024,
    );

    if (blob.length > maxFileBytes) {
      throw new PayloadTooLargeError(
        `Asset payload exceeds ${String(maxFileBytes)} bytes`,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.collabRoom.upsert({
        where: { id: roomId },
        create: { id: roomId, lastActivityAt: now },
        update: { lastActivityAt: now },
      });

      await transaction.collabAsset.upsert({
        where: {
          roomId_fileId: { roomId, fileId },
        },
        create: {
          roomId,
          fileId,
          blob,
          sizeBytes: blob.length,
        },
        update: {
          blob,
          sizeBytes: blob.length,
        },
      });
    });

    await this.auditService.log({
      action: "COLLAB_ASSET_SAVE",
      metadata: {
        roomId,
        fileId,
        bytes: blob.length,
      },
    });

    return this.getAsset(roomId, fileId);
  }
}
